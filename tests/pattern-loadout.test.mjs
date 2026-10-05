import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { parseCatalogue } from '../src/catalogue/validate.ts';
import { extractSlotEffects } from '../src/catalogue/effects.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { loadoutState, planEquipment } from '../src/domain/loadout.ts';
import { assignedPatternSources } from '../src/domain/references.ts';
import { assignedGateCards, loadoutReview } from '../src/domain/rules-assistance.ts';
import { combatAdjustments } from '../src/domain/combat-modifiers.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { meetsSlotRestriction, slotRestrictionLabel } from '../src/domain/slots.ts';
import { positionFromRoute, positionRouteParam } from '../src/loadout/position-params.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';
import { SnapshotStore } from '../src/storage/snapshots.ts';

const raw = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(structuredClone(raw));
const named = name => catalogue.byName(name)[0];
const reference = name => ({ definitionId: named(name).id, faceId: 'front' });
const item = name => ({ ...reference(name), id: 'titan-a', exhausted: false, enabledEffectIds: [], counters: {} });
const fresh = () => ({ ...createParty('patterns', ['a', 'b', 'c', 'd'], catalogue.version), campaignCycle: 4 });
const choose = (party, kind, name, id = 'a') => partyReducer(party, { type: 'table-override', argonautId: id, kind, reference: name ? reference(name) : null }, catalogue);
const state = owner => loadoutState(owner, catalogue);
const count = (owner, kind) => state(owner).positions.filter(p => p.kind === kind).length;
const supports = catalogue.search({ family: 'Gear', slot: 'Support' }).filter(card => !card.faces[0].slotEffects.length).slice(0, 5);
const threeHanded = catalogue.search({ family: 'Gear', slot: '3 Hands' })[0];
function equip(owner, card, positionId, instanceId, extra = {}) {
  const result = planEquipment(owner, { definitionId: card.id, faceId: 'front', positionId, instanceId, ...extra }, catalogue);
  assert.ok(result.next, JSON.stringify(result));
  return result.next;
}

// Current Pattern capacity effects are enumerated independently from their printed abilities.
test('Pattern catalogue captures Support Specialization and the restricted Djinnian weapon position', () => {
  const effects = catalogue.search({ family: 'Pattern' }).flatMap(card => card.faces.flatMap(face => face.slotEffects.map(effect => ({ face, effect }))));
  assert.deepEqual(effects.map(({ face }) => face.name).sort(), ['Djinnian Strain', 'Support Specialization']);
  for (const { face, effect } of effects) {
    assert.equal(effect.amount, 1);
    assert.equal(effect.activation, 'automatic');
    assert.equal(effect.source.definitionId, named(face.name).id);
    assert.equal(effect.source.faceId, 'front');
    assert.ok(effect.source.pointer.endsWith('/abilities/0/abilityText'));
    assert.deepEqual(effect.source.tokens, face.data.abilities[0].abilityText);
    if (face.name === 'Support Specialization') {
      assert.equal(effect.slot, 'support'); assert.equal(effect.eligibility, null);
    } else {
      assert.equal(effect.slot, 'hand');
      assert.deepEqual(effect.eligibility, { family: 'Gear', requiredTraits: [], forbiddenWeaponHands: [3] });
    }
  }
  const unsafe = structuredClone(named('Support Specialization').faces[0]);
  unsafe.data.abilities[0].costs = ['Exhaust'];
  assert.equal(extractSlotEffects(unsafe, 'unsafe').effects.length, 0, 'Triggered costs do not become permanent capacity');
});

test('Support Pattern stacks with Firestarter and Armor; all five positions can be equipped', () => {
  let party = choose(fresh(), 'Trauma', 'Support Specialization');
  assert.equal(count(party.argonauts[0], 'support'), 3);
  assert.equal(party.argonauts[0].instances.length, 0, 'Selected references do not create saved Gear instances');
  party.argonauts[0].titan = item('Firestarter');
  let owner = equip(party.argonauts[0], named('Trireme Breastplate'), 'base:armor:0', 'armor');
  assert.equal(count(owner, 'support'), 5);
  const positions = state(owner).positions.filter(p => p.kind === 'support');
  for (let i = 0; i < positions.length; i++) owner = equip(owner, supports[i], positions[i].id, `support-${i}`);
  assert.equal(state(owner).pending.length, 0);
  const review = loadoutReview(owner, catalogue).capacity.find(row => row.kind === 'support');
  assert.equal(review.baseline, 3); assert.equal(review.occupied, 5);
  assert.deepEqual(review.grants.map(p => catalogue.getFace(p.source.definitionId, p.source.faceId).name), ['Support Specialization', 'Trireme Breastplate']);
  for (const other of party.argonauts.slice(1)) assert.equal(count(other, 'support'), 2);
});

