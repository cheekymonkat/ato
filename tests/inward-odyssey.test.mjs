import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { currentInwardOdyssey } from '../src/domain/inward-odyssey.ts';
import { argoTrack, argoTrackDefinition } from '../src/domain/argo.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { newProfile, exportProfile, readBackup } from '../src/storage/workspace.ts';

const raw = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(raw);
const fresh = (cycle = 1) => newProfile('p', 'Odyssey', catalogue.version, cycle).party;
const read = (party, id) => argoTrack(party, argoTrackDefinition(id, party.campaignCycle), catalogue);
const action = (party, fields) => ({ partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: party.campaignCycle, ...fields });
const step = party => partyReducer(party, action(party, { type: 'argo-track', id: 'inwards', delta: 1 }), catalogue);
const set = (party, value) => partyReducer(party, action(party, { type: 'argo-track-edit', id: 'inwards', value, limit: 2, reference: '' }), catalogue);

test('all five cycle-specific Inward Odyssey cards store conversion and adventures for both sides in JSON', () => {
  assert.equal(raw.cards.filter(card => card.inwardOdysseyRules).length, 5);
  for (const cycle of [1, 2, 3, 4, 5]) {
    const { card, rules } = currentInwardOdyssey(fresh(cycle), catalogue);
    assert.equal(card.faces[0].data.cardNumber, 'IO');
    assert.equal(rules.progressPerKnowledge, 2); assert.equal(rules.knowledgePerCompletion, 1);
    assert.deepEqual(rules.faces.front.adventures.map(entry => entry.knowledge), Array.from({ length: 10 }, (_, index) => (cycle - 1) * 20 + index + 1));
    assert.deepEqual(rules.faces.back.adventures.map(entry => entry.knowledge), Array.from({ length: cycle === 5 ? 11 : 10 }, (_, index) => (cycle - 1) * 20 + index + 11));
  }
  const rules = currentInwardOdyssey(fresh(2), catalogue).rules;
  assert.equal(rules.faces.back.adventures.find(entry => entry.knowledge === 35).title, 'Argo-bred', 'Colon without a following space is parsed');
  assert.equal(currentInwardOdyssey(fresh(5), catalogue).rules.faces.back.adventures.at(-1).title, 'My Penelope');
});

test('adventures match exact Knowledge and the correct card side; unmatched values do not use another cycle', () => {
  const names = [['Endless Decks', 'Garden of Solitude'], ['Land of the Strong and Free', 'Blood of the Earth'],
    ['Throne of Heavens', 'The First Junction'], ['Daybreak', 'The Island of Pigs'], ['My Ship', 'A Heel Turn']];
  for (const cycle of [1, 2, 3, 4, 5]) {
    for (const [offset, face] of [[1, 'front'], [11, 'back']]) {
      const knowledge = (cycle - 1) * 20 + offset, party = { ...fresh(cycle), resources: { '@ArgoKnowledge': knowledge } };
      const current = currentInwardOdyssey(party, catalogue);
      assert.equal(current.knowledge, knowledge); assert.equal(current.face.id, face);
      assert.deepEqual(current.adventure, { knowledge, title: names[cycle - 1][face === 'front' ? 0 : 1] });
    }
    const zero = currentInwardOdyssey(fresh(cycle), catalogue);
    assert.equal(zero.adventure, null); assert.equal(zero.face.id, 'front');
    const previous = { ...fresh(cycle), resources: { 'Argo Knowledge': (cycle - 1) * 20 } };
    assert.equal(currentInwardOdyssey(previous, catalogue).adventure, null);
  }
});

test('every second Progress atomically resets the cycle track and increments the shared Knowledge pool', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    let party = fresh(cycle); const starting = (cycle - 1) * 20;
    party = step(party); assert.equal(read(party, 'inwards').value, 1); assert.equal(read(party, 'knowledge').value, starting);
    party = step(party); assert.equal(read(party, 'inwards').value, 0); assert.equal(read(party, 'knowledge').value, starting + 1);
    party = step(step(party)); assert.equal(read(party, 'inwards').value, 0); assert.equal(read(party, 'knowledge').value, starting + 2);
    party = set(party, 2); assert.equal(read(party, 'inwards').value, 0); assert.equal(read(party, 'knowledge').value, starting + 3);
    assert.deepEqual(readBackup(exportProfile({ id: party.id, name: 'Inward', party }), catalogue).profile.party, party);
  }
  const original = { ...fresh(), resources: { ArgoKnowledge: 7, 'Argo Knowledge': 9, Ore: 3 },
    argo: { version: 1, tracks: { '1:inwards': { value: 1 }, hull: { value: 4 } }, limits: {}, records: { decks: 'Story 3A' } } };
  const next = step(original);
  assert.deepEqual(next.resources, { 'Argo Knowledge': 10, Ore: 3 });
  assert.equal(next.argo.tracks.hull.value, 4); assert.equal(next.argo.records.decks, 'Story 3A');
  assert.equal(next.argonauts, original.argonauts);
});

test('Inward conversion respects fixed targets and Knowledge limits, and rejects invalid or stale edits', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    const capped = { ...fresh(cycle), resources: { 'Argo Knowledge': cycle * 20 } };
    const next = set(capped, 2);
    assert.equal(read(next, 'inwards').value, 0); assert.equal(read(next, 'knowledge').value, cycle * 20);
  }
  const party = fresh(2), valid = action(party, { type: 'argo-track-edit', id: 'inwards', value: 2, limit: 2, reference: '' });
  for (const change of [{ partyId: 'other' }, { argonautId: 'missing' }, { expectedCycle: 1 }, { value: -1 }, { value: 3 }, { value: 1.5 }, { limit: null }, { limit: 3 }])
    assert.equal(partyReducer(party, { ...valid, ...change }, catalogue), party);
  const legacy = { ...party, argo: { version: 1, tracks: { '2:inwards': { value: 1 } }, limits: { '2:inwards': 20 }, records: {} } };
  assert.equal(read(legacy, 'inwards').limit, 2, 'Old overrides cannot change the printed conversion');
  const advanced = partyReducer(legacy, action(legacy, { type: 'advance-cycle', confirmed: true }), catalogue);
  assert.equal(read(advanced, 'inwards').value, 0);
  assert.equal(advanced.argo.tracks['2:inwards'].value, 1);
  assert.equal(partyReducer(advanced, valid, catalogue), advanced);
});

test('older catalogues derive Inward rules and inconsistent structured adventure metadata is rejected', () => {
  const old = structuredClone(raw); old.cards.forEach(card => delete card.inwardOdysseyRules);
  assert.deepEqual(currentInwardOdyssey(fresh(3), createCatalogueRepository(old)).rules, currentInwardOdyssey(fresh(3), catalogue).rules);
  const corrupt = structuredClone(raw);
  corrupt.cards.find(card => card.inwardOdysseyRules).inwardOdysseyRules.faces.front.adventures[0].title = 'Wrong adventure';
  assert.throws(() => createCatalogueRepository(corrupt), /Inward Odyssey rules/);
});
