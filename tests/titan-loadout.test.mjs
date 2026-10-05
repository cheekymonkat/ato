import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { parseCatalogue } from '../src/catalogue/validate.ts';
import { deriveTitanWeaponRules } from '../src/domain/titan-loadout-rules.ts';
import { titanLoadoutRules } from '../src/domain/hand-rules.ts';
import { loadoutState, planEquipment, slotOptions, removeEquipment, changeEquipmentFace } from '../src/domain/loadout.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { visibleEquipmentPositions } from '../src/dashboard/equipment-positions.ts';
import { equipmentGroupWidths } from '../src/dashboard/equipment-layout.ts';
import { loadoutReview } from '../src/domain/rules-assistance.ts';

const data = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(structuredClone(data));
const named = name => catalogue.byName(name)[0];
const fresh = () => createParty('hands', ['a', 'b', 'c', 'd'], catalogue.version);
const titan = name => ({ id: 'titan-a', definitionId: named(name).id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} });
const owner = name => ({ ...fresh().argonauts[0], titan: titan(name) });
const weapon = catalogue.search({ family: 'Gear', slot: '3 Hands' })[0];
const support = catalogue.search({ family: 'Gear', slot: 'Support' }).find(card => !card.faces[0].slotEffects.length);
function equip(argonaut, card, positionId, id, extra = {}) {
  const result = planEquipment(argonaut, { definitionId: card.id, faceId: 'front', positionId, instanceId: id, ...extra }, catalogue);
  assert.ok(result.next, JSON.stringify(result));
  return result.next;
}
const state = argonaut => loadoutState(argonaut, catalogue);
const count = (argonaut, kind) => state(argonaut).positions.filter(p => p.kind === kind).length;
const visible = argonaut => { const s = state(argonaut); return visibleEquipmentPositions(s.positions, argonaut.equipment, s.activeInstanceIds); };

// Expected outcomes are independently enumerated from the printed keyword definitions.
test('all 44 Titan faces have audited capacity, conversions and weapon restrictions', () => {
  const expected = {
    Gamechanger: [2, 2, [1, 2, 3], 'Unknown Might', 1],
    Warkeeper: [2, 2, [1, 2, 3], 'Cyclopean Might', 0],
    Dawnburner: [2, 2, [1, 2, 3], 'Cyclopean Might', 0],
    Strider: [2, 2, [1, 2, 3], 'Cyclopean Might', 0],
    Helldiver: [2, 2, [1, 2, 3], 'Cyclopean Might', 0],
    Executioner: [2, 2, [1, 2, 3], 'Cyclopean Might', 0],
    Truthbearer: [2, 2, [1, 2, 3], 'Elder Might', 0],
    'Immortal Truthbearer': [2, 2, [1, 2, 3], 'Elder Might', 0],
    Cloudsoarer: [2, 2, [2, 3], 'Lightweight Curse', 0],
    Earthshaker: [3, 2, [1, 2, 3], null, 0],
    Shadowdancer: [3, 2, [1, 2], null, 0],
    Wishender: [4, 2, [1], null, 0],
    'Daredevil Wishender': [4, 2, [1], null, 0],
    Firestarter: [2, 3, [1, 2, 3], null, 0],
  };
  const faces = catalogue.search({ family: 'Titan' }).flatMap(card => card.faces);
  assert.equal(faces.length, 44);
  const seen = new Set();
  for (const face of faces) {
    const [hands, supports, allowed, conversion, penalty] = expected[face.name] ?? [2, 2, [1, 2, 3], null, 0];
    const rules = face.weaponRules;
    assert.ok(rules, face.name);
    assert.deepEqual([rules.handSlots, rules.supportSlots, rules.allowedWeaponHands, rules.conversions[0]?.ability ?? null, rules.conversions[0]?.supportPenalty ?? 0], [hands, supports, allowed, conversion, penalty], face.name);
    assert.deepEqual(rules.alternative, face.name === 'Earthshaker' ? { mode: 'support', handSlots: 2, supportSlots: 3 } : null);
    if (conversion) assert.deepEqual(rules.conversions[0], { printedHands: 3, occupiedHands: 2, supportPenalty: penalty, ability: conversion });
    seen.add(face.name);
  }
  for (const name of Object.keys(expected)) assert.ok(seen.has(name), name);
});

