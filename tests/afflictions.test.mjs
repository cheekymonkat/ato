import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { AFFLICTIONS, afflictionRecords } from '../src/domain/afflictions.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => createParty('affliction-party', ['a', 'b', 'c', 'd'], catalogue.version);
const add = (party, id, owner = 'a') => partyReducer(party, { type: 'add-affliction', partyId: party.id, argonautId: owner, id });

test('afflictions follow campaign cycle, allow multiple unique selections and edit only their owner', () => {
  let party = fresh();
  assert.equal(AFFLICTIONS.length, 14);
  assert.equal(add(party, 'black-breath'), party);
  assert.equal(add(party, 'unknown'), party);
  party = partyReducer(party, { type: 'select', argonautId: 'b' });
  const before = party;
  party = add(party, 'mazetouched');
  assert.equal(party.activeArgonautId, 'b');
  assert.equal(party.argonauts[1], before.argonauts[1]);
  assert.equal(before.argonauts[0].afflictions, undefined);
  assert.equal(add(party, 'mazetouched'), party);
  assert.equal(partyReducer(party, { type: 'add-affliction', partyId: 'other', argonautId: 'a', id: 'mazetouched' }), party);
  party = partyReducer(party, { type: 'campaign-cycle', argonautId: 'a', cycle: 3 });
  party = add(add(party, 'black-breath'), 'fractured');
  assert.deepEqual(afflictionRecords(party.argonauts[0]).map(record => record.name), ['Mazetouched', 'Black Breath', 'Fractured']);
  assert.equal(add(party, 'abyss-curse'), party);
  const lower = partyReducer(party, { type: 'campaign-cycle', argonautId: 'a', cycle: 1 });
  assert.deepEqual(lower.argonauts[0].afflictions, party.argonauts[0].afflictions);
});

test('affliction removal requires confirmation and the captured campaign; cleanup retains afflictions', () => {
  const party = add(fresh(), 'mazetouched');
  const action = { type: 'remove-affliction', partyId: party.id, argonautId: 'a', id: 'mazetouched', confirmed: true };
  for (const change of [{ confirmed: false }, { confirmed: undefined }, { confirmed: 'yes' }, { partyId: 'other' }, { argonautId: 'missing' }]) {
    assert.equal(partyReducer(party, { ...action, ...change }), party);
  }
  const marked = partyReducer(party, { type: 'token', argonautId: 'a', token: 'Despair', delta: 1 });
  const cleanup = partyReducer(marked, { type: 'clear-all', partyId: party.id, argonautId: 'a', confirmed: true });
  assert.deepEqual(cleanup.argonauts[0].afflictions, ['mazetouched']);
  assert.deepEqual(partyReducer(cleanup, action).argonauts[0].afflictions, []);
});

test('afflictions round-trip with backups and older saves; malformed and duplicate selections are rejected', () => {
  const older = fresh();
  assert.equal(parseParty(older).argonauts[0].afflictions, undefined);
  let party = partyReducer(older, { type: 'campaign-cycle', argonautId: 'a', cycle: 5 });
  for (const affliction of AFFLICTIONS) party = add(party, affliction.id);
  const loaded = readBackup(exportProfile({ id: party.id, name: 'Voyage', party }), catalogue).profile.party;
  assert.deepEqual(afflictionRecords(loaded.argonauts[0]), AFFLICTIONS);
  for (const afflictions of [null, 'mazetouched', ['unknown'], ['mazetouched', 'mazetouched']]) {
    const invalid = structuredClone(party); invalid.argonauts[0].afflictions = afflictions;
    assert.throws(() => parseParty(invalid), /invalid or duplicate afflictions/);
  }
});
