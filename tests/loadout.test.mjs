import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { loadoutState, planEquipment, slotOptions } from '../src/domain/loadout.ts';
import { partyReducer } from '../src/state/party-reducer.ts';

const input = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(input);
const named = name => catalogue.byName(name)[0];
const initial = () => createParty('party', ['a', 'b', 'c', 'd'], catalogue.version);
const owner = party => party.argonauts[0];
const positions = (party, kind) => loadoutState(owner(party), catalogue).positions.filter(position => position.kind === kind);
const reduce = (party, action, repo = catalogue) => partyReducer(party, { argonautId: 'a', ...action }, repo);
const equip = (party, name, positionId, instanceId, extra = {}) => reduce(party, { type: 'equip', request: { definitionId: named(name).id, faceId: 'front', positionId, instanceId, ...extra } });
const support = catalogue.search({ family: 'Gear', slot: 'Support' }).find(card => !card.faces[0].slotEffects.length && !card.faces[0].data.traits.includes('Paradox'));
const paradox = catalogue.search({ family: 'Gear', slot: 'Support' }).find(card => card.faces[0].data.traits.includes('Paradox'));
const equipDefinition = (party, card, positionId, instanceId, extra = {}) => reduce(party, { type: 'equip', request: { definitionId: card.id, faceId: 'front', positionId, instanceId, ...extra } });

test('equipping/replacing/removing Armor recalculates capacity without changing another Argonaut', () => {
  const start = initial(), party = equip(start, 'Trireme Breastplate', 'base:armor:0', 'armor');
  assert.equal(positions(party, 'support').length, 3);
  assert.equal(loadoutState(party.argonauts[1], catalogue).positions.filter(p => p.kind === 'support').length, 2);
  const plain = catalogue.search({ family: 'Gear', slot: 'Armor' }).find(card => !card.faces[0].slotEffects.length);
  const replaced = equipDefinition(party, plain, 'base:armor:0', 'replacement');
  assert.equal(positions(replaced, 'support').length, 2);
  assert.ok(!owner(replaced).instances.some(item => item.id === 'armor'));
  const removed = reduce(replaced, { type: 'remove-equipment', instanceId: 'replacement' });
  assert.equal(owner(removed).equipment.length, 0);
  assert.deepEqual(start, initial());
  assert.deepEqual(parseParty(JSON.parse(JSON.stringify(replaced))), replaced);
});

test('loss of an occupied bonus retains the card and independent state for reassignment', () => {
  let party = equip(initial(), 'Trireme Breastplate', 'base:armor:0', 'armor');
  party = equipDefinition(party, support, positions(party, 'support')[2].id, 'extra');
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'extra', exhausted: true });
  party = reduce(party, { type: 'remove-equipment', instanceId: 'armor' });
  const state = loadoutState(owner(party), catalogue);
  assert.equal(state.pending[0].assignment.instanceId, 'extra');
  assert.equal(state.activeInstanceIds.has('extra'), false);
  assert.equal(owner(party).instances.find(item => item.id === 'extra').exhausted, true);
  party = equipDefinition(party, support, 'base:support:0', 'extra', { reuse: true });
  assert.equal(loadoutState(owner(party), catalogue).pending.length, 0);
  assert.equal(owner(party).instances.find(item => item.id === 'extra').exhausted, true);
  parseParty(party);
});

test('restricted slots filter and validate Paradox; explicit overrides record the exception', () => {
  const party = equip(initial(), 'Horseskull Pauldron', 'base:armor:0', 'armor');
  const slot = positions(party, 'support')[2];
  assert.deepEqual(slot.eligibility.requiredTraits, ['Paradox']);
  assert.equal(equipDefinition(party, support, slot.id, 'invalid'), party);
  assert.ok(loadoutState(owner(equipDefinition(party, paradox, slot.id, 'valid')), catalogue).activeInstanceIds.has('valid'));
  const overridden = equipDefinition(party, support, slot.id, 'manual', { overrideReason: 'Campaign exception' });
  assert.equal(owner(overridden).equipment.find(entry => entry.instanceId === 'manual').override.reason, 'Campaign exception');
  assert.ok(loadoutState(owner(overridden), catalogue).activeInstanceIds.has('manual'));
  parseParty(overridden);
});

