import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { assignedGateCards, cardGates, checkGate, gateValues, loadoutReview, skillBreakdown } from '../src/domain/rules-assistance.ts';
import { titanHandRule } from '../src/domain/hand-rules.ts';
import { argonautSkills } from '../src/domain/argonaut-stats.ts';
import { portraitSkill } from '../src/domain/argonaut-identity.ts';
import { loadoutState, planEquipment, slotOptions } from '../src/domain/loadout.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';
import { SnapshotStore } from '../src/storage/snapshots.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => createParty('rules', ['a', 'b', 'c', 'd'], catalogue.version);
const counters = { rage: 5, fate: 7, danger: 3 };
const named = name => catalogue.byName(name)[0];
const instance = (name, id) => ({ id, definitionId: named(name).id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} });
const reduce = (party, action) => partyReducer(party, { argonautId: 'a', ...action }, catalogue);
function addGear(argonaut, name, id, positionIds) {
  const item = instance(name, id);
  argonaut.instances.push(item);
  argonaut.equipment.push({ instanceId: id, positionIds, attachmentHostId: null });
  return item;
}

test('Triskelion gates track below, at and above each explicit threshold without changing counters', () => {
  for (const [type, key] of [['Rage', 'rage'], ['Fate', 'fate'], ['Danger', 'danger']]) {
    for (const current of [4, 5, 6]) assert.equal(checkGate({ type, value: '5+' }, { ...counters, [key]: current }).status, current >= 5 ? 'met' : 'unmet');
  }
  assert.equal(checkGate({ type: 'Danger', value: '9+' }, { ...counters, danger: 10 }).status, 'met');
  assert.deepEqual(counters, { rage: 5, fate: 7, danger: 3 });
});

test('unsupported quantities, bare numbers, malformed counts and incomplete combinations require review', () => {
  for (const gate of [{ type: 'Ambrosia', value: '3+' }, { type: 'Condition', value: 'Bravery' }, { type: 'Rage', value: '5' },
    { type: 'Danger', value: 'X+' }, { type: 'Rage', value: '1.5+' }, { type: 'Rage', value: '-1+' },
    { type: 'Rage', value: '5+', type2: 'Fate', combo: '&' }, { type: 'Rage', value: '5+', combo: 'OR' },
    { type: 'Rage', value: '5+', type2: 'Fate', value2: '7+', combo: '???' }]) assert.equal(checkGate(gate, counters).status, 'review');
  for (const rage of [NaN, Infinity, -1, 1.5, '5']) assert.equal(checkGate({ type: 'Rage', value: '1+' }, { ...counters, rage }).status, 'review');
});

test('AND and OR preserve uncertainty while recognizing logically sufficient known requirements', () => {
  const gate = { type: 'Rage', value: '5+', type2: 'Fate', value2: '8+', combo: 'OR' };
  assert.equal(checkGate(gate, counters).status, 'met');
  assert.equal(checkGate({ ...gate, combo: 'AND' }, counters).status, 'unmet');
  assert.equal(checkGate({ ...gate, combo: '&', value2: '7+' }, counters).status, 'met');
  assert.equal(checkGate({ ...gate, value: '6+' }, counters).status, 'unmet');
  assert.equal(checkGate({ ...gate, type2: 'Ambrosia' }, counters).status, 'met');
  assert.equal(checkGate({ ...gate, type2: 'Ambrosia', value: '6+' }, counters).status, 'review');
  assert.equal(checkGate({ ...gate, type2: 'Ambrosia', combo: 'AND' }, counters).status, 'review');
  assert.equal(checkGate({ ...gate, type2: 'Ambrosia', value: '6+', combo: 'AND' }, counters).status, 'unmet');
});

