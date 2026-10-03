import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty } from '../src/domain/party.ts';
import { faceTable, flattenAbilities, resolveTable, supportsPattern } from '../src/domain/references.ts';
import { formatParagraph } from '../src/domain/card-presentation.ts';
import { createKeywordRepository } from '../src/domain/keywords.ts';
import { titanAbilityRows } from '../src/domain/titan-presentation.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup, referenceProblems } from '../src/storage/workspace.ts';
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
const titans = catalogue.search({ family: 'Titan' });
const keywordData = Object.assign({}, ...['titanAbilityData', 'keywords', 'primordialAbilityData', 'keyword-overrides'].map(name => JSON.parse(fs.readFileSync(new URL(`../data/reference/${name}.json`, import.meta.url)))));
const keywords = createKeywordRepository(keywordData);
const patterns = Object.fromEntries(['Trauma', 'Kratos'].map(kind => [kind, catalogue.search({ family: 'Pattern' }).find(card => supportsPattern(card.faces[0], kind))]));
const reference = card => ({ definitionId: card.id, faceId: 'front' });
const chooseTitan = (party, card) => partyReducer(party, { type: 'titan', argonautId: 'a', titan: card ? { id: 'titan', ...reference(card), exhausted: false, enabledEffectIds: [], counters: {} } : null }, catalogue);
const choosePattern = (party, kind, card, owner = 'a') => partyReducer(party, { type: 'table-override', argonautId: owner, kind, reference: card ? reference(card) : null }, catalogue);

test('Titan defaults and independent Pattern overrides follow selection and reset predictably', () => {
  let party = chooseTitan(fresh(), titans[0]);
  assert.deepEqual(resolveTable(party.argonauts[0], 'Trauma', catalogue).table, titans[0].faces[0].data.traumaTable);
  party = choosePattern(choosePattern(party, 'Trauma', patterns.Trauma), 'Kratos', patterns.Kratos);
  const overrides = structuredClone(party.argonauts[0].tableOverrides);
  party = chooseTitan(party, titans[1]);
  assert.deepEqual(party.argonauts[0].tableOverrides, overrides);
  for (const kind of ['Trauma', 'Kratos']) assert.equal(resolveTable(party.argonauts[0], kind, catalogue).face, patterns[kind].faces[0]);
  party = choosePattern(party, 'Trauma', null);
  assert.equal(resolveTable(party.argonauts[0], 'Trauma', catalogue).face, titans[1].faces[0]);
  assert.equal(resolveTable(party.argonauts[0], 'Kratos', catalogue).source, 'pattern');
  assert.deepEqual(party.argonauts[1].tableOverrides, { trauma: null, kratos: null });
  party = chooseTitan(party, null);
  assert.equal(resolveTable(party.argonauts[0], 'Kratos', catalogue).source, 'pattern');
  assert.equal(resolveTable(party.argonauts[0], 'Trauma', catalogue).source, 'missing');
});

test('Pattern overrides work without a Titan and survive a full portable backup', () => {
  const party = choosePattern(choosePattern(fresh(), 'Trauma', patterns.Trauma), 'Kratos', patterns.Kratos, 'b');
  assert.equal(resolveTable(party.argonauts[0], 'Trauma', catalogue).source, 'pattern');
  const restored = readBackup(exportProfile({ id: 'p', name: 'Patterns', party }), catalogue).profile.party;
  assert.deepEqual(restored, party); assert.deepEqual(referenceProblems(party, catalogue), []);
});

test('wrong-table Patterns and non-Pattern cards cannot override a reference', () => {
  const party = chooseTitan(fresh(), titans[0]);
  for (const card of [patterns.Kratos, titans[0], catalogue.search({ family: 'Gear' })[0]]) assert.equal(choosePattern(party, 'Trauma', card), party);
  assert.equal(partyReducer(party, { type: 'table-override', argonautId: 'a', kind: 'Trauma', reference: { definitionId: patterns.Trauma.id, faceId: 'back' } }, catalogue), party);
});

