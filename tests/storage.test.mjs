import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { loadoutState } from '../src/domain/loadout.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { parseParty } from '../src/domain/party.ts';
import { supportsPattern } from '../src/domain/references.ts';
import { acknowledgeCatalogueUpdate, exportProfile, importProfile, newProfile, parseWorkspace, readBackup, referenceProblems } from '../src/storage/workspace.ts';
import { CURRENT_KEY, PREVIOUS_KEY, SnapshotStore } from '../src/storage/snapshots.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => { const profile = newProfile('p', 'Expedition', catalogue.version); return { format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile] }; };
const named = name => catalogue.byName(name)[0];
const change = (workspace, name) => ({ ...workspace, profiles: workspace.profiles.map(profile => ({ ...profile, name })) });
class MemoryStorage {
  data = new Map(); writes = []; failKey = null; readError = false; lock = Promise.resolve();
  async getItem(key) { if (this.readError) throw new Error('Storage unavailable'); return this.data.get(key) ?? null; }
  async setItem(key, value) { this.writes.push(key); if (key === this.failKey) throw new Error('Write interrupted'); this.data.set(key, value); }
  runExclusive(task) { const result = this.lock.then(task, task); this.lock = result.catch(() => {}); return result; }
}
const readyStore = async () => { const storage = new MemoryStorage(), store = new SnapshotStore(storage); assert.equal((await store.load()).kind, 'empty'); return { storage, store }; };

function complexParty() {
  let party = fresh().profiles[0].party;
  const reduce = (owner, action) => { party = partyReducer(party, { argonautId: owner, ...action }, catalogue); };
  const equip = (owner, name, positionId, id, extra = {}) => reduce(owner, { type: 'equip', request: { definitionId: named(name).id, faceId: 'front', positionId, instanceId: id, ...extra } });
  for (const [index, member] of party.argonauts.entries()) {
    reduce(member.id, { type: 'argonaut-change', name: `Navigator ${index + 1}`, definitionId: null, confirmed: true, partyId: party.id, expectedName: member.name, expectedDefinitionId: member.argonautDefinitionId });
    reduce(member.id, { type: 'colour', colour: ['#347C7A', '#806191', '#626976', '#B46A3C'][index] });
    for (let i = 0; i <= index; i++) reduce(member.id, { type: 'skill', skill: 'Courage', delta: 1 });
    reduce(member.id, { type: 'counter', counter: 'danger', value: index + 3 });
    reduce(member.id, { type: 'titan', titan: { id: `${member.id}-titan`, definitionId: catalogue.search({ family: 'Titan' })[index].id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: { wounds: index } } });
    equip(member.id, 'Hammer-Sword', 'base:hand:0', `${member.id}-weapon`, { faceId: 'back' });
    reduce(member.id, { type: 'equipment-exhausted', instanceId: `${member.id}-weapon`, exhausted: index % 2 === 0 });
    equip(member.id, 'Atlantean Oscillator', 'base:attachment:0', `${member.id}-attachment`);
  }
  equip('arg-1', 'Nosoi Backpack', 'base:armor:0', 'backpack');
  const effect = named('Nosoi Backpack').faces[0].slotEffects[0].id;
  reduce('arg-1', { type: 'equipment-effect', instanceId: 'backpack', effectId: effect, enabled: true });
  equip('arg-2', 'Horseskull Pauldron', 'base:armor:0', 'pauldron');
  const restricted = loadoutState(party.argonauts[1], catalogue).positions.filter(position => position.kind === 'support')[2];
  const paradox = catalogue.search({ family: 'Gear', slot: 'Support' }).find(card => card.faces[0].data.traits.includes('Paradox'));
  reduce('arg-2', { type: 'equip', request: { definitionId: paradox.id, faceId: 'front', positionId: restricted.id, instanceId: 'restricted' } });
  equip('arg-3', 'Trireme Breastplate', 'base:armor:0', 'trireme');
  const bonus = loadoutState(party.argonauts[2], catalogue).positions.filter(position => position.kind === 'support')[2];
  const support = catalogue.search({ family: 'Gear', slot: 'Support' }).find(card => !card.faces[0].slotEffects.length);
  reduce('arg-3', { type: 'equip', request: { definitionId: support.id, faceId: 'front', positionId: bonus.id, instanceId: 'pending' } });
  reduce('arg-3', { type: 'remove-equipment', instanceId: 'trireme' });
  equip('arg-4', 'Hammer-Sword', 'base:support:0', 'exception', { faceId: 'back', overrideReason: 'Tabletop exception' });
  party.order.reverse(); party.activeArgonautId = 'arg-3'; party.resources = { ambrosia: 7 };
  party.argonauts[0].localConditions = ['Manual condition']; party.argonauts[0].tokens = { poison: 2 };
  party.argonauts[0].instances[0].counters = { charges: 3 };
  party.argonauts[0].instances.find(item => item.id === 'backpack').satisfiedEffectIds = [effect];
  for (const [family, key, id] of [['Mnemos', 'mnemosIds', 'memory'], ['Fated Mnemos', 'fatedMnemosIds', 'fated']]) {
    party.argonauts[3].instances.push({ id, definitionId: catalogue.search({ family })[0].id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: { node: 2 }, memoryProgress: { node: 2, growthUnlocked: family === 'Fated Mnemos' } });
    party.argonauts[3][key] = [id];
  }
  for (const kind of ['Trauma', 'Kratos']) {
    const card = catalogue.search({ family: 'Pattern' }).find(card => supportsPattern(card.faces[0], kind));
    reduce('arg-4', { type: 'table-override', kind, reference: { definitionId: card.id, faceId: 'front' } });
  }
  return party;
}

