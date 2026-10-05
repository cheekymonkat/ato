import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import { aliasesFor, normalizeCatalogue, splitFaces } from '../src/catalogue/normalize.ts';
import { parseCatalogue } from '../src/catalogue/validate.ts';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { extractSlotEffects } from '../src/catalogue/effects.ts';
import { parseSourcePage, parseSourceCard, makeFace } from '../src/domain/cards.ts';
import { createIdentityResolver } from '../scripts/identity-registry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const generated = await readJson('data/generated/catalogue.json');
const repository = createCatalogueRepository(structuredClone(generated));
const registry = await readJson('data/identity-registry.json');
const files = (await readdir(resolve(root, 'data/source'))).filter(f => /^atcc-cards-page-\d+\.json$/.test(f)).sort();
const inputs = [];
for (const file of files) {
  const bytes = await readFile(resolve(root, 'data/source', file));
  inputs.push({ file, sha256: createHash('sha256').update(bytes).digest('hex'), page: parseSourcePage(JSON.parse(bytes), file) });
}
const sourceCards = inputs.flatMap(input => input.page.cards);
const gear = name => repository.byName(name).find(card => card.family === 'Gear');

test('all 3,014 source records survive and can be reconstructed exactly from faces', () => {
  assert.equal(repository.count, 3014);
  assert.equal(new Set(generated.cards.map(c => c.id)).size, 3014);
  assert.equal(new Set(generated.cards.map(c => c.family)).size, 28);
  for (const card of generated.cards) {
    const source = inputs.find(input => input.file === card.source.file).page.cards[card.source.recordIndex];
    const restored = { ...card.faces[0].data };
    if (card.faces[1]) for (const [key, value] of Object.entries(card.faces[1].data)) {
      if (!card.faces[1].inheritedFields.includes(key)) restored[key + '2'] = value;
    }
    assert.deepEqual(restored, source, `Lossless preservation: ${source.name}`);
  }
});

test('five hammers and the Hidden Xiphos reverse resolve with original stats/tokens', () => {
  const expected = ['Cyclopean Forge Hammer', 'Hammer Origin', 'Hammer-Sword', 'Rebound Hammer', 'Relief Hammer'];
  assert.deepEqual(repository.search({ query: 'hammer', family: 'Gear' }).map(card => card.faces[0].name), expected);
  assert.equal(repository.byPrintedId('aj0228')[0].id, gear('Rebound Hammer').id);
  const sword = gear('Hammer-Sword'), back = repository.byName('Hidden Xiphos')[0];
  assert.equal(sword.id, back.id);
  assert.equal(repository.getFace(sword.id, 'back').data.offensiveStatistics.precision, '+4');
  assert.equal(repository.getFace(sword.id, 'back').data.gatedAbilities[0].value, '8+');
  assert.equal(gear('Fists').faces[0].data.offensiveStatistics.precision, '+0');
  assert.equal(repository.search({ family: 'Gear', cycle: 'Cycle III', slot: '1 Hand', query: 'Hidden Xiphos' })[0].id, sword.id);
  assert.throws(() => { sword.faces[0].data.name = 'mutated'; }, TypeError);
});

test('aliases resolve to multiple definitions and are never overwritten', () => {
  assert.deepEqual(repository.byPrintedId('AR0483').map(card => card.family).sort(), ['Attack', 'Trait-like']);
  assert.equal(repository.resolveReference('AR0483').status, 'ambiguous');
  assert.equal(repository.resolveReference('NOT-A-CARD').status, 'missing');
  assert.equal(repository.resolveReference('AJ0266').status, 'resolved');
  assert.equal(repository.byPrintedId('BJ0835').length, 1);
  assert.equal(generated.cards.find(c => c.faces[0].name === 'Hyperborean Ruins' && c.family === 'Terrain').printedIds.length, 0);
});

test('reimport is byte-equivalent and stable IDs survive reorder, wording and alias additions', () => {
  const identity = createIdentityResolver(structuredClone(registry));
  const result = normalizeCatalogue(inputs, card => identity.resolve(card), generated.catalogueVersion);
  assert.deepEqual(result.catalogue, generated);
  assert.deepEqual(identity.snapshot(), registry);
  const edited = sourceCards.map(source => ({ source, card: structuredClone(source) })).reverse();
  edited.forEach(({ card }) => { card.name += ' revised'; if (card.name2) card.name2 += ' revised'; });
  const replay = createIdentityResolver(structuredClone(registry));
  const originalIdentity = createIdentityResolver(structuredClone(registry));
  for (const { source, card } of edited) {
    const expected = originalIdentity.resolve(source);
    assert.equal(replay.resolve(card), expected);
  }
  const changed = structuredClone(sourceCards.find(c => c.name === 'Trireme Breastplate'));
  const id = replay.resolve(changed); changed.cardIDs.push('NEW-PRINTED-ALIAS');
  assert.equal(replay.resolve(changed), id);
});

test('identity collisions fail before implicit deduplication', () => {
  const source = sourceCards.find(c => c.name === 'Trireme Breastplate');
  const duplicate = structuredClone(source); duplicate.name = 'Different card with same identity';
  const identity = createIdentityResolver(structuredClone(registry));
  assert.throws(() => normalizeCatalogue([{ ...inputs[0], page: { ...inputs[0].page, cards: [source, duplicate] } }], card => identity.resolve(card), 'test'), /Identity collision/);
  const conflicting = structuredClone(registry);
  conflicting.entries.push({ id: 'explicit-other', family: 'Gear', game: source.game, aliases: ['AJ0266'] });
  assert.throws(() => createIdentityResolver(conflicting).resolve(source), /Ambiguous registry identity/);
});