test('hand spans share one instance and block replacement of unrelated occupied hands', () => {
  let party = equip(initial(), 'Hammer-Sword', 'base:hand:0', 'weapon');
  assert.deepEqual(owner(party).equipment[0].positionIds, ['base:hand:0', 'base:hand:1']);
  party = reduce(party, { type: 'equipment-face', instanceId: 'weapon', faceId: 'back' });
  assert.equal(owner(party).instances[0].faceId, 'back');
  assert.deepEqual(owner(party).equipment[0].positionIds, ['base:hand:0']);
  party = equip(party, 'Hammer-Sword', 'base:hand:1', 'second', { faceId: 'back' });
  assert.equal(equip(party, 'Rebound Hammer', 'base:hand:0', 'big'), party);
  const manual = equip(party, 'Rebound Hammer', 'base:hand:0', 'big', { overrideReason: 'Manual hand capacity exception' });
  assert.ok(owner(manual).instances.some(item => item.id === 'second'));
  assert.equal(owner(manual).equipment.find(entry => entry.instanceId === 'big').positionIds.length, 1);
  assert.ok(loadoutState(owner(manual), catalogue).activeInstanceIds.has('big'));
  assert.equal(slotOptions(named('First Blade').faces[0]).length, 3);
  assert.equal(slotOptions(named('Telemachus Fist').faces[0]).find(option => option.kind === 'attachment').units, 2);
  parseParty(manual);
});

test('two copies keep independent faces, exhaustion and state across navigation', () => {
  const before = JSON.stringify(named('Hammer-Sword'));
  let party = equip(initial(), 'Hammer-Sword', 'base:hand:0', 'first', { faceId: 'back' });
  party = equip(party, 'Hammer-Sword', 'base:hand:1', 'second', { faceId: 'back' });
  // Preserve historical exhaustion saved before costs restricted the action.
  owner(party).instances.find(item => item.id === 'first').exhausted = true;
  party = reduce(party, { type: 'select', argonautId: 'b' });
  party = reduce(party, { type: 'select' });
  assert.equal(owner(party).instances.find(item => item.id === 'first').exhausted, true);
  assert.equal(owner(party).instances.find(item => item.id === 'second').exhausted, false);
  party = reduce(party, { type: 'equipment-face', instanceId: 'first', faceId: 'front' });
  assert.equal(owner(party).instances.find(item => item.id === 'first').faceId, 'front');
  assert.equal(owner(party).instances.find(item => item.id === 'second').faceId, 'back');
  assert.equal(loadoutState(owner(party), catalogue).pending[0].assignment.instanceId, 'first');
  assert.equal(JSON.stringify(named('Hammer-Sword')), before);
});

test('optional grants are explicit, repeat safely and survive serialize/restore without double counting', () => {
  let party = equip(initial(), 'Nosoi Backpack', 'base:armor:0', 'backpack');
  const effect = named('Nosoi Backpack').faces[0].slotEffects[0];
  assert.equal(positions(party, 'hand').length, 2);
  for (let i = 0; i < 3; i++) party = reduce(party, { type: 'equipment-effect', instanceId: 'backpack', effectId: effect.id, enabled: true });
  party = parseParty(JSON.parse(JSON.stringify(party)));
  assert.equal(positions(party, 'hand').length, 3);
  assert.deepEqual(owner(party).instances[0].enabledEffectIds, [effect.id]);
  const bonus = positions(party, 'hand')[2].id;
  party = equip(party, 'Hammer-Sword', bonus, 'extra', { faceId: 'back' });
  party = reduce(party, { type: 'equipment-effect', instanceId: 'backpack', effectId: effect.id, enabled: false });
  assert.equal(positions(party, 'hand').length, 2);
  assert.equal(loadoutState(owner(party), catalogue).pending[0].assignment.instanceId, 'extra');
  party = reduce(party, { type: 'equipment-effect', instanceId: 'backpack', effectId: effect.id, enabled: true });
  assert.ok(loadoutState(owner(party), catalogue).activeInstanceIds.has('extra'));
});

