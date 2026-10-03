import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createParty, parseParty } from '../src/domain/party.ts';
import { campaignCycle, tokenCount, tokenTypesForCycle } from '../src/domain/tokens.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { exportProfile, readBackup, importProfile } from '../src/storage/workspace.ts';
import { SnapshotStore } from '../src/storage/snapshots.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => createParty('tokens', ['a', 'b', 'c', 'd'], catalogue.version);
const change = (party, owner, token, delta) => partyReducer(party, { type: 'token', argonautId: owner, token, delta });

test('cycle availability uses campaign cycle independently of Titans and retains hidden counts', () => {
  for (const cycle of [1, 2]) assert.deepEqual(tokenTypesForCycle(cycle).map(t => t.name), ['Ambrosia', 'Despair']);
  assert.deepEqual(tokenTypesForCycle(3).map(t => t.name), ['Ambrosia', 'Despair', 'Bleeding']);
  assert.deepEqual(tokenTypesForCycle(4).map(t => t.name), ['Ambrosia', 'Despair', 'Bleeding', 'Midas', 'Pain']);
  assert.deepEqual(tokenTypesForCycle(5).map(t => t.name), ['Ambrosia', 'Despair', 'Bleeding', 'Midas', 'Pain', 'Oxygen', 'Aether']);
  let party = change(fresh(), 'a', 'Oxygen', 1);
  party = partyReducer(party, { type: 'campaign-cycle', argonautId: 'a', cycle: 5 });
  assert.equal(campaignCycle(party), 5);
  party = partyReducer(party, { type: 'campaign-cycle', argonautId: 'b', cycle: 1 });
  assert.equal(tokenCount(party.argonauts[0], 'Oxygen'), 1);
  for (const cycle of [0, 6, 4.5, NaN, '5']) assert.equal(partyReducer(party, { type: 'campaign-cycle', argonautId: 'a', cycle }), party);
});

test('token edits use current amounts, remain isolated and apply no automatic gameplay effects', () => {
  const start = fresh(); let party = start;
  for (const token of tokenTypesForCycle(5)) for (let n = 0; n < 6; n++) party = change(party, 'a', token.name, 1);
  assert.equal(tokenCount(party.argonauts[0], 'Ambrosia'), 6);
  assert.equal(tokenCount(party.argonauts[0], 'Despair'), 6);
  assert.equal(tokenCount(party.argonauts[0], 'Bleeding'), 6);
  assert.deepEqual(party.argonauts[0].skills, start.argonauts[0].skills);
  assert.deepEqual(party.argonauts[0].equipment, start.argonauts[0].equipment);
  assert.equal(party.argonauts[0].titan, null);
  assert.deepEqual(party.argonauts.slice(1), start.argonauts.slice(1));
  party = partyReducer(party, { type: 'select', argonautId: 'b' });
  party = change(party, 'a', 'Pain', -1);
  assert.equal(tokenCount(party.argonauts[0], 'Pain'), 5);
  assert.equal(tokenCount(party.argonauts[1], 'Pain'), 0);
  assert.deepEqual(start, fresh());
});

test('token counts cannot underflow, overflow safe integers or accept malformed actions/saves', () => {
  const party = fresh();
  assert.equal(change(party, 'a', 'Ambrosia', -1), party);
  for (const [token, delta] of [['Unknown', 1], ['Ambrosia', 2], ['Ambrosia', NaN]]) assert.equal(change(party, 'a', token, delta), party);
  assert.equal(change(party, 'missing', 'Pain', 1), party);
  party.argonauts[0].tokens.Aether = Number.MAX_SAFE_INTEGER;
  assert.equal(change(party, 'a', 'Aether', 1), party);
  assert.equal(tokenCount(change(party, 'a', 'Aether', -1).argonauts[0], 'Aether'), Number.MAX_SAFE_INTEGER - 1);
  for (const token of ['Ambrosia', 'Bleeding']) for (const amount of [-1, 0.5, Infinity]) {
    const invalid = structuredClone(party); invalid.argonauts[0].tokens[token] = amount;
    assert.throws(() => parseParty(invalid));
  }
  assert.throws(() => parseParty({ ...party, campaignCycle: 6 }), /campaign cycle/);
});

test('older saves retain unknown token records and default to cycle one without mutation', () => {
  const legacy = fresh(); delete legacy.campaignCycle;
  legacy.argonauts[0].tokens = { poison: 2, Oxygen: 3 };
  const before = structuredClone(legacy), restored = parseParty(legacy);
  assert.equal(campaignCycle(restored), 1);
  assert.deepEqual(restored, before);
  const next = change(restored, 'a', 'Ambrosia', 1);
  assert.deepEqual(next.argonauts[0].tokens, { poison: 2, Oxygen: 3, Ambrosia: 1 });
});

test('campaign cycle and independent token counts survive restart, backup and profile import', async () => {
  let party = partyReducer(fresh(), { type: 'campaign-cycle', argonautId: 'a', cycle: 5 });
  for (const [index, member] of party.argonauts.entries()) {
    for (const token of tokenTypesForCycle(5)) for (let n = 0; n <= index; n++) party = change(party, member.id, token.name, 1);
  }
  const profile = { id: party.id, name: 'Token tracker', party };
  const backup = readBackup(exportProfile(profile), catalogue);
  assert.deepEqual(backup.profile, profile);
  const data = new Map();
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, runExclusive: async task => task() };
  const store = new SnapshotStore(storage); await store.load();
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile] };
  await store.save(workspace);
  const restored = await new SnapshotStore(storage).load();
  assert.equal(restored.kind, 'ready'); assert.deepEqual(restored.workspace, workspace);
  const imported = importProfile(workspace, backup.profile, 'copy', 'Token copy');
  assert.equal(imported.profiles[1].party.campaignCycle, 5);
  assert.deepEqual(imported.profiles[1].party.argonauts, party.argonauts);
  assert.deepEqual(workspace.profiles[0], profile);
});
