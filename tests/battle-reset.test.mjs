import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { SnapshotStore } from '../src/storage/snapshots.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => createParty('battle', ['a', 'b', 'c', 'd'], catalogue.version);
const card = (id, definition, changes = {}) => ({ id, definitionId: definition.id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: { charges: 2 }, ...changes });
const action = { type: 'clear-all', argonautId: 'a', partyId: 'battle', confirmed: true };
function populated() {
  const party = fresh(), gear = catalogue.byName('Hammer-Sword')[0], fear = catalogue.byName('Fear')[0];
  const memories = catalogue.search({ family: 'Mnemos' }), fated = catalogue.search({ family: 'Fated Mnemos' });
  const titan = catalogue.search({ family: 'Titan' })[0];
  party.campaignCycle = 1; party.resources = { Hope: 8 }; party.activeArgonautId = 'c'; party.order = ['d', 'b', 'a', 'c'];
  party.argonauts = party.argonauts.map((member, index) => ({ ...member,
    name: `Player ${index + 1}`, skills: { ...member.skills, Courage: 5, Will: -2 },
    tokens: { Ambrosia: 2, Despair: 3, Midas: 1, Pain: 2, Oxygen: 4, Aether: 5, custom: 9 },
    counters: { rage: 4, fate: 3, danger: 11 }, localConditions: ['Historical condition'],
    conditions: [{ id: `${member.id}:fear`, name: 'Fear', reference: { definitionId: fear.id, faceId: 'front' }, amount: 1, source: 'Attack', duration: 'Until next turn' }],
    titan: card(`${member.id}:titan`, titan, index % 2 ? { discarded: true } : { exhausted: true }),
    instances: [card(`${member.id}:gear`, gear, { exhausted: true, faceId: 'back' }),
      card(`${member.id}:memory`, memories[index], { discarded: true, memoryProgress: { node: 8, growthUnlocked: false, breakthroughs: [true, true] } }),
      card(`${member.id}:fated`, fated[index], { exhausted: true, memoryProgress: { node: 3, growthUnlocked: true } }),
      card(`${member.id}:unassigned`, gear, { discarded: true })],
    equipment: [{ instanceId: `${member.id}:gear`, positionIds: ['hand-1'], attachmentHostId: null }],
    mnemosIds: [`${member.id}:memory`, null], fatedMnemosIds: [`${member.id}:fated`, null],
  }));
  return parseParty(party);
}

test('confirmed clear-all resets every Argonaut including hidden tokens, Titans, memories and unassigned cards without changing campaign or progress', () => {
  const start = populated(), original = structuredClone(start), reset = partyReducer(start, action, catalogue);
  assert.deepEqual(start, original);
  assert.deepEqual({ ...reset, argonauts: [] }, { ...start, argonauts: [] });
  for (const [index, member] of reset.argonauts.entries()) {
    const before = start.argonauts[index];
    assert.deepEqual(member.localConditions, []); assert.deepEqual(member.conditions, []);
    assert.deepEqual(member.tokens, Object.fromEntries(Object.keys(before.tokens).map(name => [name, 0])));
    assert.deepEqual(member.counters, { rage: 0, fate: 0, danger: 0 });
    assert.equal(member.instances.length, before.instances.length);
    for (const [cardIndex, instance] of member.instances.entries()) {
      const previous = before.instances[cardIndex];
      assert.deepEqual(instance, { ...previous, exhausted: false, ...(previous.discarded ? { discarded: false } : {}) });
    }
    assert.deepEqual(member.titan, { ...before.titan, exhausted: false, ...(before.titan.discarded ? { discarded: false } : {}) });
    assert.deepEqual({ ...member, localConditions: [], conditions: [], tokens: {}, counters: {}, instances: [], titan: null },
      { ...before, localConditions: [], conditions: [], tokens: {}, counters: {}, instances: [], titan: null });
  }
  assert.deepEqual(parseParty(reset), reset);
  assert.equal(partyReducer(reset, action, catalogue), reset);
});

test('clear-all requires explicit confirmation and the captured campaign identity; empty older parties remain unchanged', () => {
  const party = populated();
  for (const change of [{ confirmed: false }, { confirmed: undefined }, { confirmed: 'yes' }, { partyId: 'another-campaign' }, { argonautId: 'missing' }]) {
    assert.equal(partyReducer(party, { ...action, ...change }, catalogue), party);
  }
  const clean = fresh(); assert.equal(partyReducer(clean, action, catalogue), clean);
  const older = fresh(); delete older.campaignCycle; older.argonauts[0].localConditions = ['Legacy'];
  const reset = partyReducer(older, action, catalogue);
  assert.equal(Object.hasOwn(reset, 'campaignCycle'), false);
  assert.equal(Object.hasOwn(reset.argonauts[0], 'conditions'), false);
  assert.deepEqual(reset.argonauts[0].localConditions, []);
  assert.equal(reset.argonauts[1], older.argonauts[1]);
  assert.deepEqual(parseParty(reset), reset);
});

test('Refresh Gear unexhausts only its owner’s Gear, memories and Titan while preserving discards and all other state', () => {
  const start = populated(), original = structuredClone(start);
  const next = partyReducer(start, { type: 'refresh-gear', argonautId: 'a' }, catalogue);
  const expected = { ...start.argonauts[0],
    instances: start.argonauts[0].instances.map(instance => ({ ...instance, exhausted: false })),
    titan: { ...start.argonauts[0].titan, exhausted: false } };
  assert.deepEqual(next.argonauts[0], expected);
  for (const index of [1, 2, 3]) assert.equal(next.argonauts[index], start.argonauts[index]);
  assert.equal(next.argonauts[0].instances[1].discarded, true);
  assert.equal(next.argonauts[0].instances[3].discarded, true);
  assert.deepEqual({ ...next, argonauts: [] }, { ...start, argonauts: [] });
  assert.deepEqual(start, original); assert.deepEqual(parseParty(next), next);
  assert.equal(partyReducer(next, { type: 'refresh-gear', argonautId: 'a' }, catalogue), next);
  assert.equal(partyReducer(next, { type: 'refresh-gear', argonautId: 'missing' }, catalogue), next);
  assert.equal(partyReducer(fresh(), { type: 'refresh-gear', argonautId: 'a' }, catalogue).argonauts[0].titan, null);
  const profile = { id: next.id, name: 'Refreshed cards', party: next };
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
});

test('the complete clear-all result persists atomically through local restart and portable backups without modifying other campaigns', async () => {
  const start = populated(), reset = partyReducer(start, action, catalogue), profile = { id: reset.id, name: 'Battle', party: reset };
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  const other = { id: 'other', name: 'Other', party: { ...populated(), id: 'other' } };
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile, other] };
  const data = new Map(), adapter = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, runExclusive: async task => task() };
  const store = new SnapshotStore(adapter); await store.load(); await store.save(workspace);
  const loaded = (await new SnapshotStore(adapter).load()).workspace;
  assert.deepEqual(loaded, workspace); assert.deepEqual(loaded.profiles[1], other);
});