function legacyParty() {
  const party = complexParty(); party.saveSchemaVersion = 1;
  for (const member of party.argonauts) {
    delete member.tableOverrides;
    member.mnemosIds = member.mnemosIds.filter(Boolean); member.fatedMnemosIds = member.fatedMnemosIds.filter(Boolean);
    for (const instance of member.instances) delete instance.memoryProgress;
  }
  return party;
}

test('discarded Gear, memories and Titans survive local restart, backup and import independently', async () => {
  const party = complexParty();
  const targets = [party.argonauts[0].instances[0], party.argonauts[3].instances.find(item => item.id === 'memory'), party.argonauts[1].titan];
  for (const item of targets) Object.assign(item, { discarded: true, exhausted: false });
  const profile = { id: party.id, name: 'Discard round trip', party };
  const backup = readBackup(exportProfile(profile), catalogue);
  assert.deepEqual(backup.profile, profile);
  const workspace = { ...fresh(), profiles: [profile] }, { storage, store } = await readyStore();
  await store.save(workspace);
  const restored = await new SnapshotStore(storage).load();
  assert.equal(restored.kind, 'ready');
  assert.deepEqual(restored.workspace, workspace);
  const imported = importProfile(fresh(), backup.profile, 'discard-import', 'Imported discard');
  assert.deepEqual(imported.profiles.at(-1).party.argonauts, party.argonauts);
});

test('complete four-Argonaut backup and local restart restore state and recompute capacity', async () => {
  const party = complexParty(), profile = { id: party.id, name: 'Round trip', party };
  const catalogueBefore = JSON.stringify(named('Hammer-Sword'));
  const backup = readBackup(exportProfile(profile), catalogue);
  assert.deepEqual(backup.profile, profile);
  const workspace = { ...fresh(), profiles: [profile] }, { storage, store } = await readyStore();
  await store.save(workspace);
  const restored = await new SnapshotStore(storage).load();
  assert.equal(restored.kind, 'ready'); assert.deepEqual(restored.workspace, workspace);
  assert.equal(loadoutState(restored.workspace.profiles[0].party.argonauts[0], catalogue).positions.filter(p => p.kind === 'hand').length, 3);
  const restriction = loadoutState(party.argonauts[1], catalogue).positions.filter(p => p.kind === 'support')[2];
  assert.deepEqual(restriction.eligibility.requiredTraits, ['Paradox']);
  assert.equal(loadoutState(party.argonauts[2], catalogue).pending[0].assignment.instanceId, 'pending');
  assert.equal(JSON.stringify(named('Hammer-Sword')), catalogueBefore);
});

