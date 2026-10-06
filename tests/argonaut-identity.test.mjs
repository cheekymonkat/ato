import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { argonautSuggestions, portraitSkill } from '../src/domain/argonaut-identity.ts';
import { argonautSkills } from '../src/domain/argonaut-stats.ts';
import { createParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';
import { SnapshotStore } from '../src/storage/snapshots.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => ({ ...createParty('portraits', ['a', 'b', 'c', 'd'], catalogue.version), campaignCycle: 4 });
const named = name => catalogue.byName(name).find(card => card.family === 'Argonaut');
const request = (party, definitionId, name = '', owner = 'a', extra = {}) => {
  const member = party.argonauts.find(member => member.id === owner);
  return { type: 'argonaut-change', argonautId: owner, name, definitionId, confirmed: true, partyId: party.id,
    expectedName: member?.name, expectedDefinitionId: member?.argonautDefinitionId, ...extra };
};
const select = (party, name, owner = 'a') => partyReducer(party, request(party, named(name).id, name, owner), catalogue);
const stats = party => argonautSkills(party.argonauts[0], catalogue);
const zero = { Courage: 0, Cunning: 0, Endurance: 0, Fury: 0, Will: 0, Wisdom: 0 };

test('suggestions match partial names and accents, use campaign cycle and omit generic Choose portraits', () => {
  assert.deepEqual(argonautSuggestions(catalogue, 'ole', 4).map(match => [match.name, match.skill]), [['Oleander', 'Wisdom']]);
  assert.deepEqual(argonautSuggestions(catalogue, '  OLE  ', 5).map(match => match.name), ['Oleander']);
  assert.deepEqual(argonautSuggestions(catalogue, 'ole', 3), []);
  assert.equal(argonautSuggestions(catalogue, 'fish', 1)[0].name, 'Fisher');
  assert.equal(argonautSuggestions(catalogue, 'omor', 4)[0].name, 'Ómorfos');
  assert.deepEqual(argonautSuggestions(catalogue, '', 4), []);
  assert.deepEqual(argonautSuggestions(catalogue, 'Argonaut', 4), []);
  assert.deepEqual(argonautSuggestions(catalogue, 'Not a printed character', 4), []);
});

test('selecting Oleander populates +1 Wisdom once and preserves all four owners and current equipment', () => {
  const start = fresh(); start.argonauts[0].tokens.Despair = 2; start.argonauts[0].counters.rage = 3;
  const before = structuredClone(start), selected = select(start, 'Oleander');
  assert.equal(selected.argonauts[0].name, 'Oleander');
  assert.equal(selected.argonauts[0].argonautDefinitionId, named('Oleander').id);
  assert.deepEqual(stats(selected), { ...zero, Wisdom: 1 });
  assert.deepEqual(selected.argonauts[0].skills, zero);
  assert.deepEqual(selected.argonauts.slice(1), start.argonauts.slice(1));
  assert.deepEqual(selected.argonauts[0].equipment, start.argonauts[0].equipment);
  assert.deepEqual(selected.argonauts[0].tokens, {});
  assert.deepEqual(selected.argonauts[0].counters, start.argonauts[0].counters);
  assert.equal(select(selected, 'Oleander'), selected);
  assert.deepEqual(start, before);
});

test('every named portrait contributes exactly its printed skill, and invalid portraits cannot select', () => {
  for (const card of catalogue.search({ family: 'Argonaut' })) {
    const skill = portraitSkill(card.faces[0]);
    const party = partyReducer(fresh(), request(fresh(), card.id), catalogue);
    if (skill) assert.deepEqual(stats(party), { ...zero, [skill]: 1 }, card.faces[0].name);
    else assert.equal(party.argonauts[0].argonautDefinitionId, null);
  }
  const start = fresh();
  for (const definitionId of ['missing', catalogue.search({ family: 'Gear' })[0].id]) assert.equal(partyReducer(start, request(start, definitionId), catalogue), start);
  assert.equal(partyReducer(start, request(start, named('Oleander').id, 'Oleander', 'missing'), catalogue), start);
  assert.equal(partyReducer(start, request(start, named('Oleander').id)), start);
  const earlier = { ...start, campaignCycle: 3 }; assert.equal(select(earlier, 'Oleander'), earlier);
});

test('changing portraits or selecting a custom name resets all manual stats before applying the new bonus', () => {
  let party = select(fresh(), 'Oleander');
  party = partyReducer(party, { type: 'skill', argonautId: 'a', skill: 'Wisdom', delta: 1 }, catalogue);
  assert.deepEqual(stats(party), { ...zero, Wisdom: 2 });
  party = select(party, 'Fisher');
  assert.deepEqual(stats(party), { ...zero, Cunning: 1 });
  party = partyReducer(party, request(party, null, 'My own Argonaut'), catalogue);
  assert.equal(party.argonauts[0].argonautDefinitionId, null);
  assert.deepEqual(stats(party), zero);
  assert.equal(partyReducer(party, request(party, null, 'Oleander', 'a', { confirmed: false }), catalogue), party);
  const portrait = select(fresh(), 'Oleander');
  const custom = partyReducer(portrait, request(portrait, null, 'Oleander'), catalogue);
  assert.equal(custom.argonauts[0].name, 'Oleander');
  assert.equal(custom.argonauts[0].argonautDefinitionId, null);
  assert.deepEqual(stats(custom), zero);
});

test('portrait and memory bonuses stack and stat controls continue to adjust by one at either bound', () => {
  const memory = catalogue.search({ family: 'Mnemos' }).find(card => card.faces[0].data.stats.includes('Wisdom'));
  let party = select(fresh(), 'Oleander');
  party = partyReducer(party, { type: 'memory', argonautId: 'a', request: { kind: 'mnemos', index: 0, instanceId: 'a:memory', definitionId: memory.id, faceId: 'front' } }, catalogue);
  assert.equal(stats(party).Wisdom, 2);
  party = partyReducer(party, { type: 'skill', argonautId: 'a', skill: 'Wisdom', delta: -1 }, catalogue);
  assert.equal(stats(party).Wisdom, 1);
  party = partyReducer(party, { type: 'remove-memory', argonautId: 'a', kind: 'mnemos', index: 0 }, catalogue);
  assert.equal(stats(party).Wisdom, 0);
  for (let i = 0; i < 12; i++) party = partyReducer(party, { type: 'skill', argonautId: 'a', skill: 'Wisdom', delta: 1 }, catalogue);
  assert.equal(stats(party).Wisdom, 9);
  assert.equal(partyReducer(party, { type: 'skill', argonautId: 'a', skill: 'Wisdom', delta: 1 }, catalogue), party);
  party = partyReducer(party, { type: 'skill', argonautId: 'a', skill: 'Wisdom', delta: -1 }, catalogue);
  assert.equal(stats(party).Wisdom, 8);
  for (let i = 0; i < 22; i++) party = partyReducer(party, { type: 'skill', argonautId: 'a', skill: 'Wisdom', delta: -1 }, catalogue);
  assert.equal(stats(party).Wisdom, -9);
  party = partyReducer(party, { type: 'skill', argonautId: 'a', skill: 'Wisdom', delta: 1 }, catalogue);
  assert.equal(stats(party).Wisdom, -8);
});

test('selected portrait and its derived stats survive backup/restart and advancing the campaign cycle', async () => {
  const party = select(fresh(), 'Oleander');
  const profile = { id: party.id, name: 'Portrait campaign', party };
  const backup = readBackup(exportProfile(profile), catalogue);
  assert.deepEqual(backup.profile, profile);
  assert.deepEqual(argonautSkills(backup.profile.party.argonauts[0], catalogue), stats(party));
  const data = new Map(), storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, runExclusive: async action => action() };
  const store = new SnapshotStore(storage); await store.load();
  await store.save({ format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile] });
  const loaded = await new SnapshotStore(storage).load(); assert.equal(loaded.kind, 'ready');
  assert.deepEqual(loaded.workspace.profiles[0], profile);
  const advanced = partyReducer(party, { type: 'advance-cycle', partyId: party.id, argonautId: 'b', expectedCycle: 4, confirmed: true }, catalogue);
  assert.equal(advanced.campaignCycle, 5);
  assert.deepEqual(stats(advanced), { ...zero, Wisdom: 1 });
  assert.deepEqual(advanced.argonauts, party.argonauts);
});