test('gate collection includes nested stat and ability gates and keeps ambiguous printed values', () => {
  const base = named('Hammer-Sword').faces[0];
  const face = { ...base, data: { ...base.data, offensiveStatistics: { power: [{ gate: { type: 'Rage', value: '5+' } }] },
    defensiveStatistics: [{ gate: { type: 'Danger', value: '7+' } }], gatedAbilities: [{ gate: 'Fate', value: '6+', abilities: [{ gate: 'Condition', value: 'Bravery' }] }],
    abilities: [{ gate: 'Rage', value: '5+' }, { gate: 'Rage', value: '5' }] } };
  assert.deepEqual(new Set(cardGates(face).map(gate => `${gate.type}:${gate.value}`)), new Set(['Rage:5+', 'Danger:7+', 'Fate:6+', 'Condition:Bravery', 'Rage:5']));
});

test('the campaign preference defaults off, rejects stale campaigns and invalid values, and changes no gameplay state', () => {
  const party = fresh(), action = { type: 'rules-assistance', partyId: party.id, enabled: true };
  assert.equal(party.rulesAssistance, undefined);
  const enabled = reduce(party, action);
  assert.equal(enabled.rulesAssistance, true);
  assert.equal(enabled.argonauts, party.argonauts); assert.equal(enabled.resources, party.resources);
  assert.equal(reduce(enabled, action), enabled);
  assert.equal(reduce(party, { ...action, partyId: 'other' }), party);
  assert.equal(reduce(party, { ...action, enabled: 'yes' }), party);
  assert.equal(partyReducer(party, { ...action, argonautId: 'missing' }, catalogue), party);
  assert.equal(reduce(enabled, { ...action, enabled: false }).rulesAssistance, false);
  assert.throws(() => parseParty({ ...party, rulesAssistance: 1 }), /rules assistance/);
  assert.deepEqual(parseParty(party), party);
});

test('rules preference survives JSON backup and local restart, with no stored or re-applied gate effects', async () => {
  const party = reduce(fresh(), { type: 'rules-assistance', partyId: 'rules', enabled: true });
  const profile = { id: party.id, name: 'Rules round trip', party };
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  const data = new Map(), storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, runExclusive: task => task() };
  const store = new SnapshotStore(storage); await store.load();
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile] };
  await store.save(workspace);
  const restored = await new SnapshotStore(storage).load();
  assert.equal(restored.kind, 'ready'); assert.deepEqual(restored.workspace, workspace);
});

test('modifier breakdown agrees with dashboard through memory removal, Fated resolution and display bounds', () => {
  const argonaut = fresh().argonauts[0];
  const portrait = catalogue.search({ family: 'Argonaut' }).find(card => portraitSkill(card.faces[0]) === 'Courage');
  assert.ok(portrait); argonaut.argonautDefinitionId = portrait.id;
  const mnemos = catalogue.search({ family: 'Mnemos' }).find(card => card.faces[0].data.stats.includes('Courage'));
  const fated = catalogue.search({ family: 'Fated Mnemos' }).find(card => card.faces[0].data.stats.includes('Courage'));
  assert.ok(mnemos && fated);
  argonaut.instances = [instance(mnemos.faces[0].name, 'memory'), instance(fated.faces[0].name, 'fated')];
  // Use exact definitions when names have several printings.
  argonaut.instances[0].definitionId = mnemos.id; argonaut.instances[1].definitionId = fated.id;
  argonaut.instances[1].memoryProgress = { node: 2, growthUnlocked: false };
  argonaut.mnemosIds[0] = 'memory'; argonaut.fatedMnemosIds[0] = 'fated'; argonaut.skills.Courage = 9;
  const row = () => skillBreakdown(argonaut, catalogue).find(value => value.skill === 'Courage');
  assert.equal(row().memories, 0); assert.equal(row().portrait, 1);
  argonaut.instances[1].memoryProgress.node = 3;
  assert.equal(row().memories, 1); assert.equal(row().total, 9); assert.ok(row().raw > row().total);
  argonaut.mnemosIds[0] = null; assert.equal(row().memories, 0);
  argonaut.instances[1].memoryProgress.node = 2; argonaut.skills.Courage = -10;
  assert.equal(row().memories, -1); assert.equal(row().raw, -10); assert.equal(row().total, -9);
  for (const item of skillBreakdown(argonaut, catalogue)) assert.equal(item.total, argonautSkills(argonaut, catalogue)[item.skill]);
});