test('import is a new independent profile, preserving the source, current party and full instance state', () => {
  const workspace = fresh(), before = structuredClone(workspace), source = readBackup(exportProfile({ id: 'p', name: 'Source', party: complexParty() }), catalogue).profile;
  const next = importProfile(workspace, source, 'new', 'Imported');
  assert.deepEqual(workspace, before); assert.deepEqual(next.profiles[0], before.profiles[0]);
  assert.equal(next.activeProfileId, 'new'); assert.equal(next.profiles[1].party.id, 'new'); assert.equal(source.party.id, 'p');
  assert.deepEqual(next.profiles[1].party.argonauts, source.party.argonauts);
  assert.throws(() => importProfile(workspace, source, 'p', 'Duplicate'), /already exists/);
});

test('standalone schema-1 parties migrate explicitly and future schemas fail without modifying input', () => {
  const party = legacyParty(), before = structuredClone(party), migrated = parseWorkspace(party), expected = parseParty(party);
  assert.deepEqual(migrated.profiles[0].party, expected); assert.equal(migrated.activeProfileId, party.id);
  assert.equal(expected.saveSchemaVersion, 2); assert.deepEqual(expected.argonauts[3].mnemosIds, ['memory', null]);
  assert.deepEqual(expected.argonauts[3].instances.find(item => item.id === 'memory').memoryProgress, { node: 2, growthUnlocked: false });
  assert.deepEqual(expected.argonauts[3].instances.find(item => item.id === 'fated').memoryProgress, { node: 2, growthUnlocked: false });
  assert.deepEqual(readBackup(JSON.stringify(party), catalogue).profile.party, expected);
  assert.deepEqual(party, before);
  assert.throws(() => parseWorkspace({ ...fresh(), schemaVersion: 99 }), /Unsupported/);
  assert.throws(() => readBackup(JSON.stringify({ ...party, saveSchemaVersion: 99 }), catalogue), /Unsupported/);
});

test('invalid JSON, incomplete parties, duplicate profiles, invalid colours and oversized backups cannot import', () => {
  const original = fresh(), before = structuredClone(original);
  for (const malformed of ['{', '{}', JSON.stringify({ ...original.profiles[0].party, argonauts: [] })]) assert.throws(() => readBackup(malformed, catalogue));
  const broken = complexParty(); broken.argonauts[0].colour = 'red';
  assert.throws(() => readBackup(JSON.stringify(broken), catalogue), /colour/);
  assert.throws(() => parseWorkspace({ ...original, profiles: [original.profiles[0], original.profiles[0]] }), /Duplicate/);
  assert.throws(() => readBackup('é'.repeat(3 * 1024 * 1024), catalogue), /5 MB/);
  assert.deepEqual(original, before);
});

test('all missing card, face and effect references are reported; local restore preserves them', async () => {
  const party = complexParty(); party.argonauts[0].argonautDefinitionId = 'absent-argonaut';
  party.argonauts[0].instances[0].definitionId = 'absent-gear';
  party.argonauts[1].instances.find(item => item.id === 'pauldron').enabledEffectIds = ['absent-effect'];
  const oneFace = catalogue.search({ family: 'Gear' }).find(card => card.faces.length === 1);
  party.argonauts[2].instances[0].definitionId = oneFace.id; party.argonauts[2].instances[0].faceId = 'back';
  const problems = referenceProblems(party, catalogue).join('\n');
  for (const text of ['absent-argonaut', 'absent-gear', 'absent-effect', 'missing back face']) assert.match(problems, new RegExp(text));
  assert.throws(() => readBackup(JSON.stringify(party), catalogue), /absent-gear[\s\S]*absent-effect/);
  const { storage, store } = await readyStore(); await store.save({ ...fresh(), profiles: [{ id: party.id, name: 'Unresolved', party }] });
  const restored = await new SnapshotStore(storage).load(); assert.deepEqual(restored.workspace.profiles[0].party, party);
});

