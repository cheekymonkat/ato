import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { argoBredArgonauts, argoBredConflicts, dreamwalkerVariants, isDreamwalker, titanDisplayName, titanSelectionCards } from '../src/domain/titan-selection.ts';
import { createParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { resolveTable } from '../src/domain/references.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const titans = catalogue.search({ family: 'Titan' });
const dreamwalkers = titans.filter(card => isDreamwalker(card.faces[0]));
const reference = card => ({ definitionId: card.id, faceId: card.faces[0].id });

test('different Argo-bred types coexist and duplicate warnings clear when the repeated type is replaced or removed', () => {
  let party = createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
  const choose = (argonautId, name) => {
    const card = titans.find(card => card.faces[0].name === name);
    party = partyReducer(party, { type: 'titan', argonautId, titan: card ? { id: `${argonautId}:titan`, ...reference(card), exhausted: false, enabledEffectIds: [], counters: {} } : null }, catalogue);
  };
  assert.deepEqual(argoBredArgonauts(party, catalogue), []);
  choose('a', 'Mazerunner');
  assert.deepEqual(argoBredArgonauts(party, catalogue).map(a => a.id), ['a']);
  choose('d', 'Gamechanger');
  assert.deepEqual(argoBredArgonauts(party, catalogue).map(a => a.id), ['a', 'd']);
  assert.deepEqual(argoBredConflicts(party, catalogue), []);
  choose('c', 'Mazerunner');
  assert.deepEqual(argoBredConflicts(party, catalogue).map(group => ({ name: group.name, owners: group.argonauts.map(a => a.id) })), [{ name: 'Mazerunner', owners: ['a', 'c'] }]);
  choose('c', 'Earthshaker');
  assert.deepEqual(argoBredConflicts(party, catalogue), []);
  choose('c', null);
  party = partyReducer(party, { type: 'select', argonautId: 'b' }, catalogue);
  assert.equal(argoBredArgonauts(party, catalogue).length, 2);
  choose('d', 'Solon');
  assert.equal(argoBredArgonauts(party, catalogue).length, 1);
  choose('a', null);
  assert.equal(argoBredArgonauts(party, catalogue).length, 0);
});

test('every named Dreamwalker subtype is exempt; unresolved references are not classified as Argo-bred', () => {
  const party = createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
  for (const card of dreamwalkers) {
    for (const member of party.argonauts) member.titan = null;
    party.argonauts[0].titan = { id: 'a:titan', ...reference(card), exhausted: false, enabledEffectIds: [], counters: {} };
    assert.equal(argoBredArgonauts(party, catalogue).length, 0);
    for (const member of party.argonauts) member.titan = { id: `${member.id}:titan`, ...reference(card), exhausted: false, enabledEffectIds: [], counters: {} };
    assert.deepEqual(argoBredConflicts(party, catalogue), []);
  }
  const argoBred = titans.find(card => card.faces[0].name === 'Mazerunner');
  for (const argonaut of party.argonauts.slice(0, 2)) {
    argonaut.titan = { id: `${argonaut.id}:titan`, ...reference(argoBred), exhausted: argonaut.id === 'a', discarded: argonaut.id === 'b', enabledEffectIds: [], counters: {} };
  }
  party.argonauts[2].titan = { id: 'c:titan', definitionId: 'missing', faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} };
  assert.equal(argoBredArgonauts(party, catalogue).length, 2);
  party.argonauts[2].titan = null;
  const restored = readBackup(exportProfile({ id: 'p', name: 'Titans', party }), catalogue).profile.party;
  assert.equal(argoBredArgonauts(restored, catalogue).length, 2);
  assert.equal(argoBredConflicts(restored, catalogue)[0].name, 'Mazerunner');
  assert.deepEqual(argoBredConflicts(restored, catalogue)[0].argonauts.map(a => a.id), ['a', 'b']);
});

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


test('four different Argo-bred types are legal; each Argonaut retains exactly one selected Titan', () => {
  let party = createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
  for (const [index, name] of ['Mazerunner', 'Gamechanger', 'Logicbreaker', 'Earthshaker'].entries()) {
    const argonautId = party.order[index], card = catalogue.byName(name)[0];
    party = partyReducer(party, { type: 'titan', argonautId, titan: { id: `${argonautId}:titan`, ...reference(card), exhausted: false, enabledEffectIds: [], counters: {} } }, catalogue);
  }
  assert.equal(argoBredArgonauts(party, catalogue).length, 4);
  assert.deepEqual(argoBredConflicts(party, catalogue), []);
  const before = party.argonauts[0].titan, card = catalogue.byName('Solon')[0];
  const changed = partyReducer(party, { type: 'titan', argonautId: 'a', titan: { ...before, ...reference(card) } }, catalogue);
  assert.equal(changed.argonauts[0].titan.definitionId, card.id);
  assert.equal(changed.argonauts[0].instances.some(instance => instance.id === before.id), false);
  assert.deepEqual(changed.argonauts.slice(1), party.argonauts.slice(1));
  assert.deepEqual(argoBredConflicts(changed, catalogue), []);
});

test('all repeated Argo-bred groups are reported independently, while distinct full type names stay separate', () => {
  const party = createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
  for (const [index, name] of ['Mazerunner', 'Gamechanger', 'Mazerunner', 'Gamechanger'].entries()) {
    const member = party.argonauts[index], card = catalogue.byName(name)[0];
    member.titan = { id: `${member.id}:titan`, ...reference(card), exhausted: false, enabledEffectIds: [], counters: {} };
  }
  assert.deepEqual(argoBredConflicts(party, catalogue).map(group => [group.name, group.argonauts.map(a => a.id)]), [['Mazerunner', ['a', 'c']], ['Gamechanger', ['b', 'd']]]);
  const truthbearer = catalogue.byName('Truthbearer')[0], immortal = catalogue.byName('Immortal Truthbearer')[0];
  party.argonauts[0].titan = { ...party.argonauts[0].titan, ...reference(truthbearer) };
  party.argonauts[1].titan = { ...party.argonauts[1].titan, ...reference(immortal) };
  assert.deepEqual(argoBredConflicts(party, catalogue), []);
});

test('different catalogue copies of the same printed Titan type share the Argo-bred limit', () => {
  const party = createParty('p', ['a', 'b', 'c', 'd'], catalogue.version), card = catalogue.byName('Mazerunner')[0];
  party.argonauts[0].titan = { id: 'a:titan', ...reference(card), exhausted: false, enabledEffectIds: [], counters: {} };
  party.argonauts[1].titan = { id: 'b:titan', definitionId: 'other-copy', faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} };
  const copies = { getFace: (id, side) => id === 'other-copy' ? { ...card.faces[0], name: '  MAZERUNNER  ' } : catalogue.getFace(id, side) };
  assert.deepEqual(argoBredConflicts(party, copies).map(group => group.argonauts.map(a => a.id)), [['a', 'b']]);
});
