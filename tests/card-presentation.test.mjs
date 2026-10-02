import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatParagraph, cardLinks, diceLayers, displayGate, gateLabel, overheadGate, isSecretCard, faceForReference } from '../src/domain/card-presentation.ts';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createKeywordRepository } from '../src/domain/keywords.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const named = name => catalogue.byName(name)[0];

test('the five hammers retain number-like stats, formatted text, costs and references', () => {
  for (const name of ['Rebound Hammer', 'Cyclopean Forge Hammer', 'Relief Hammer', 'Hammer-Sword', 'Hammer Origin']) {
    const face = named(name).faces[0], paragraph = formatParagraph(face.data.abilities);
    assert.ok(paragraph.label.length > 0, name);
    assert.deepEqual(paragraph.diagnostics, [], name);
    assert.equal(typeof face.data.offensiveStatistics.precision, 'string');
  }
  assert.match(formatParagraph(named('Rebound Hammer').faces[0].data.abilities).label, /Full Miss: Place 2 Opening or 2 Break tokens in the Kratos Pool\./);
  const relief = named('Relief Hammer').faces[0];
  const gated = formatParagraph(relief.data.gatedAbilities[0].abilities);
  assert.match(gated.label, /^\[Discard\] Place a Column Terrain tile/);
  assert.match(gated.label, /\[Reaction\]\./);
  assert.deepEqual(cardLinks(relief).references, [{ id: 'AI0361', name: 'Column' }]);
  assert.equal(catalogue.resolveReference('AI0361').status, 'resolved');
});

test('ordinary sentences flow together; timing, costs and explicit newlines create blocks', () => {
  const sentence = abilityText => ({ abilityText });
  const paragraph = formatParagraph([
    sentence([{ type: 'keyword', value: 'Break 2' }]),
    sentence([{ type: 'bold', value: 'Next' }, { type: 'plainText', value: ' effect' }]),
    sentence([{ type: 'timing', value: 'Reaction' }, { type: 'whitespace', value: '   ' }, { type: 'italics', value: 'Move' }, { type: 'newline' }, { type: 'plainText', value: 'again' }]),
  ]);
  assert.equal(paragraph.label, 'Break 2. Next effect. \n[Reaction] Move\nagain.');
  assert.equal(paragraph.blocks.length, 3);
  assert.equal(paragraph.blocks[0][2].segments[0].format, 'bold');
});

test('unrecognised tokens and malformed sentences retain their content and diagnostics', () => {
  const result = formatParagraph([{ abilityText: [{ type: 'futureToken', value: 'Visible fallback' }] }, { unsupported: '+0' }]);
  assert.match(result.label, /Visible fallback/);
  assert.match(result.label, /unsupported/);
  assert.match(result.label, /\+0/);
  assert.equal(result.diagnostics.length, 2);
});

test('compound thresholds preserve both values and the original orientation heuristic', () => {
  const gate = displayGate({ gate: 'Fate', value: '8+', gate2: 'Ambrosia', value2: '3+', comboGate: 'OR' });
  assert.equal(gateLabel(gate), 'Fate 8+ or Ambrosia 3+');
  assert.equal(overheadGate({ ...named('Relief Hammer').faces[0].data.gatedAbilities[0] }, 1), false);
  assert.equal(overheadGate({ comboGate: 'OR', abilities: [] }, 1), true);
  assert.equal(overheadGate({ comboGate: 'OR', abilities: [] }, 2), false);
  assert.equal(diceLayers(['Red', 'Black', 'Black'])[1].name, 'ReversedBlack');
  const layers = diceLayers(['Red', 'Black', 'Black']);
  assert.deepEqual(layers.map(layer => layer.x), [-9, 8, 0]);
  assert.ok(Math.abs(layers[2].y + 7.2) < 1e-10);
});

test('flipping and alias inspection use the right face without mutating the shared definition', () => {
  const card = named('Hammer-Sword');
  const before = JSON.stringify(card);
  assert.equal(card.faces[1].name, 'Hidden Xiphos');
  assert.equal(card.faces[1].data.slot, '1 Hand');
  assert.match(formatParagraph(card.faces[1].data.abilities).label, /Opening 2/);
  // A shared printed ID deliberately defaults to front; explicit flip chooses back.
  assert.equal(faceForReference(card, 'CJ1472').id, 'front');
  assert.equal(JSON.stringify(card), before);
});

test('secret status covers the entire definition, including reverse-only secret metadata', () => {
  assert.equal(isSecretCard(named('Hammer Origin')), true);
  assert.equal(isSecretCard(named('Relief Hammer')), false);
  const card = structuredClone(named('Hammer-Sword'));
  card.faces[1].data.foundIn = 'Envelope 4';
  assert.equal(isSecretCard(card), true);
});

test('keyword aliases and parameters resolve offline; unknown definitions are not invented', () => {
  const keywords = createKeywordRepository(JSON.parse(fs.readFileSync(new URL('../data/reference/keywords.json', import.meta.url))));
  assert.ok(keywords.resolve('Power Re-roll 2'));
  assert.equal(keywords.resolve('Auto-break 1').auto, true);
  assert.ok(keywords.resolve('Cumbersome').main);
  assert.ok(keywords.resolve('Combo Breaker: 6 spaces'));
  assert.equal(keywords.resolve('An unknown gameplay rule'), undefined);
});

test('all bundled Gear ability and gate shapes remain readable without formatting diagnostics', () => {
  for (const card of catalogue.search({ family: 'Gear' })) for (const face of card.faces) {
    if (face.kind !== 'gear') continue;
    for (const paragraph of [face.data.abilities, ...face.data.gatedAbilities.map(group => group.abilities)]) {
      assert.deepEqual(formatParagraph(paragraph).diagnostics, [], face.name);
    }
  }
});