test('a catalogue version difference is reported without rewriting the saved version', () => {
  const party = complexParty(); party.catalogueVersion = 'older';
  const result = readBackup(JSON.stringify(party), catalogue);
  assert.equal(result.warnings.length, 1); assert.equal(result.profile.party.catalogueVersion, 'older');
});

test('acknowledging a catalogue update preserves all progress and other campaigns, and survives restart and backup', async () => {
  const workspace = fresh(), party = complexParty(); party.catalogueVersion = 'older';
  workspace.profiles[0].party = party;
  workspace.profiles.push(newProfile('other', 'Another campaign', 'another-version'));
  const before = structuredClone(workspace);
  const next = acknowledgeCatalogueUpdate(workspace, 'p', 'older', catalogue);
  const expected = structuredClone(before); expected.profiles[0].party.catalogueVersion = catalogue.version;
  assert.deepEqual(next, expected); assert.deepEqual(workspace, before);
  assert.equal(next.profiles[1], workspace.profiles[1]);
  assert.equal(acknowledgeCatalogueUpdate(next, 'p', catalogue.version, catalogue), next);
  const backup = readBackup(exportProfile(next.profiles[0]), catalogue);
  assert.deepEqual(backup.warnings, []);
  const { storage, store } = await readyStore(); await store.save(next);
  assert.deepEqual((await new SnapshotStore(storage).load()).workspace, next);
});

test('acknowledgement rejects stale campaign/version callbacks and unresolved saved cards without modifying records', () => {
  const workspace = fresh(); workspace.profiles[0].party = complexParty(); workspace.profiles[0].party.catalogueVersion = 'older';
  workspace.profiles.push(newProfile('other', 'Other', 'older'));
  const before = structuredClone(workspace);
  assert.throws(() => acknowledgeCatalogueUpdate(workspace, 'other', 'older', catalogue), /campaign changed/);
  assert.throws(() => acknowledgeCatalogueUpdate(workspace, 'absent', 'older', catalogue), /campaign changed/);
  assert.throws(() => acknowledgeCatalogueUpdate(workspace, 'p', 'stale', catalogue), /notice changed/);
  assert.deepEqual(workspace, before);
  workspace.profiles[0].party.argonauts[0].instances[0].definitionId = 'missing-card';
  const unresolved = structuredClone(workspace);
  assert.throws(() => acknowledgeCatalogueUpdate(workspace, 'p', 'older', catalogue), /Resolve the listed saved card issues/);
  assert.deepEqual(workspace, unresolved);
});

test('ordered writes capture data immediately and keep the most recent successful snapshot', async () => {
  const { storage, store } = await readyStore(); const original = fresh(); await store.save(original);
  let release, started; const blocked = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const setItem = storage.setItem.bind(storage); let first = true;
  storage.setItem = async (key, raw) => { if (first) { first = false; started(); await gate; } await setItem(key, raw); };
  const older = change(original, 'First'), newer = change(original, 'Second');
  const firstWrite = store.save(older); await blocked; const secondWrite = store.save(newer);
  newer.profiles[0].name = 'Mutated after request'; release(); await Promise.all([firstWrite, secondWrite]);
  assert.equal(JSON.parse(storage.data.get(CURRENT_KEY)).profiles[0].name, 'Second');
  assert.deepEqual(JSON.parse(storage.data.get(PREVIOUS_KEY)), older);
});

