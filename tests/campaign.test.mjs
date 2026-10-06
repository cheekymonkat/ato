import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { buildIndexes } from '../src/catalogue/normalize.ts';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { campaignCycle, isFaceAvailableInCycle } from '../src/domain/campaign.ts';
import { newProfile, parseWorkspace, exportProfile, readBackup } from '../src/storage/workspace.ts';
import { partyReducer } from '../src/state/party-reducer.ts';

const raw = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(raw);
const numbered = { 'Cycle I': 1, 'Cycle II': 2, 'Cycle III': 3, 'Cycle IV': 4, 'Cycle V': 5 };

test('campaign card availability is cumulative across every catalogue family', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    for (const family of Object.keys(raw.indexes.family)) {
      const expected = raw.cards.filter(card => card.faces.some(face => face.family === family && (!numbered[face.cycle] || numbered[face.cycle] <= cycle)));
      const found = catalogue.search({ family, campaignCycle: cycle });
      assert.deepEqual(found.map(card => card.id).sort(), expected.map(card => card.id).sort(), `${family}: Cycle ${cycle}`);
    }
  }
  const gear3 = catalogue.search({ family: 'Gear', campaignCycle: 3 });
  for (const cycle of ['Cycle I', 'Cycle II', 'Cycle III']) assert.ok(gear3.some(card => card.faces.some(face => face.cycle === cycle)));
  assert.ok(!gear3.some(card => card.faces.some(face => ['Cycle IV', 'Cycle V'].includes(face.cycle))));
});

test('name, printed ID and manual slot searches cannot reveal later-cycle cards', () => {
  for (const family of ['Gear', 'Titan', 'Pattern', 'Mnemos', 'Fated Mnemos', 'Condition', 'Trauma']) {
    const later = catalogue.search({ family, cycle: 'Cycle IV' })[0];
    assert.ok(later, family);
    assert.ok(!catalogue.search({ family, query: later.faces[0].name, campaignCycle: 3 }).some(card => card.id === later.id));
    for (const id of later.printedIds) assert.ok(!catalogue.search({ family, query: id, campaignCycle: 3 }).some(card => card.id === later.id));
    assert.ok(catalogue.search({ family, query: later.faces[0].name, campaignCycle: 4 }).some(card => card.id === later.id));
  }
  assert.deepEqual(catalogue.search({ family: 'Gear', cycle: 'Cycle V', slot: 'Support', campaignCycle: 3 }), []);
});

test('family, slot and campaign limit must match the same face', () => {
  const mixed = structuredClone(raw);
  const card = mixed.cards.find(card => card.family === 'Gear' && card.faces.length === 2);
  card.faces[0].cycle = 'Cycle I'; card.faces[0].data.cycle = 'Cycle I';
  card.faces[1].cycle = 'Cycle V'; card.faces[1].data.cycle = 'Cycle V';
  card.faces[0].data.slot = '1 Hand'; card.faces[1].data.slot = 'Support';
  mixed.indexes = buildIndexes(mixed.cards);
  const repo = createCatalogueRepository(mixed);
  assert.ok(repo.search({ family: 'Gear', campaignCycle: 1 }).some(result => result.id === card.id));
  assert.ok(!repo.search({ family: 'Gear', slot: 'Support', campaignCycle: 1 }).some(result => result.id === card.id));
  assert.ok(repo.search({ family: 'Gear', slot: 'Support', campaignCycle: 5 }).some(result => result.id === card.id));
  assert.equal(isFaceAvailableInCycle(card.faces[0], 1), true);
  assert.equal(isFaceAvailableInCycle(card.faces[1], 1), false);
});

test('non-numbered cards stay available and invalid numbered cycles stay hidden', () => {
  for (const label of ['Tutorial', 'Mnestis Theatre', '']) assert.equal(isFaceAvailableInCycle({ cycle: label }, 1), true);
  for (const label of ['Cycle I', 'Cycle 1', 'cycle iii', ' Cycle III ']) assert.equal(isFaceAvailableInCycle({ cycle: label }, 3), true);
  for (const label of ['Cycle IV', 'Cycle V', 'Cycle VI', 'Cycle 0', 'Cycle 3.5', 'Cycle unknown']) assert.equal(isFaceAvailableInCycle({ cycle: label }, 3), false);
  assert.equal(isFaceAvailableInCycle(undefined, 3), false);
  assert.equal(isFaceAvailableInCycle(null, 3), false);
});

test('new campaigns validate and store their chosen cycle with four independent Argonauts', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    const profile = newProfile(`campaign-${cycle}`, 'Expedition', catalogue.version, cycle);
    assert.equal(campaignCycle(profile.party), cycle);
    assert.equal(profile.party.argonauts.length, 4);
    assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  }
  assert.equal(campaignCycle(newProfile('default', 'Default', catalogue.version).party), 1);
  for (const cycle of [0, 6, 2.5, null, '3']) assert.throws(() => newProfile('invalid', 'Invalid', catalogue.version, cycle), /campaign cycle/);
});