function progressedParty() {
  let party = select(fresh(), 'Oleander');
  for (const [index, skill] of Object.keys(zero).entries()) {
    for (let count = 0; count < index + 1; count++) party = partyReducer(party, { type: 'skill', argonautId: 'a', skill, delta: index % 2 ? -1 : 1 }, catalogue);
  }
  for (const [kind, family] of [['mnemos', 'Mnemos'], ['fated-mnemos', 'Fated Mnemos']]) {
    const cards = catalogue.search({ family });
    for (let index = 0; index < 2; index++) {
      const instanceId = `a:${kind}:${index}`;
      party = partyReducer(party, { type: 'memory', argonautId: 'a', request: { kind, index, instanceId, definitionId: cards[index].id, faceId: 'front' } }, catalogue);
      for (let node = 0; node < (kind === 'mnemos' ? 7 : 3); node++) party = partyReducer(party, { type: 'memory-node', argonautId: 'a', instanceId, delta: 1 }, catalogue);
    }
  }
  const orphan = catalogue.search({ family: 'Mnemos' })[2];
  party.argonauts[0].instances.push({ id: 'a:orphan-memory', definitionId: orphan.id, faceId: 'front', exhausted: true, enabledEffectIds: [], counters: {}, memoryProgress: { node: 10, growthUnlocked: false } });
  const gear = catalogue.byName('Fists')[0];
  party = partyReducer(party, { type: 'equip', argonautId: 'a', request: { instanceId: 'a:gear', definitionId: gear.id, faceId: 'front', positionId: 'base:hand:0' } }, catalogue);
  party.argonauts[0].equipment[0].attachmentHostId = 'a:orphan-memory';
  party.argonauts[0].tokens = { Ambrosia: 2, Despair: 3, Midas: 1, Pain: 2, Oxygen: 4, Aether: 5, custom: 9 };
  party.argonauts[0].counters.rage = 4;
  party.argonauts[0].localConditions = ['Fear'];
  const fear = catalogue.byName('Fear').find(card => card.family === 'Condition');
  party.argonauts[0].conditions = [{ id: 'a:fear', name: 'Fear', reference: { definitionId: fear.id, faceId: 'front' }, amount: 1, source: 'Attack', duration: 'Until next turn' }];
  party.argonauts[1].tokens = { Despair: 2, Oxygen: 3 };
  party.argonauts[1].localConditions = ['Another condition'];
  party.argonauts[1].conditions = [{ id: 'b:fear', name: 'Fear', reference: { definitionId: fear.id, faceId: 'front' }, amount: 1, source: 'Attack', duration: 'Until next turn' }];
  party.resources.ore = 3;
  return party;
}