test('stored Titan rules reject corrupt metadata; older catalogues derive compatible rules', () => {
  const bad = structuredClone(data), face = bad.cards.find(card => card.faces[0].name === 'Gamechanger').faces[0];
  face.weaponRules.handSlots = 99;
  assert.throws(() => parseCatalogue(bad), /Titan weapon rules/);
  const legacy = structuredClone(data);
  for (const card of legacy.cards) for (const face of card.faces) delete face.weaponRules;
  const repo = createCatalogueRepository(legacy);
  assert.equal(titanLoadoutRules(owner('Gamechanger'), repo).conversions[0].supportPenalty, 1);
  assert.deepEqual(deriveTitanWeaponRules([{ abilityText: [{ type: 'keyword', value: 'Dual-Wielding' }] }]).conversions, [], 'Dual-Wielding does not grant more hands');
});

test('each unrestricted converter equips a three-handed Weapon in two positions', () => {
  for (const name of ['Gamechanger', 'Warkeeper', 'Dawnburner', 'Strider', 'Helldiver', 'Executioner', 'Truthbearer', 'Immortal Truthbearer', 'Cloudsoarer']) {
    const argonaut = equip(owner(name), weapon, 'base:hand:1', 'weapon');
    assert.deepEqual(argonaut.equipment[0].positionIds, ['base:hand:1', 'base:hand:0']);
    assert.equal(state(argonaut).pending.length, 0, name);
    assert.equal(visible(argonaut).filter(p => p.kind === 'hand').length, 1, name);
    assert.equal(count(argonaut, 'support'), name === 'Gamechanger' ? 1 : 2);
  }
  assert.equal(planEquipment(owner('Mazerunner'), { definitionId: weapon.id, faceId: 'front', positionId: 'base:hand:0', instanceId: 'weapon' }, catalogue).next, null);
});

test('Unknown Might preserves occupied Support, restores it on removal/discard, and combines with Armor grants', () => {
  let argonaut = equip(owner('Gamechanger'), support, 'base:support:0', 'support-a');
  argonaut = equip(argonaut, support, 'base:support:1', 'support-b');
  argonaut = equip(argonaut, named('Trireme Breastplate'), 'base:armor:0', 'armor');
  const bonus = state(argonaut).positions.find(p => p.kind === 'support' && p.source);
  argonaut = equip(argonaut, support, bonus.id, 'support-c');
  const before = JSON.stringify(argonaut);
  const equipped = equip(argonaut, weapon, 'base:hand:0', 'weapon');
  assert.equal(JSON.stringify(argonaut), before);
  assert.equal(count(equipped, 'support'), 2);
  assert.deepEqual(state(equipped).pending.map(p => p.assignment.instanceId), ['support-b']);
  assert.equal(equipped.instances.length, 5, 'No Support is deleted');
  assert.ok(state(equipped).activeInstanceIds.has('support-c'), 'Independent Armor grant remains');
  assert.equal(loadoutReview(equipped, catalogue).capacity.find(row => row.kind === 'support').baseline, 1);
  for (const next of [removeEquipment(equipped, 'weapon'), { ...equipped, instances: equipped.instances.map(item => item.id === 'weapon' ? { ...item, discarded: true } : item) }, { ...equipped, titan: titan('Warkeeper') }]) {
    assert.equal(count(next, 'support'), 3);
    assert.equal(state(next).pending.length, 0);
  }
  const exhausted = { ...equipped, instances: equipped.instances.map(item => item.id === 'weapon' ? { ...item, exhausted: true } : item) };
  assert.equal(count(exhausted, 'support'), 2, 'Exhaustion does not free occupied weapon capacity');
});

test('Unknown Might does not reduce Support for ordinary two-handed, variable or combined-slot Weapons', () => {
  for (const name of ['Hammer-Sword', 'Pantheon', 'Gegenees Pygmachia']) {
    const argonaut = equip(owner('Gamechanger'), named(name), 'base:hand:0', 'weapon', { units: 2 });
    assert.equal(count(argonaut, 'support'), 2, name);
    const options = slotOptions(named(name).faces[0], titanLoadoutRules(argonaut, catalogue));
    assert.equal(options.filter(o => o.units === 2).length, 1, 'No indistinguishable converted option');
  }
});