test('loadout review explains bonus sources, duplicate Support and pending placements without removing cards', () => {
  let party = fresh();
  const equip = (card, positionId, id) => { party = reduce(party, { type: 'equip', request: { definitionId: card.id, faceId: 'front', positionId, instanceId: id } }); };
  equip(named('Trireme Breastplate'), 'base:armor:0', 'armor');
  const support = catalogue.search({ family: 'Gear', slot: 'Support' }).find(card => !card.faces[0].slotEffects.length);
  equip(support, 'base:support:0', 'one'); equip(support, 'base:support:1', 'two');
  const bonus = loadoutState(party.argonauts[0], catalogue).positions.find(position => position.kind === 'support' && position.source);
  equip(support, bonus.id, 'three');
  const argonaut = party.argonauts[0], snapshot = JSON.stringify(argonaut), result = loadoutReview(argonaut, catalogue);
  assert.deepEqual(result.capacity.find(row => row.kind === 'support').grants.map(p => p.source.instanceId), ['armor']);
  assert.equal(result.capacity.find(row => row.kind === 'support').occupied, 3);
  assert.ok(result.notices.some(notice => notice.code === 'duplicate-support'));
  assert.equal(JSON.stringify(argonaut), snapshot);
  party = reduce(party, { type: 'remove-equipment', instanceId: 'armor' });
  assert.ok(loadoutReview(party.argonauts[0], catalogue).notices.some(notice => notice.code === 'pending' && notice.instanceIds.includes('three')));
  assert.ok(party.argonauts[0].instances.some(item => item.id === 'three'));
});

test('verified Titan hand rules offer two-hand placement for three-handed Weapons and track Titan changes', () => {
  const weapon = catalogue.search({ family: 'Gear', slot: '3 Hands' })[0]; assert.ok(weapon);
  for (const rule of ['Cyclopean Might', 'Elder Might']) {
    const titan = catalogue.search({ family: 'Titan' }).find(card => card.faces[0].data.abilities.some(a => a.abilityText?.some(t => t.value === rule)));
    assert.ok(titan);
    let party = fresh(); party.argonauts[0].titan = { ...instance(titan.faces[0].name, 'titan'), definitionId: titan.id };
    const owner = party.argonauts[0];
    assert.equal(titanHandRule(owner, catalogue), rule);
    assert.deepEqual(slotOptions(weapon.faces[0], rule).map(option => option.units), [2, 3]);
    const request = { definitionId: weapon.id, faceId: 'front', positionId: 'base:hand:0', instanceId: 'weapon' };
    const plan = planEquipment(owner, request, catalogue);
    assert.ok(plan.next); assert.equal(plan.next.equipment[0].positionIds.length, 2);
    party.argonauts[0] = plan.next; const before = JSON.stringify(party.argonauts[1]);
    const changed = reduce(party, { type: 'titan', titan: instance('Gamechanger', 'other-titan') });
    assert.ok(changed.argonauts[0].instances.some(item => item.id === 'weapon'));
    assert.equal(loadoutState(changed.argonauts[0], catalogue).pending.length, 1);
    assert.equal(JSON.stringify(changed.argonauts[1]), before);
    const discarded = { ...owner, titan: { ...owner.titan, discarded: true } };
    assert.equal(titanHandRule(discarded, catalogue), null);
    assert.equal(titanHandRule({ ...owner, titan: { ...owner.titan, exhausted: true } }, catalogue), rule);
  }
});

test('Unknown Might identifies its Support trade-off without applying an incomplete hand rule', () => {
  const argonaut = fresh().argonauts[0]; argonaut.titan = instance('Gamechanger', 'gamechanger');
  assert.equal(titanHandRule(argonaut, catalogue), null);
  assert.equal(loadoutReview(argonaut, catalogue).unknownMight, true);
  assert.equal(loadoutReview(argonaut, catalogue).capacity.find(row => row.kind === 'support').available, 2);
});