test('replacement removes all standard, Fated and unassigned memories and nodes while preserving unrelated state', () => {
  const before = progressedParty(), snapshot = structuredClone(before);
  const next = select(before, 'Fisher'), member = next.argonauts[0];
  assert.deepEqual(member.skills, zero);
  assert.deepEqual(stats(next), { ...zero, Cunning: 1 });
  assert.deepEqual(member.mnemosIds, [null, null]);
  assert.deepEqual(member.fatedMnemosIds, [null, null]);
  assert.deepEqual(member.instances, before.argonauts[0].instances.filter(instance => instance.id === 'a:gear'));
  assert.deepEqual(member.equipment, [{ ...before.argonauts[0].equipment[0], attachmentHostId: null }]);
  assert.deepEqual(member.tokens, {});
  assert.deepEqual(member.localConditions, []);
  assert.deepEqual(member.conditions, []);
  for (const key of ['id', 'colour', 'titan', 'tableOverrides', 'counters']) assert.deepEqual(member[key], before.argonauts[0][key], key);
  assert.deepEqual(next.argonauts.slice(1), before.argonauts.slice(1));
  assert.deepEqual(next.resources, before.resources);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(readBackup(exportProfile({ id: next.id, name: 'Replacement', party: next }), catalogue).profile.party, next);
});