test('Firestarter equips three Supports and combines Stout with a fourth Support from Armor', () => {
  let argonaut = owner('Firestarter');
  for (let i = 0; i < 3; i++) argonaut = equip(argonaut, support, `base:support:${i}`, `support-${i}`);
  assert.equal(state(argonaut).pending.length, 0);
  assert.deepEqual([...state(argonaut).activeInstanceIds], ['support-0', 'support-1', 'support-2']);
  argonaut = equip(argonaut, named('Trireme Breastplate'), 'base:armor:0', 'armor');
  const bonus = state(argonaut).positions.find(p => p.kind === 'support' && p.source);
  argonaut = equip(argonaut, support, bonus.id, 'fourth-support');
  assert.equal(count(argonaut, 'support'), 4);
  assert.equal(state(argonaut).pending.length, 0);
  assert.equal(loadoutReview(argonaut, catalogue).capacity.find(row => row.kind === 'support').occupied, 4);
  let party = fresh(); party.argonauts[0] = argonaut;
  const restored = parseParty(JSON.parse(JSON.stringify(party))).argonauts[0];
  assert.equal(count(restored, 'support'), 4);
  assert.equal(count({ ...restored, titan: { ...restored.titan, exhausted: true } }, 'support'), 4);
  for (const titanState of [null, titan('Mazerunner'), { ...restored.titan, discarded: true }]) {
    const changed = { ...restored, titan: titanState };
    assert.equal(count(changed, 'support'), 3, 'The Armor grant remains when Stout stops applying');
    assert.deepEqual(state(changed).pending.map(p => p.assignment.instanceId), ['support-2']);
    assert.ok(state(changed).activeInstanceIds.has('fourth-support'));
    assert.equal(changed.instances.length, 5, 'Loss of Stout does not remove any Gear');
    assert.equal(state({ ...changed, titan: restored.titan }).pending.length, 0);
  }
  const noArmor = removeEquipment(restored, 'armor');
  assert.equal(count(noArmor, 'support'), 3);
  assert.deepEqual(state(noArmor).pending.map(p => p.assignment.instanceId), ['fourth-support']);
});

test('Earthshaker Support configuration equips the third and Armor-granted fourth Supports', () => {
  let argonaut = owner('Earthshaker'); argonaut.titan.loadoutMode = 'support';
  for (let i = 0; i < 3; i++) argonaut = equip(argonaut, support, `base:support:${i}`, `support-${i}`);
  argonaut = equip(argonaut, named('Trireme Breastplate'), 'base:armor:0', 'armor');
  const bonus = state(argonaut).positions.find(p => p.kind === 'support' && p.source);
  argonaut = equip(argonaut, support, bonus.id, 'fourth-support');
  assert.equal(count(argonaut, 'support'), 4);
  assert.equal(state(argonaut).pending.length, 0);
  const weaponsMode = { ...argonaut, titan: { ...argonaut.titan, loadoutMode: 'weapons' } };
  assert.equal(count(weaponsMode, 'support'), 3);
  assert.deepEqual(state(weaponsMode).pending.map(p => p.assignment.instanceId), ['support-2']);
  assert.ok(state(weaponsMode).activeInstanceIds.has('fourth-support'));
  assert.equal(state({ ...weaponsMode, titan: argonaut.titan }).pending.length, 0);
});

test('Earthshaker has three weapon positions or three Supports, with a persistent owner-qualified choice', () => {
  let party = fresh(); party.argonauts[0].titan = titan('Earthshaker');
  party.argonauts[0] = equip(party.argonauts[0], weapon, 'base:hand:0', 'weapon');
  assert.equal(count(party.argonauts[0], 'hand'), 3);
  assert.equal(count(party.argonauts[0], 'support'), 2);
  assert.equal(visible(party.argonauts[0]).filter(p => p.kind === 'hand').length, 1);
  const others = JSON.stringify(party.argonauts.slice(1));
  const action = { type: 'titan-loadout-mode', argonautId: 'a', instanceId: 'titan-a', mode: 'support' };
  const switched = partyReducer(party, action, catalogue);
  assert.equal(count(switched.argonauts[0], 'hand'), 2);
  assert.equal(count(switched.argonauts[0], 'support'), 3);
  assert.deepEqual(state(switched.argonauts[0]).pending.map(p => p.assignment.instanceId), ['weapon']);
  assert.equal(visible(switched.argonauts[0]).filter(p => p.kind === 'hand').length, 2, 'Pending weapon must not hide free positions');
  assert.equal(JSON.stringify(switched.argonauts.slice(1)), others);
  assert.deepEqual(parseParty(JSON.parse(JSON.stringify(switched))), switched);
  const restored = partyReducer(switched, { ...action, mode: 'weapons' }, catalogue);
  assert.equal(state(restored.argonauts[0]).pending.length, 0);
  assert.equal(partyReducer(restored, { ...action, instanceId: 'stale' }, catalogue), restored);
  assert.equal(partyReducer(restored, { ...action, mode: 'invalid' }, catalogue), restored);
  const invalid = structuredClone(restored); invalid.argonauts[0].titan.loadoutMode = 'invalid';
  assert.throws(() => parseParty(invalid), /loadout mode/);
  const ordinary = fresh(); ordinary.argonauts[0].titan = titan('Mazerunner');
  assert.equal(partyReducer(ordinary, action, catalogue), ordinary);
});