test('trait gates count equipped cards once, including the gated card, rather than their occupied positions', () => {
  const argonaut = fresh().argonauts[0], gate = { type: 'Labyrinth', value: '2+' };
  assert.equal(checkGate(gate, gateValues(argonaut, catalogue)).status, 'unmet');
  addGear(argonaut, 'Mazed Cestus', 'two-hands', ['base:hand:0', 'base:hand:1']);
  assert.equal(gateValues(argonaut, catalogue).traits.Labyrinth, 1);
  assert.equal(checkGate(gate, gateValues(argonaut, catalogue)).status, 'unmet');
  addGear(argonaut, 'Mazegma', 'support', ['base:support:0']);
  const before = JSON.stringify(argonaut), context = gateValues(argonaut, catalogue);
  assert.equal(context.traits.Labyrinth, 2); assert.equal(checkGate(gate, context).status, 'met');
  assert.match(checkGate(gate, context).explanation, /equipped Gear with Labyrinth: 2/);
  assert.equal(JSON.stringify(argonaut), before);
});

test('trait gates react to exhaustion, reversible discard, face changes, removal and lost occupied grants', () => {
  const argonaut = fresh().argonauts[0], item = addGear(argonaut, 'Temenos Scale Shield', 'shield', ['base:hand:0']);
  const count = () => gateValues(argonaut, catalogue).traits.Labyrinth;
  assert.equal(count(), 1); item.exhausted = true; assert.equal(count(), 1);
  item.exhausted = false; item.discarded = true; assert.equal(count(), 0);
  item.discarded = false; assert.equal(count(), 1);
  item.faceId = 'back'; assert.equal(count(), 0);
  item.faceId = 'front'; assert.equal(count(), 1);
  argonaut.equipment = []; assert.equal(count(), 0);
  let party = fresh();
  const equip = (name, positionId, id) => { party = reduce(party, { type: 'equip', request: { definitionId: named(name).id, faceId: 'front', positionId, instanceId: id } }); };
  equip('Trireme Breastplate', 'base:armor:0', 'armor');
  const bonus = loadoutState(party.argonauts[0], catalogue).positions.find(p => p.kind === 'support' && p.source);
  equip('Mazegma', bonus.id, 'extra'); assert.equal(gateValues(party.argonauts[0], catalogue).traits.Labyrinth, 1);
  party = reduce(party, { type: 'remove-equipment', instanceId: 'armor' });
  assert.equal(gateValues(party.argonauts[0], catalogue).traits.Labyrinth, 0);
  assert.ok(party.argonauts[0].instances.some(item => item.id === 'extra'));
});

test('token gates use personal token counts and zero defaults even when the same name is a Gear trait', () => {
  const argonaut = fresh().argonauts[0]; addGear(argonaut, 'Nosoi Backpack', 'armor', ['base:armor:0']);
  assert.equal(gateValues(argonaut, catalogue).traits.Ambrosia, 1);
  assert.equal(checkGate({ type: 'Ambrosia', value: '1+' }, gateValues(argonaut, catalogue)).status, 'unmet');
  for (const token of ['Ambrosia', 'Despair', 'Bleeding', 'Midas', 'Pain', 'Oxygen', 'Aether']) {
    for (const count of [2, 3, 4]) {
      argonaut.tokens[token] = count;
      assert.equal(checkGate({ type: token, value: '3+' }, gateValues(argonaut, catalogue)).status, count >= 3 ? 'met' : 'unmet');
    }
    argonaut.tokens[token] = 2;
    assert.equal(checkGate({ type: token, value: '3+' }, gateValues(argonaut, catalogue)).status, 'unmet');
  }
  assert.match(checkGate({ type: 'Bleeding', value: '2+' }, gateValues(argonaut, catalogue)).explanation, /Bleeding tokens: 2/);
  argonaut.tokens.Ambrosia = -1;
  assert.equal(checkGate({ type: 'Ambrosia', value: '1+' }, gateValues(argonaut, catalogue)).status, 'review');
});