test('changing/removing a Support Pattern preserves occupied Gear and restoring it revalidates the placement', () => {
  let party = choose(fresh(), 'Trauma', 'Support Specialization');
  const bonus = state(party.argonauts[0]).positions.find(p => p.source?.referenceKind === 'Trauma');
  party.argonauts[0] = equip(party.argonauts[0], supports[0], bonus.id, 'extra');
  party.argonauts[0].instances[0].exhausted = true;
  for (const replacement of [null, 'Aegisbred']) {
    const changed = choose(party, 'Trauma', replacement);
    assert.equal(count(changed.argonauts[0], 'support'), 2);
    assert.deepEqual(state(changed.argonauts[0]).pending.map(p => p.assignment.instanceId), ['extra']);
    assert.equal(changed.argonauts[0].instances[0].exhausted, true);
    const restored = choose(changed, 'Trauma', 'Support Specialization');
    assert.equal(state(restored.argonauts[0]).pending.length, 0);
    assert.equal(state(restored.argonauts[0]).positions.find(p => p.source?.referenceKind).id, bonus.id);
  }
  party.argonauts[0].titan = item('Mazerunner');
  assert.equal(state(party.argonauts[0]).pending.length, 0, 'Titan changes retain selected Patterns');
  const missing = structuredClone(party); missing.argonauts[0].tableOverrides.trauma.definitionId = 'missing';
  assert.equal(count(missing.argonauts[0], 'support'), 2);
  assert.equal(state(missing.argonauts[0]).pending.length, 1);
  const incompatible = structuredClone(party); incompatible.argonauts[0].tableOverrides.trauma = reference('Chronian Strain');
  assert.deepEqual(assignedPatternSources(incompatible.argonauts[0], catalogue), []);
});

test('Pattern sources are stable across backup, local restart, repeated selection and bonus-slot routes', async () => {
  let party = choose(fresh(), 'Trauma', 'Support Specialization');
  const bonus = state(party.argonauts[0]).positions.find(p => p.source?.referenceKind);
  party.argonauts[0] = equip(party.argonauts[0], supports[0], bonus.id, 'extra');
  for (let i = 0; i < 3; i++) party = choose(party, 'Trauma', 'Support Specialization');
  assert.equal(count(party.argonauts[0], 'support'), 3);
  const profile = { id: party.id, name: 'Patterns', party };
  const restored = readBackup(exportProfile(profile), catalogue).profile;
  assert.deepEqual(restored, profile);
  assert.equal(state(parseParty(JSON.parse(JSON.stringify(party))).argonauts[0]).pending.length, 0);
  const data = new Map(), storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, runExclusive: task => task() };
  const store = new SnapshotStore(storage); await store.load();
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile] };
  await store.save(workspace);
  const resumed = (await new SnapshotStore(storage).load()).workspace.profiles[0].party.argonauts[0];
  assert.equal(state(resumed).pending.length, 0);
  assert.equal(positionFromRoute(state(resumed).positions, decodeURIComponent(positionRouteParam(bonus.id))).id, bonus.id);
  assert.equal(positionFromRoute(state(resumed).positions, decodeURIComponent(bonus.id)).id, bonus.id);
});