test('attachments equip directly and keep their slot and state when unrelated Gear changes', () => {
  let party = equip(initial(), 'Argocryptex Alpha', 'base:attachment:0', 'attachment');
  assert.ok(loadoutState(owner(party), catalogue).activeInstanceIds.has('attachment'));
  assert.equal(owner(party).equipment[0].attachmentHostId, null);
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'attachment', exhausted: true });
  party = equip(party, 'Hammer-Sword', 'base:hand:0', 'weapon', { faceId: 'back' });
  party = equip(party, 'Hammer-Sword', 'base:hand:0', 'replacement', { faceId: 'back' });
  party = reduce(party, { type: 'remove-equipment', instanceId: 'replacement' });
  assert.deepEqual(owner(party).equipment[0].positionIds, ['base:attachment:0']);
  assert.equal(owner(party).instances.find(item => item.id === 'attachment').exhausted, true);
  assert.equal(loadoutState(owner(party), catalogue).pending.length, 0);
  assert.equal(owner(party).equipment[0].override, undefined);
  assert.equal(owner(party).titan, null);
  assert.equal(owner(party).instances.length, 1);
  parseParty(party);
});

test('Titan attachments equip without selecting a Titan and stay equipped through Titan changes', () => {
  let party = equip(initial(), 'Hermes Gear Mk. I', 'base:attachment:0', 'hermes');
  assert.ok(loadoutState(owner(party), catalogue).activeInstanceIds.has('hermes'));
  const titan = { id: 'titan-a', definitionId: catalogue.search({ family: 'Titan' })[0].id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} };
  party = reduce(party, { type: 'titan', titan });
  party = reduce(party, { type: 'titan', titan: { ...titan, id: 'new-titan-a' } });
  party = reduce(party, { type: 'titan', titan: null });
  assert.equal(loadoutState(owner(party), catalogue).pending.length, 0);
  assert.deepEqual(owner(party).equipment[0].positionIds, ['base:attachment:0']);
  assert.equal(owner(party).equipment[0].attachmentHostId, null);
  parseParty(party);
});

test('legacy Gear and Titan host references clear without moving or resetting attachments', () => {
  for (const hostKind of ['gear', 'titan']) {
    let party = equip(initial(), 'Atlantean Oscillator', 'base:attachment:0', 'attachment');
    if (hostKind === 'gear') party = equip(party, 'Hammer-Sword', 'base:hand:0', 'host', { faceId: 'back' });
    else party = reduce(party, { type: 'titan', titan: { id: 'host', definitionId: catalogue.search({ family: 'Titan' })[0].id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} } });
    const attachment = owner(party).instances.find(item => item.id === 'attachment');
    attachment.exhausted = true; attachment.counters = { charges: 2 };
    owner(party).equipment.find(item => item.instanceId === 'attachment').attachmentHostId = 'host';
    party = parseParty(JSON.parse(JSON.stringify(party)));
    party = reduce(party, hostKind === 'gear' ? { type: 'remove-equipment', instanceId: 'host' } : { type: 'titan', titan: null });
    assert.equal(owner(party).equipment[0].attachmentHostId, null);
    assert.deepEqual(owner(party).equipment[0].positionIds, ['base:attachment:0']);
    assert.equal(loadoutState(owner(party), catalogue).pending.length, 0);
    assert.deepEqual(owner(party).instances.find(item => item.id === 'attachment'), attachment);
    parseParty(party);
  }
});

test('malformed requests, stale bonus slots and cross-Argonaut instance reuse are rejected', () => {
  const start = equip(initial(), 'Trireme Breastplate', 'base:armor:0', 'armor');
  const removed = reduce(start, { type: 'remove-equipment', instanceId: 'armor' });
  assert.equal(equipDefinition(removed, support, positions(start, 'support')[2].id, 'stale'), removed);
  assert.equal(equip(start, 'Trireme Breastplate', 'base:armor:0', 'armor'), start);
  assert.equal(reduce(start, { type: 'equip', argonautId: 'b', request: { definitionId: support.id, faceId: 'front', positionId: 'base:support:0', instanceId: 'armor' } }), start);
  assert.equal(planEquipment(owner(start), { definitionId: support.id, faceId: 'front', positionId: 'missing', instanceId: 'bad' }, catalogue).next, null);
  assert.equal(planEquipment(owner(start), { definitionId: support.id, faceId: 'front', positionId: 'base:support:0', instanceId: 'bad', units: NaN }, catalogue).next, null);
});