test('campaign creation persists optional inventory tracking independently and enforces the chosen mode immediately', () => {
  const tracked = newProfile('tracked', 'Tracked expedition', catalogue.version, 2, true);
  const untracked = newProfile('untracked', 'Untracked expedition', catalogue.version, 2, false);
  const defaultProfile = newProfile('default', 'Default expedition', catalogue.version);
  assert.deepEqual(tracked.party.inventory, { version: 1, enforce: true, gear: {}, titans: [] });
  assert.equal(untracked.party.inventory, undefined);
  assert.equal(defaultProfile.party.inventory, undefined);
  const card = catalogue.byName('Muck Virus')[0];
  const equip = profile => partyReducer(profile.party, { type: 'equip', argonautId: 'arg-1', request: {
    definitionId: card.id, faceId: 'front', positionId: 'base:attachment:0', instanceId: 'muck',
  } }, catalogue);
  assert.equal(equip(tracked), tracked.party);
  assert.equal(equip(untracked).argonauts[0].instances[0].definitionId, card.id);
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: tracked.id, profiles: [tracked, untracked] };
  assert.deepEqual(parseWorkspace(JSON.parse(JSON.stringify(workspace))), workspace);
  assert.deepEqual(readBackup(exportProfile(tracked), catalogue).profile, tracked);
  const updated = partyReducer(tracked.party, { type: 'inventory-mode', argonautId: 'arg-1', partyId: tracked.id, enabled: false }, catalogue);
  assert.equal(updated.inventory.enforce, false);
  assert.deepEqual(tracked.party.inventory, { version: 1, enforce: true, gear: {}, titans: [] });
  assert.equal(untracked.party.inventory, undefined);
  for (const enabled of [null, 0, 'true']) assert.throws(() => newProfile('invalid', 'Invalid', catalogue.version, 1, enabled), /inventory tracking/);
});

test('advancing a campaign cycle retains all saved cards, counts and other campaigns', () => {
  const one = newProfile('one', 'First campaign', catalogue.version, 4);
  const two = newProfile('two', 'Second campaign', catalogue.version, 2);
  const later = catalogue.search({ family: 'Gear', cycle: 'Cycle V' })[0];
  one.party.argonauts[0].instances.push({ id: 'saved-later-card', definitionId: later.id, faceId: 'front', exhausted: true, enabledEffectIds: [], counters: {} });
  one.party.argonauts[0].tokens.Oxygen = 4;
  const original = structuredClone(one.party), untouched = structuredClone(two);
  const updated = partyReducer(one.party, { type: 'advance-cycle', partyId: one.id, argonautId: one.party.argonauts[2].id, expectedCycle: 4, confirmed: true }, catalogue);
  assert.equal(campaignCycle(updated), 5);
  assert.deepEqual(updated, { ...original, campaignCycle: 5 });
  assert.deepEqual(updated.argonauts, original.argonauts);
  assert.deepEqual(one.party, original);
  assert.deepEqual(two, untouched);
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: one.id, profiles: [{ ...one, party: updated }, two] };
  const restored = parseWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.equal(campaignCycle(restored.profiles[0].party), 5);
  assert.equal(campaignCycle(restored.profiles[1].party), 2);
  assert.deepEqual(restored.profiles[0].party.argonauts, original.argonauts);
});

test('cycle advancement requires confirmation and the captured campaign/cycle, and stops at Cycle 5', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    const party = newProfile('advance', 'Voyage', catalogue.version, cycle).party;
    const action = { type: 'advance-cycle', partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: cycle, confirmed: true };
    for (const invalid of [{ confirmed: false }, { confirmed: undefined }, { confirmed: 'yes' }, { partyId: 'other' }, { argonautId: 'missing' }, { expectedCycle: cycle - 1 }, { expectedCycle: cycle + 1 }, { expectedCycle: String(cycle) }]) {
      assert.equal(partyReducer(party, { ...action, ...invalid }, catalogue), party);
    }
    const next = partyReducer(party, action, catalogue);
    assert.equal(campaignCycle(next), Math.min(5, cycle + 1));
    assert.equal(partyReducer(next, action, catalogue), next, 'Repeated confirmation cannot advance twice');
    if (cycle === 5) assert.equal(next, party);
    for (const destination of [cycle - 1, cycle, cycle + 2]) {
      assert.equal(partyReducer(party, { ...action, type: 'campaign-cycle', cycle: destination }, catalogue), party, 'Old arbitrary cycle edits are rejected');
    }
  }
  const legacy = newProfile('legacy', 'Older save', catalogue.version).party; delete legacy.campaignCycle;
  const advanced = partyReducer(legacy, { type: 'advance-cycle', partyId: legacy.id, argonautId: legacy.activeArgonautId, expectedCycle: 1, confirmed: true });
  assert.equal(campaignCycle(advanced), 2);
});
