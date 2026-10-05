import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { dreamwalkerVariants, isDreamwalker, titanDisplayName, titanSelectionCards } from '../src/domain/titan-selection.ts';
import { createParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { resolveTable } from '../src/domain/references.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const titans = catalogue.search({ family: 'Titan' });
const dreamwalkers = titans.filter(card => isDreamwalker(card.faces[0]));
const reference = card => ({ definitionId: card.id, faceId: card.faces[0].id });

test('twenty named Dreamwalkers merge into one selectable result while keeping five cycle variants', () => {
  assert.equal(dreamwalkers.length, 20);
  for (const cycle of [1, 2, 3, 4, 5]) {
    const variants = dreamwalkerVariants(titans, cycle);
    assert.equal(variants.length, cycle);
    const choices = titanSelectionCards(titans, cycle);
    const merged = choices.filter(card => isDreamwalker(card.faces[0]));
    assert.equal(merged.length, 1);
    assert.equal(titanDisplayName(merged[0].faces[0]), 'Dreamwalker');
    assert.equal(merged[0].id, variants.at(-1).id);
    const ordinary = catalogue.search({ family: 'Titan', campaignCycle: cycle }).filter(card => !isDreamwalker(card.faces[0]));
    assert.deepEqual(choices.filter(card => !isDreamwalker(card.faces[0])).map(card => card.id).sort(), ordinary.map(card => card.id).sort());
  }
  // Group only named copies with equivalent rules; cycle-specific tables remain distinct.
  for (const variant of dreamwalkerVariants(titans, 5)) {
    const face = variant.faces[0];
    for (const copy of dreamwalkers.filter(card => card.faces[0].cycle === face.cycle)) {
      for (const key of ['titanPower', 'speed', 'abilities', 'kratosTable', 'traumaTable']) assert.deepEqual(copy.faces[0].data[key], face.data[key]);
    }
  }
  const variants = dreamwalkerVariants(titans, 5);
  assert.notDeepEqual(variants[0].faces[0].data.kratosTable, variants[4].faces[0].data.kratosTable);
});

test('Dreamwalker search accepts the common name, original names and printed IDs and retains existing references', () => {
  assert.equal(titanSelectionCards(titans, 3, 'dreamwalker').length, 1);
  assert.equal(titanSelectionCards(titans, 5, 'Solon').length, 1);
  for (const copy of dreamwalkers) {
    assert.equal(titanSelectionCards(titans, 5, copy.printedIds[0])[0].id, copy.id);
    assert.equal(titanSelectionCards(titans, 5, '', reference(copy)).find(card => isDreamwalker(card.faces[0])).id, copy.id);
    assert.ok(dreamwalkerVariants(titans, 5, reference(copy)).some(card => card.id === copy.id));
  }
  const later = dreamwalkerVariants(titans, 5).at(-1);
  assert.deepEqual(titanSelectionCards(titans, 1, later.printedIds[0]), []);
  assert.equal(titanDisplayName(titans.find(card => card.faces[0].name === 'Gamechanger').faces[0]), 'Gamechanger');
});

test('selected Dreamwalker variants preserve their printed tables and saved IDs without changing other Argonauts', () => {
  for (const copy of dreamwalkers) {
    const before = structuredClone(copy);
    let party = createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
    party = partyReducer(party, { type: 'campaign-cycle', argonautId: 'a', partyId: 'p', cycle: 5 }, catalogue);
    party = partyReducer(party, { type: 'titan', argonautId: 'a', titan: { id: 'a:titan', ...reference(copy), exhausted: false, enabledEffectIds: [], counters: {} } }, catalogue);
    assert.equal(party.argonauts[0].titan.definitionId, copy.id);
    for (const kind of ['Trauma', 'Kratos']) assert.deepEqual(resolveTable(party.argonauts[0], kind, catalogue).table, copy.faces[0].data[kind === 'Trauma' ? 'traumaTable' : 'kratosTable']);
    const restored = readBackup(exportProfile({ id: 'p', name: 'Dreamwalkers', party }), catalogue).profile.party;
    assert.deepEqual(restored, party);
    assert.equal(restored.argonauts[1].titan, null);
    assert.deepEqual(copy, before);
  }
});