test('Djinnian Strain accepts one/two-handed Weapons but never supplies a third hand to a three-handed Weapon', () => {
  const party = choose(fresh(), 'Trauma', 'Djinnian Strain'), owner = party.argonauts[0];
  owner.titan = item('Mazerunner');
  const bonus = state(owner).positions.find(p => p.source?.referenceKind);
  assert.equal(count(owner, 'hand'), 3);
  assert.equal(slotRestrictionLabel(bonus.eligibility), 'Excludes 3-handed Weapons');
  const one = equip(owner, named('Hammer-Sword'), bonus.id, 'sword', { faceId: 'back' });
  assert.equal(state(one).pending.length, 0);
  const two = equip(owner, named('Hammer-Sword'), bonus.id, 'hammer');
  assert.equal(state(two).pending.length, 0);
  assert.equal(meetsSlotRestriction(threeHanded.faces[0], bonus), false);
  const request = { definitionId: threeHanded.id, faceId: 'front', positionId: 'base:hand:0', instanceId: 'three' };
  assert.equal(planEquipment(owner, request, catalogue).next, null);
  const cyclopean = { ...owner, titan: item('Warkeeper') };
  assert.ok(planEquipment(cyclopean, request, catalogue).next, 'Titan conversion can use the two ordinary hand positions');
  assert.equal(planEquipment(cyclopean, { ...request, positionId: bonus.id }, catalogue).next, null, 'Conversion does not remove the Pattern slot restriction');
});

test('Djinnian restriction respects mixed and grouped single-handed requirements and other unrestricted grants', () => {
  const party = choose(fresh(), 'Trauma', 'Djinnian Strain');
  let owner = party.argonauts[0];
  const bonus = state(owner).positions.find(p => p.source?.referenceKind);
  const pantheon = named('Pantheon').faces[0];
  assert.equal(meetsSlotRestriction(pantheon, bonus, 2), true);
  assert.equal(meetsSlotRestriction(pantheon, bonus, 3), false);
  assert.equal(meetsSlotRestriction(named('The Manticore').faces[0], bonus, 3), true, 'Grouped single-handed Weapons are distinct from a three-handed Weapon');
  owner = equip(owner, named('Nosoi Backpack'), 'base:armor:0', 'backpack');
  owner.instances[0].enabledEffectIds = [named('Nosoi Backpack').faces[0].slotEffects[0].id];
  const equipped = equip(owner, threeHanded, 'base:hand:0', 'three');
  assert.equal(equipped.equipment.find(entry => entry.instanceId === 'three').positionIds.includes(bonus.id), false, 'Placement skips the restricted slot when another suitable hand is available');
  assert.equal(state(equipped).pending.length, 0);
});

test('new restriction metadata rejects malformed numbers without affecting existing eligibility', () => {
  for (const forbidden of [[0], [-1], ['3'], [1.5], null]) {
    const input = structuredClone(raw), effect = input.cards.find(card => card.faces[0].name === 'Djinnian Strain').faces[0].slotEffects[0];
    effect.eligibility.forbiddenWeaponHands = forbidden;
    assert.throws(() => parseCatalogue(input), /weapon hand restriction/);
  }
});

test('Chronian Strain contributes Speed at Rage 7+, relocks, stacks and stays isolated to its owner', () => {
  let party = choose(fresh(), 'Kratos', 'Chronian Strain');
  party.argonauts[0].titan = item('Mazerunner'); party.argonauts[1].titan = { ...item('Mazerunner'), id: 'titan-b' };
  let owner = party.argonauts[0];
  const speed = owner => combatAdjustments(owner, catalogue).get(named('Mazerunner').faces[0]).speed;
  for (const rage of [6, 7, 8, 6]) {
    owner.counters.rage = rage;
    assert.equal(speed(owner).delta, rage >= 7 ? 1 : 0);
  }
  owner.counters.rage = 7; owner.combatModifiers = { precision: 0, speed: 2 };
  owner = equip(owner, named('Spherical Armor'), 'base:armor:0', 'armor');
  assert.equal(speed(owner).delta, 4);
  assert.ok(speed(owner).contributions.some(c => c.source === 'Chronian Strain' && c.amount === 1));
  assert.equal(speed(party.argonauts[1]).delta, 0);
  assert.equal(assignedGateCards(owner, catalogue).find(entry => entry.face.name === 'Chronian Strain').gates[0].value, '7+');
  party.argonauts[0] = owner;
  assert.equal(speed(choose(party, 'Kratos', null).argonauts[0]).delta, 3);
  for (const pattern of ['Polemarchos', 'Heavy-Gear Training', 'Mazewalker', 'Promethean Strain']) {
    const next = choose(choose(party, 'Kratos', null), named(pattern).faces[0].data.patternType, pattern).argonauts[0];
    assert.equal(speed(next).delta, 3, 'Conditional prose, penalty choices and active costs stay manual');
  }
});