test('interrupted current write keeps the original party and previous snapshot, and can retry', async () => {
  const { storage, store } = await readyStore(), original = fresh(); await store.save(original);
  storage.failKey = CURRENT_KEY; const next = change(original, 'New');
  await assert.rejects(store.save(next), /interrupted/);
  assert.deepEqual(JSON.parse(storage.data.get(CURRENT_KEY)), original); assert.deepEqual(JSON.parse(storage.data.get(PREVIOUS_KEY)), original);
  storage.failKey = null; await store.save(next); assert.deepEqual(JSON.parse(storage.data.get(CURRENT_KEY)), next);
});

test('failed recovery snapshot write prevents overwriting the current save', async () => {
  const { storage, store } = await readyStore(), original = fresh(); await store.save(original);
  storage.failKey = PREVIOUS_KEY;
  await assert.rejects(store.save(change(original, 'New')), /interrupted/);
  assert.deepEqual(JSON.parse(storage.data.get(CURRENT_KEY)), original);
});

test('corrupt primary requires explicit recovery and preserves the readable previous snapshot', async () => {
  const { storage, store } = await readyStore(), original = fresh(); await store.save(original); await store.save(change(original, 'Later'));
  storage.data.set(CURRENT_KEY, '{torn write'); const restarted = new SnapshotStore(storage), result = await restarted.load();
  assert.equal(result.kind, 'recovery'); assert.deepEqual(result.previous, original);
  assert.equal(storage.data.get(CURRENT_KEY), '{torn write');
  await restarted.save(result.previous); assert.deepEqual(JSON.parse(storage.data.get(CURRENT_KEY)), original);
  assert.deepEqual(JSON.parse(storage.data.get(PREVIOUS_KEY)), original);
});

test('missing primary, unreadable storage and invalid previous snapshots never silently start fresh', async () => {
  const storage = new MemoryStorage(); storage.data.set(PREVIOUS_KEY, JSON.stringify(fresh()));
  assert.equal((await new SnapshotStore(storage).load()).kind, 'recovery');
  storage.data.set(PREVIOUS_KEY, '{'); assert.equal((await new SnapshotStore(storage).load()).kind, 'recovery');
  storage.readError = true; const store = new SnapshotStore(storage);
  assert.equal((await store.load()).kind, 'recovery'); await assert.rejects(store.save(fresh()), /Read local storage/);
});

test('an acknowledged-late write retries safely without replacing its previous snapshot', async () => {
  const { storage, store } = await readyStore(), original = fresh(); await store.save(original);
  const setItem = storage.setItem.bind(storage); let fail = true;
  storage.setItem = async (key, raw) => { await setItem(key, raw); if (key === CURRENT_KEY && fail) { fail = false; throw new Error('Acknowledgement lost'); } };
  const next = change(original, 'Next'); await assert.rejects(store.save(next), /Acknowledgement/); await store.save(next);
  assert.deepEqual(JSON.parse(storage.data.get(CURRENT_KEY)), next); assert.deepEqual(JSON.parse(storage.data.get(PREVIOUS_KEY)), original);
});

test('stale sessions and simultaneous locked writers cannot replace another session’s newer party', async () => {
  const { storage, store } = await readyStore(), original = fresh(); await store.save(original);
  const second = new SnapshotStore(storage); await second.load();
  const outcomes = await Promise.allSettled([store.save(change(original, 'Winner')), second.save(change(original, 'Stale'))]);
  assert.equal(outcomes[0].status, 'fulfilled'); assert.equal(outcomes[1].status, 'rejected');
  assert.match(outcomes[1].reason.message, /Another tab/);
  assert.equal(JSON.parse(storage.data.get(CURRENT_KEY)).profiles[0].name, 'Winner');
  assert.deepEqual(JSON.parse(storage.data.get(PREVIOUS_KEY)), original);
});