test('conditional capacity requires confirmation and cannot activate an invalid or circular source', () => {
  const changed = structuredClone(input), card = changed.cards.find(card => card.id === named('Trireme Breastplate').id);
  const effect = card.faces[0].slotEffects[0];
  effect.conditions = [{ type: 'gate', gate: 'Danger', value: '6+' }];
  const repo = createCatalogueRepository(changed);
  let party = reduce(initial(), { type: 'equip', request: { definitionId: card.id, faceId: 'front', positionId: 'base:armor:0', instanceId: 'armor' } }, repo);
  assert.equal(loadoutState(owner(party), repo).positions.filter(p => p.kind === 'support').length, 2);
  party = reduce(party, { type: 'equipment-effect', instanceId: 'armor', effectId: effect.id, condition: true, enabled: true }, repo);
  assert.equal(loadoutState(owner(party), repo).positions.filter(p => p.kind === 'support').length, 3);
  party = reduce(party, { type: 'equipment-effect', instanceId: 'armor', effectId: effect.id, condition: true, enabled: false }, repo);
  assert.equal(loadoutState(owner(party), repo).positions.filter(p => p.kind === 'support').length, 2);
  parseParty(party);
  const self = { ...owner(party), instances: [{ ...owner(party).instances[0], satisfiedEffectIds: [effect.id] }], equipment: [{ instanceId: 'armor', positionIds: ['bonus:armor:' + encodeURIComponent(effect.id) + ':0'], attachmentHostId: null }] };
  assert.equal(loadoutState(self, repo).positions.filter(p => p.kind === 'support').length, 2);
});

test('dependent grants deactivate transitively when their root position disappears', () => {
  let party = equip(initial(), 'Trireme Breastplate', 'base:armor:0', 'armor');
  party = equip(party, 'Cowl of Shame', positions(party, 'support')[2].id, 'cowl', { overrideReason: 'Support placement exception for capacity-chain review' });
  assert.equal(positions(party, 'support').length, 4);
  party = equipDefinition(party, support, positions(party, 'support')[3].id, 'last');
  party = reduce(party, { type: 'remove-equipment', instanceId: 'armor' });
  assert.equal(positions(party, 'support').length, 2);
  assert.deepEqual(new Set(loadoutState(owner(party), catalogue).pending.map(entry => entry.assignment.instanceId)), new Set(['cowl', 'last']));
  parseParty(party);
});

test('attachments use ordinary replacement and span validation without host requirements', () => {
  let party = equip(initial(), 'Blackburned', 'base:attachment:0', 'black');
  assert.ok(loadoutState(owner(party), catalogue).activeInstanceIds.has('black'));
  assert.equal(owner(party).equipment[0].override, undefined);
  party = equip(party, 'Atlantean Oscillator', 'base:attachment:0', 'new');
  assert.ok(!owner(party).instances.some(item => item.id === 'black'));
  assert.equal(equip(party, 'Hammer-Sword', 'base:attachment:1', 'wrong'), party);
  party = equip(party, 'Telemachus Fist', 'base:attachment:1', 'double');
  assert.deepEqual(owner(party).equipment.find(item => item.instanceId === 'double').positionIds, ['base:attachment:1', 'base:attachment:2']);
  assert.equal(equip(party, 'Telemachus Fist', 'base:attachment:0', 'another-double'), party);
  assert.ok(loadoutState(owner(party), catalogue).activeInstanceIds.has('new'));
  assert.ok(loadoutState(owner(party), catalogue).activeInstanceIds.has('double'));
  assert.equal(owner(party).instances.length, 2);
  assert.equal(loadoutState(party.argonauts[1], catalogue).activeInstanceIds.size, 0);
  parseParty(party);
});