test('Wishender, Shadowdancer and Cloudsoarer enforce their printed weapon restrictions', () => {
  const one = named('Hammer-Sword').faces[1], two = named('Hammer-Sword').faces[0];
  for (const name of ['Wishender', 'Daredevil Wishender']) {
    const argonaut = owner(name), rules = titanLoadoutRules(argonaut, catalogue);
    assert.equal(count(argonaut, 'hand'), 4);
    assert.equal(slotOptions(one, rules).length, 1);
    assert.equal(slotOptions(two, rules).length, 0);
    assert.equal(slotOptions(weapon.faces[0], rules).length, 0);
    assert.equal(slotOptions(named('The Manticore').faces[0], rules)[0].review, true, 'Three single-handed Weapons are not a single three-handed Weapon');
    let equipped = argonaut;
    for (let i = 0; i < 4; i++) equipped = equip(equipped, named('Hammer-Sword'), `base:hand:${i}`, `sword-${i}`, { faceId: 'back' });
    assert.equal(state(equipped).pending.length, 0);
    assert.equal(visible(equipped).filter(p => p.kind === 'hand').length, 4);
    assert.equal(planEquipment(argonaut, { definitionId: named('Hammer-Sword').id, faceId: 'front', positionId: 'base:hand:0', instanceId: 'invalid', units: 2 }, catalogue).next, null);
  }
  const shadow = owner('Shadowdancer');
  assert.equal(count(shadow, 'hand'), 3);
  assert.equal(slotOptions(weapon.faces[0], titanLoadoutRules(shadow, catalogue)).length, 0);
  assert.equal(slotOptions(two, titanLoadoutRules(shadow, catalogue)).length, 1);
  const cloud = owner('Cloudsoarer');
  assert.equal(slotOptions(one, titanLoadoutRules(cloud, catalogue)).length, 0);
  assert.equal(slotOptions(two, titanLoadoutRules(cloud, catalogue)).length, 1);
  assert.equal(count(owner('Firestarter'), 'support'), 3);
});

test('Titan changes, discard and exhaustion revalidate capacity without losing Gear', () => {
  const earth = equip(owner('Earthshaker'), weapon, 'base:hand:0', 'weapon');
  for (const titanState of [null, titan('Mazerunner'), { ...earth.titan, discarded: true }]) {
    const next = { ...earth, titan: titanState };
    assert.equal(count(next, 'hand'), 2);
    assert.equal(state(next).pending.length, 1);
    assert.equal(next.instances.length, 1);
  }
  assert.equal(count({ ...earth, titan: { ...earth.titan, exhausted: true } }, 'hand'), 3);
  const fist = equip(owner('Mazerunner'), named('Hammer-Sword'), 'base:hand:0', 'fist', { faceId: 'back' });
  assert.equal(state({ ...fist, titan: titan('Cloudsoarer') }).pending.length, 1);
});

test('multi-hand presentation restores empty positions after flips/removal and retains other slots and grants', () => {
  let argonaut = equip(owner('Mazerunner'), named('Nosoi Backpack'), 'base:armor:0', 'backpack');
  argonaut.instances[0].enabledEffectIds = [named('Nosoi Backpack').faces[0].slotEffects[0].id];
  argonaut = equip(argonaut, named('Hammer-Sword'), 'base:hand:1', 'hammer');
  assert.equal(count(argonaut, 'hand'), 3);
  const before = JSON.stringify(argonaut), slots = visible(argonaut);
  assert.equal(slots.filter(p => p.kind === 'hand').length, 2, 'One Weapon and one empty bonus hand');
  assert.equal(slots.filter(p => p.kind !== 'hand').length, state(argonaut).positions.filter(p => p.kind !== 'hand').length);
  assert.equal(JSON.stringify(argonaut), before);
  const flipped = changeEquipmentFace(argonaut, 'hammer', 'back', catalogue);
  assert.equal(visible(flipped).filter(p => p.kind === 'hand').length, 3);
  assert.equal(visible(removeEquipment(argonaut, 'hammer')).filter(p => p.kind === 'hand').length, 3);
  for (const flag of ['exhausted', 'discarded']) {
    const modified = { ...argonaut, instances: argonaut.instances.map(item => item.id === 'hammer' ? { ...item, [flag]: true } : item) };
    assert.equal(visible(modified).filter(p => p.kind === 'hand').length, 2);
  }
  // Groups use the displayed count, so hidden occupied positions do not reserve blank card width.
  const counts = [['hand', 'armor'], ['support'], ['attachment']].map(kinds => slots.filter(p => kinds.includes(p.kind)).length);
  assert.deepEqual(counts, [3, 2, 3]);
  for (const width of [320, 768, 1200, 2400]) assert.equal(equipmentGroupWidths(width, counts).length, 3);
});