test('multiple profiles and last active party survive a local restart without cross-profile changes', async () => {
  const { storage, store } = await readyStore(); let workspace = fresh();
  const party = complexParty(); workspace = importProfile(workspace, { id: 'p', name: 'Source', party }, 'second', 'Second');
  await store.save(workspace); const result = await new SnapshotStore(storage).load();
  assert.deepEqual(result.workspace, workspace); assert.equal(result.workspace.activeProfileId, 'second');
  assert.deepEqual(result.workspace.profiles[0], fresh().profiles[0]);
  const writes = storage.writes.length; await store.save(workspace); assert.equal(storage.writes.length, writes);
});

test('a torn primary write recovers from the untouched successful party on restart', async () => {
  const { storage, store } = await readyStore(), original = fresh(); await store.save(original);
  const setItem = storage.setItem.bind(storage);
  storage.setItem = async (key, raw) => {
    if (key === CURRENT_KEY) { storage.data.set(key, raw.slice(0, 40)); throw new Error('Process interrupted'); }
    await setItem(key, raw);
  };
  await assert.rejects(store.save(change(original, 'Interrupted')), /interrupted/);
  const result = await new SnapshotStore(storage).load();
  assert.equal(result.kind, 'recovery'); assert.deepEqual(result.previous, original);
});

test('local legacy migration preserves the raw previous save and unsupported primaries require recovery', async () => {
  const storage = new MemoryStorage(), party = legacyParty(), expected = parseParty(party), legacy = JSON.stringify(party);
  storage.data.set(CURRENT_KEY, legacy);
  const store = new SnapshotStore(storage), result = await store.load();
  assert.equal(result.kind, 'ready'); assert.deepEqual(result.workspace.profiles[0].party, expected);
  await store.save(result.workspace); assert.equal(storage.data.get(PREVIOUS_KEY), legacy);
  storage.data.set(CURRENT_KEY, JSON.stringify({ ...result.workspace, schemaVersion: 99 }));
  const recovery = await new SnapshotStore(storage).load();
  assert.equal(recovery.kind, 'recovery'); assert.deepEqual(recovery.previous.profiles[0].party, expected);
  assert.equal(JSON.parse(storage.data.get(CURRENT_KEY)).schemaVersion, 99);
});

test('version-1 parties inside profile and backup envelopes migrate without losing other state', async () => {
  const party = legacyParty(), expected = parseParty(party), profile = { id: party.id, name: 'Legacy campaign', party };
  const workspace = { ...fresh(), profiles: [profile] }, before = structuredClone(workspace);
  const parsed = parseWorkspace(workspace);
  assert.deepEqual(parsed.profiles[0].party, expected); assert.deepEqual(workspace, before);
  const backup = JSON.stringify({ format: 'ato-party-backup', backupVersion: 1, profile });
  assert.deepEqual(readBackup(backup, catalogue).profile.party, expected);
  assert.equal(JSON.parse(exportProfile(profile)).profile.party.saveSchemaVersion, 2);
  const storage = new MemoryStorage(), raw = JSON.stringify(workspace); storage.data.set(CURRENT_KEY, raw);
  const store = new SnapshotStore(storage), loaded = await store.load();
  assert.deepEqual(loaded.workspace, parsed); await store.save(loaded.workspace);
  assert.equal(storage.data.get(PREVIOUS_KEY), raw); assert.deepEqual(JSON.parse(storage.data.get(CURRENT_KEY)), parsed);
  assert.equal(loaded.workspace.profiles[0].name, profile.name);
  assert.deepEqual(expected.order, party.order); assert.equal(expected.activeArgonautId, party.activeArgonautId);
  for (let index = 0; index < 4; index++) {
    const old = party.argonauts[index], current = expected.argonauts[index];
    for (const field of ['name', 'colour', 'skills', 'equipment', 'titan', 'counters', 'tokens', 'localConditions']) assert.deepEqual(current[field], old[field]);
    assert.deepEqual(current.tableOverrides, { trauma: null, kratos: null });
  }
});