test('missing and incompatible saved overrides are kept and never silently fall back to a valid Titan', () => {
  const party = chooseTitan(fresh(), titans[0]);
  for (const override of [{ definitionId: 'absent', faceId: 'front' }, reference(patterns.Kratos), { definitionId: patterns.Trauma.id, faceId: 'back' }]) {
    const input = structuredClone(party); input.argonauts[0].tableOverrides.trauma = override;
    const before = structuredClone(input), result = resolveTable(input.argonauts[0], 'Trauma', catalogue);
    assert.equal(result.source, 'missing'); assert.deepEqual(result.table, []); assert.match(result.message, /reference has been kept/);
    assert.match(referenceProblems(input, catalogue).join('\n'), /Trauma Pattern override/);
    assert.throws(() => readBackup(JSON.stringify(input), catalogue), /unresolved references/);
    assert.deepEqual(input, before);
  }
  assert.match(resolveTable(fresh().argonauts[0], 'Kratos', catalogue).message, /Choose a Titan or/);
});

test('all reference families retain complete ability text, gates and costs after group flattening', () => {
  for (const family of ['Mnemos', 'Fated Mnemos', 'Titan', 'Pattern']) for (const card of catalogue.search({ family })) for (const face of card.faces) {
    const paragraphs = face.kind === 'fated-mnemos' ? [face.data.effect, face.data.growthAbility] : [face.data.abilities];
    for (const paragraph of paragraphs) {
      const result = formatParagraph(flattenAbilities(paragraph), true);
      assert.deepEqual(result.diagnostics, [], `${family} ${face.name}`);
      for (const sentence of flattenAbilities(paragraph)) {
        if (sentence.gate) assert.ok(result.label.includes(sentence.gate), `${face.name}: gate`);
        for (const cost of sentence.costs || []) assert.ok(result.label.includes(`[${cost}]`), `${face.name}: ${cost}`);
      }
    }
    if (family === 'Titan') for (const kind of ['Trauma', 'Kratos']) assert.ok(faceTable(face, kind)?.length);
    if (family === 'Pattern') assert.ok(supportsPattern(face, face.data.patternType));
  }
});

test('Gamechanger keeps its ability costs and selects only the matching Advanced Reflex subdefinition', () => {
  const face = titans.find(card => card.faces[0].name === 'Gamechanger').faces[0];
  const original = structuredClone(face), rows = titanAbilityRows(face, keywords);
  assert.deepEqual(rows.map(row => row.details.map(detail => detail.name)), [['Advanced Reflex'], ['Unknown Might'], ['Disturbance in Fate'], ['Ruse']]);
  assert.equal(formatParagraph(rows[0].heading, true).label, '[Fate] [Exhaust] Advanced Reflex.');
  const reflex = rows[0].details[0].definition;
  assert.equal(reflex.title, 'Advanced Reflex');
  assert.equal(formatParagraph(reflex.main, true).label, '2 spaces instead.');
  assert.deepEqual(reflex.sections, []);
  assert.match(formatParagraph(rows[1].details[0].definition.main, true).label, /\[ThreeHanded\].*\[TwoHanded\].*-1 \[Support\]/);
  assert.match(formatParagraph(rows[2].details[0].definition.main, true).label, /Crit Miss.*\[Adversary\]/);
  assert.match(formatParagraph(rows[3].details[0].definition.main, true).label, /Major, Grave, or Obol Trauma/);
  assert.deepEqual(face, original);
});

test('all Titan rows retain source headlines, costs and complete supplied definitions, keeping unresolved keywords explicit', () => {
  const missing = new Set();
  for (const card of titans) for (const face of card.faces) {
    const rows = titanAbilityRows(face, keywords);
    assert.deepEqual(rows.map(row => row.heading), flattenAbilities(face.data.abilities));
    for (const row of rows) {
      assert.deepEqual(formatParagraph(row.heading, true).diagnostics, [], face.name);
      for (const detail of row.details) {
        if (!detail.definition) { missing.add(detail.name); continue; }
        assert.deepEqual(detail.definition, keywords.resolve(detail.name));
        assert.deepEqual(formatParagraph(detail.definition.main, true).diagnostics, [], `${face.name}: ${detail.name}`);
        for (const section of detail.definition.sections) if (section.content) assert.deepEqual(formatParagraph(section.content, true).diagnostics, [], `${face.name}: ${section.title}`);
      }
    }
  }
  assert.deepEqual([...missing], []);
  const fixture = { ...titans[0].faces[0], data: { ...titans[0].faces[0].data, abilities: [[{ abilityText: [{ type: 'plainText', value: 'Future custom ability' }] }]] } };
  const rows = titanAbilityRows(fixture, keywords);
  assert.equal(rows.length, 1); assert.equal(rows[0].details.length, 0);
  assert.equal(formatParagraph(rows[0].heading).label, 'Future custom ability.');
});