test('confirmation is mandatory and captured campaign/identity guards reject stale replacements without touching progress', () => {
  const party = progressedParty(), action = request(party, named('Fisher').id, 'Fisher');
  for (const changes of [{ confirmed: false }, { confirmed: undefined }, { confirmed: 1 }, { partyId: 'other-campaign' }, { expectedName: 'stale name' }, { expectedDefinitionId: null }]) {
    assert.equal(partyReducer(party, { ...action, ...changes }, catalogue), party);
  }
  assert.equal(select(party, 'Oleander'), party, 'Selecting the same Argonaut cannot reset progress');
  const changed = select(party, 'Raz');
  assert.equal(partyReducer(changed, action, catalogue), changed, 'A dialog for an older identity cannot reset a newer Argonaut');
  const navigated = partyReducer(party, { type: 'select', argonautId: 'b' }, catalogue);
  const next = partyReducer(navigated, action, catalogue);
  assert.equal(next.activeArgonautId, 'b');
  assert.equal(next.argonauts[0].name, 'Fisher');
  assert.deepEqual(next.argonauts[1], party.argonauts[1]);
  const earlier = { ...party, campaignCycle: 1 };
  assert.equal(partyReducer(earlier, request(earlier, named('Dastan').id), catalogue), earlier);
  for (const name of ['', ' ', 'x'.repeat(61)]) assert.equal(partyReducer(party, request(party, null, name), catalogue), party);
});

test('name-only updates preserve portrait bonuses, stats, cards and progress, and reject stale or invalid edits', () => {
  const party = progressedParty();
  party.argonauts[0].localConditions = ['Historical custom condition'];
  party.argonauts[0].combatModifiers = { precision: 2, speed: -1 };
  const original = structuredClone(party);
  const action = { type: 'argonaut-rename', argonautId: 'a', partyId: party.id, expectedName: party.argonauts[0].name,
    expectedDefinitionId: party.argonauts[0].argonautDefinitionId, name: '  New display name  ' };
  const next = partyReducer(party, action, catalogue);
  assert.deepEqual(next.argonauts[0], { ...party.argonauts[0], name: 'New display name' });
  assert.deepEqual(stats(next), stats(party));
  for (const index of [1, 2, 3]) assert.equal(next.argonauts[index], party.argonauts[index]);
  assert.deepEqual(party, original);
  for (const change of [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(61) }, { name: null }, { partyId: 'other' }, { expectedName: 'stale' }, { expectedDefinitionId: null }, { argonautId: 'missing' }]) {
    assert.equal(partyReducer(party, { ...action, ...change }, catalogue), party);
  }
  assert.equal(partyReducer(next, action, catalogue), next);
  assert.equal(partyReducer(next, { ...action, expectedName: next.argonauts[0].name, name: next.argonauts[0].name }, catalogue), next);
  const profile = { id: next.id, name: 'Rename', party: next };
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
});

test('confirmed custom replacement removes memories and resets stats, and the entire replacement survives local restart', async () => {
  const before = progressedParty();
  const next = partyReducer(before, request(before, null, 'My new Argonaut'), catalogue);
  assert.equal(next.argonauts[0].name, 'My new Argonaut');
  assert.equal(next.argonauts[0].argonautDefinitionId, null);
  assert.deepEqual(stats(next), zero);
  assert.deepEqual(next.argonauts[0].mnemosIds, [null, null]);
  assert.deepEqual(next.argonauts[0].fatedMnemosIds, [null, null]);
  assert.equal(next.argonauts[0].instances.length, 1);
  assert.deepEqual(next.argonauts[0].tokens, {});
  assert.deepEqual(next.argonauts[0].localConditions, []);
  assert.deepEqual(next.argonauts[0].conditions, []);
  assert.deepEqual(next.argonauts[1], before.argonauts[1]);
  const data = new Map(), storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, runExclusive: async action => action() };
  const store = new SnapshotStore(storage); await store.load();
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: next.id, profiles: [{ id: next.id, name: 'Replacement', party: next }] };
  await store.save(workspace);
  const loaded = await new SnapshotStore(storage).load();
  assert.equal(loaded.kind, 'ready');
  assert.deepEqual(loaded.workspace, workspace);
});