test('only explicit reverse faces split; ordinary numbered fields remain on the front', () => {
  const exploration = sourceCards.find(c => c.name === 'Hyperborean Ruins' && c.renderType === 'Exploration');
  assert.equal(splitFaces(exploration).length, 1);
  assert.deepEqual(splitFaces(exploration)[0].data.effects2, exploration.effects2);
  const technology = repository.byName('Last Academy')[0];
  assert.equal(technology.faces[1].name, 'Last Academy');
  assert.ok(technology.faces[1].inheritedFields.includes('renderType'));
});

test('slot patterns retain source tokens, restrictions, optional choice and consequence text', () => {
  const breastplate = gear('Trireme Breastplate').faces[0].slotEffects[0];
  assert.equal(breastplate.slot, 'support'); assert.equal(breastplate.amount, 1);
  assert.equal(breastplate.activation, 'automatic'); assert.equal(breastplate.eligibility, null);
  assert.ok(breastplate.source.pointer.endsWith('/abilities/1/abilityText'));
  assert.ok(breastplate.source.tokens.some(t => t.type === 'icon' && t.value === 'Support'));
  assert.deepEqual(gear('Horseskull Pauldron').faces[0].slotEffects[0].eligibility.requiredTraits, ['Paradox']);
  const backpack = gear('Nosoi Backpack').faces[0].slotEffects[0];
  assert.equal(backpack.slot, 'hand'); assert.equal(backpack.activation, 'optional-loadout');
  assert.deepEqual(backpack.consequences, ['If you do, gain 2 Ambrosia tokens at the start of Battle']);
  assert.equal(generated.cards.flatMap(c => c.faces).flatMap(f => f.slotEffects).length, 9);
  const reordered = structuredClone(gear('Trireme Breastplate').faces[0]);
  reordered.data.abilities.unshift({ abilityText: [{ type: 'plainText', value: 'Unrelated ability added later' }] });
  const reorderedEffect = extractSlotEffects(reordered, gear('Trireme Breastplate').id).effects[0];
  assert.equal(reorderedEffect.id, breastplate.id);
  assert.equal(reorderedEffect.source.pointer, '/abilities/2/abilityText');
});

test('unsupported slot language, plain text symbols and action costs do not silently grant capacity', () => {
  const original = structuredClone(sourceCards.find(c => c.name === 'Trireme Breastplate'));
  original.abilities[1].abilityText = [{ type: 'plainText', value: 'You have 1 additional Support slot' }];
  let result = extractSlotEffects(makeFace(original, 'front', 'test'), 'test-id');
  assert.equal(result.effects.length, 0); assert.equal(result.diagnostics.length, 1);
  original.abilities[1].abilityText = structuredClone(gear('Trireme Breastplate').faces[0].data.abilities[1].abilityText);
  original.abilities[1].costs = ['Exhaust'];
  result = extractSlotEffects(makeFace(original, 'front', 'test'), 'test-id');
  assert.equal(result.effects.length, 0); assert.equal(result.diagnostics.length, 1);
  delete original.abilities[1].costs;
  original.abilities[1].abilityText.push({ type: 'plainText', value: 'if the moon rises' });
  result = extractSlotEffects(makeFace(original, 'front', 'test'), 'test-id');
  assert.equal(result.effects.length, 0); assert.equal(result.diagnostics.length, 1);
});

test('runtime validation rejects corrupted schemas, indexes, token effects and family fields', () => {
  assert.throws(() => parseCatalogue([generated, generated]), /single catalogue object/);
  let broken = structuredClone(generated); broken.schemaVersion = 99;
  assert.throws(() => parseCatalogue(broken), /schema/);
  broken = structuredClone(generated); broken.indexes.printedId.AJ0266 = [];
  assert.throws(() => parseCatalogue(broken), /index/);
  broken = structuredClone(generated); broken.cards.find(c => c.faces[0].slotEffects.length).faces[0].slotEffects[0].amount = -1;
  assert.throws(() => parseCatalogue(broken), /capacity amount/);
  assert.throws(() => parseSourceCard({ name: 'missing fields' }, 'test'), /renderType/);
  const corrupt = structuredClone(sourceCards.find(c => c.name === 'Fists'));
  corrupt.offensiveStatistics.precision = 0;
  assert.throws(() => makeFace(corrupt, 'front', 'test'), /uncoerced string/);
  assert.throws(() => parseSourcePage({ cards: [], currentPage: '1.5' }, 'test'), /integer/);
});

test('quality report preserves every unresolved/ambiguous reference with its source location', async () => {
  const report = await readJson('data/generated/quality-report.json');
  assert.equal(report.deduplicatedRecords, 0);
  assert.equal(report.repeatedAliases.length, 5);
  assert.equal(report.issues.filter(i => i.category === 'unresolved-reference').length, 4);
  assert.equal(report.issues.filter(i => i.category === 'ambiguous-reference').length, 2);
  for (const reference of report.references) {
    assert.deepEqual([...reference.targets].sort(), repository.byPrintedId(reference.printedId).map(c => c.id).sort());
    assert.ok(reference.pointer.startsWith('/cards/'));
  }
  assert.equal(aliasesFor(sourceCards.find(c => c.name === 'Labyrinth Mauler')).length, 1);
});