test('mixed token, trait and Triskelion combinations use each branch’s own recorded quantity', () => {
  const argonaut = fresh().argonauts[0];
  addGear(argonaut, 'Mazed Cestus', 'weapon', ['base:hand:0', 'base:hand:1']);
  argonaut.tokens.Ambrosia = 2;
  const gate = { type: 'Danger', value: '7+', combo: 'OR', type2: 'Ambrosia', value2: '2+' };
  assert.equal(checkGate(gate, gateValues(argonaut, catalogue)).status, 'met');
  assert.equal(checkGate({ ...gate, type2: 'Labyrinth', value2: '2+' }, gateValues(argonaut, catalogue)).status, 'unmet');
  argonaut.counters.danger = 7;
  assert.equal(checkGate({ ...gate, combo: 'AND' }, gateValues(argonaut, catalogue)).status, 'met');
  assert.equal(checkGate({ ...gate, combo: 'AND', type2: 'Energy' }, gateValues(argonaut, catalogue)).status, 'review');
});

test('gate values remain isolated between Argonauts and ignore unassigned Gear', () => {
  const party = fresh(), a = party.argonauts[0], b = party.argonauts[1];
  addGear(a, 'Mazegma', 'a-support', ['base:support:0']); a.tokens.Bleeding = 3;
  b.instances.push(instance('Mazegma', 'unassigned'));
  assert.equal(gateValues(a, catalogue).traits.Labyrinth, 1);
  assert.equal(gateValues(b, catalogue).traits.Labyrinth, 0);
  assert.equal(checkGate({ type: 'Bleeding', value: '3+' }, gateValues(a, catalogue)).status, 'met');
  assert.equal(checkGate({ type: 'Bleeding', value: '3+' }, gateValues(b, catalogue)).status, 'unmet');
});

test('assigned Titan and Mnemos gates are listed, while future memory panels stay hidden until their nodes unlock', () => {
  const argonaut = fresh().argonauts[0]; argonaut.titan = instance('Philoctera', 'titan');
  const memory = { ...instance('Dogma', 'memory'), memoryProgress: { node: 0, growthUnlocked: false } };
  argonaut.instances.push(memory); argonaut.mnemosIds[0] = memory.id;
  argonaut.instances.push(instance('Mazegma', 'unassigned'));
  const memoryGates = () => assignedGateCards(argonaut, catalogue).find(entry => entry.instance.id === 'memory').gates;
  assert.equal(memoryGates().length, 1);
  const titan = assignedGateCards(argonaut, catalogue).find(entry => entry.instance.id === 'titan');
  assert.equal(titan.face.family, 'Titan'); assert.equal(titan.gates[0].value, '2+');
  assert.equal(checkGate(titan.gates[0], gateValues(argonaut, catalogue)).status, 'unmet');
  argonaut.counters.danger = 2;
  assert.equal(checkGate(titan.gates[0], gateValues(argonaut, catalogue)).status, 'met');
  memory.memoryProgress.node = 3; assert.equal(memoryGates().length, 2);
  assert.equal(checkGate(memoryGates()[1], gateValues(argonaut, catalogue)).status, 'unmet');
  memory.memoryProgress.node = 7; assert.equal(memoryGates().length, 3);
  memory.memoryProgress.node = 2; assert.equal(memoryGates().length, 1);
  assert.ok(!assignedGateCards(argonaut, catalogue).some(entry => entry.instance.id === 'unassigned'));
});

test('Fated gate collection follows the visible front or Growth ability rather than disclosing the other side', () => {
  const base = catalogue.search({ family: 'Fated Mnemos' })[0].faces[0];
  const face = { ...base, data: { ...base.data, effect: [{ gate: 'Danger', value: '1+', abilityText: [] }], growthAbility: [{ gate: 'Ambrosia', value: '2+', abilityText: [] }] } };
  assert.deepEqual(cardGates(face, { node: 2, growthUnlocked: false }).map(gate => gate.type), ['Danger']);
  assert.deepEqual(cardGates(face, { node: 3, growthUnlocked: false }).map(gate => gate.type), ['Ambrosia']);
});
