import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { deriveCapacity, DEFAULT_BASELINE, findAssignmentsNeedingReassignment, meetsSlotRestriction } from '../src/domain/slots.ts';

const catalogue = JSON.parse(await readFile(new URL('../data/generated/catalogue.json', import.meta.url), 'utf8'));
const repository = createCatalogueRepository(catalogue);
const gear = name => repository.byName(name).find(card => card.family === 'Gear');
const instance = (definition, id) => ({ id, definitionId: definition.id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} });
const newParty = () => createParty('party-1', ['arg-1', 'arg-2', 'arg-3', 'arg-4'], repository.version);

test('four Argonauts have independent data, saved colours, order and active selection', () => {
  const party = newParty();
  party.argonauts[0].colour = '#123ABC'; party.argonauts[0].skills.Courage = 5;
  party.argonauts[0].counters.rage = 4; party.argonauts[0].localConditions.push('Bleeding');
  party.argonauts[0].tokens.Ambrosia = 2;
  const item = instance(gear('Trireme Breastplate'), 'item-1');
  party.argonauts[0].instances.push(item);
  party.argonauts[0].equipment.push({ instanceId: item.id, positionIds: ['base:armor:0'], attachmentHostId: null });
  party.resources.Stone = 3; party.order.reverse(); party.activeArgonautId = 'arg-4';
  for (const other of party.argonauts.slice(1)) {
    assert.notEqual(other.colour, '#123ABC'); assert.equal(other.skills.Courage, 0);
    assert.equal(other.counters.rage, 0); assert.deepEqual(other.localConditions, []);
    assert.deepEqual(other.instances, []); assert.deepEqual(other.tokens, {});
  }
  assert.deepEqual(parseParty(JSON.parse(JSON.stringify(party))), party);
  assert.equal(newParty().resources.Stone, undefined);
});

test('invalid colours, duplicated identity/order and dangling loadouts fail validation', () => {
  let party = newParty(); party.argonauts[0].colour = 'red';
  assert.throws(() => parseParty(party), /colour/);
  party = newParty(); party.order[0] = party.order[1];
  assert.throws(() => parseParty(party), /order/);
  party = newParty(); party.activeArgonautId = 'missing';
  assert.throws(() => parseParty(party), /active/);
  party = newParty(); party.argonauts[0].equipment.push({ instanceId: 'missing', positionIds: ['base:armor:0'], attachmentHostId: null });
  assert.throws(() => parseParty(party), /dangling/);
  party = newParty(); const item = instance(gear('Fists'), 'duplicate');
  party.argonauts[0].instances.push(item); party.argonauts[1].instances.push(structuredClone(item));
  assert.throws(() => parseParty(party), /duplicate instance/);
  assert.throws(() => createParty('party', ['a', 'b', 'c', 'c'], repository.version), /four distinct/);
});

test('capacity derives from sources, stacks beyond three Support slots and preserves stable positions', () => {
  const breastplate = gear('Trireme Breastplate'), vestment = gear('Believer Vestment');
  const first = { instance: instance(breastplate, 'armor-a'), definition: breastplate };
  const second = { instance: instance(vestment, 'armor-b'), definition: vestment };
  const support = positions => positions.filter(p => p.kind === 'support');
  assert.equal(support(deriveCapacity([])).length, 2);
  assert.equal(support(deriveCapacity([first])).length, 3);
  const stacked = support(deriveCapacity([first, second])); assert.equal(stacked.length, 4);
  assert.deepEqual(deriveCapacity([first]), deriveCapacity([first]));
  assert.ok(stacked.some(p => p.id === support(deriveCapacity([first])).find(p => p.source)?.id));
  assert.equal(support(deriveCapacity([])).length, 2);
  assert.throws(() => deriveCapacity([first, first]), /Duplicate capacity source/);
  const configurable = { ...DEFAULT_BASELINE, support: 0 };
  assert.equal(support(deriveCapacity([first], configurable)).length, 1);
});

test('restricted slots filter traits and optional capacity requires a saved choice', () => {
  const pauldron = gear('Horseskull Pauldron');
  const restricted = deriveCapacity([{ instance: instance(pauldron, 'pauldron'), definition: pauldron }]).find(p => p.source);
  assert.equal(meetsSlotRestriction(gear('Fists').faces[0], restricted), false);
  assert.equal(meetsSlotRestriction(pauldron.faces[0], restricted), true);
  const backpack = gear('Nosoi Backpack'), item = instance(backpack, 'backpack');
  const sources = [{ instance: item, definition: backpack }];
  assert.equal(deriveCapacity(sources).filter(p => p.kind === 'hand').length, 2);
  item.enabledEffectIds.push(backpack.faces[0].slotEffects[0].id);
  assert.equal(deriveCapacity(sources).filter(p => p.kind === 'hand').length, 3);
  // Choosing capacity never mutates counters or invents Ambrosia automatically.
  assert.deepEqual(item.counters, {});
  const restored = JSON.parse(JSON.stringify(item));
  assert.equal(deriveCapacity([{ instance: restored, definition: backpack }]).filter(p => p.kind === 'hand').length, 3);
});

test('face changes and false/unknown gates remove grants; orphaned equipment remains available for reassignment', () => {
  const definition = structuredClone(gear('Trireme Breastplate'));
  definition.faces[0].slotEffects[0].conditions = [{ type: 'gate', gate: 'Danger', value: '8+' }];
  definition.faces.push({ ...structuredClone(definition.faces[0]), id: 'back', slotEffects: [] });
  const item = instance(definition, 'changing-armor'), sources = [{ instance: item, definition }];
  assert.equal(deriveCapacity(sources).filter(p => p.source).length, 0);
  const available = deriveCapacity(sources, DEFAULT_BASELINE, { gateSatisfied: condition => condition.gate === 'Danger' && condition.value === '8+' });
  const bonus = available.find(p => p.source);
  const equipment = [{ instanceId: 'support-item', positionIds: [bonus.id], attachmentHostId: null }];
  assert.equal(findAssignmentsNeedingReassignment(equipment, available).length, 0);
  item.faceId = 'back';
  assert.deepEqual(findAssignmentsNeedingReassignment(equipment, deriveCapacity(sources)), equipment);
  assert.equal(equipment[0].instanceId, 'support-item');
});
