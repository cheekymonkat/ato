import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { gearChargePool, gearChargeRemaining, spendGearCharge } from '../src/domain/gear-charges.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const definition = catalogue.byName('Alchemic Incendiaries')[0], face = definition.faces[0];
const card = (id, changes = {}) => ({ id, definitionId: definition.id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {}, ...changes });
function fresh() {
  const party = createParty('charges', ['a', 'b', 'c', 'd'], catalogue.version);
  party.argonauts = party.argonauts.map(member => ({ ...member, instances: [card(`${member.id}:gear`)],
    equipment: [{ instanceId: `${member.id}:gear`, positionIds: ['support-1'], attachmentHostId: null }] }));
  return party;
}
const tap = (party, owner = 'a', changes = {}) => partyReducer(party, { type: 'equipment-charge', partyId: party.id, argonautId: owner,
  instanceId: `${owner}:gear`, definitionId: definition.id, faceId: 'front', index: 0, ...changes }, catalogue);

test('all printed Gear Energy pools spend to zero and restore their original values without changing other card state', () => {
  let pools = 0;
  for (const definition of catalogue.search({ family: 'Gear' })) for (const face of definition.faces) {
    if (face.kind !== 'gear') continue;
    const original = structuredClone(face);
    for (const [index, stat] of face.data.defensiveStatistics.entries()) {
      const pool = gearChargePool(face, index);
      if (stat.type !== 'Energy') { assert.equal(pool, null); continue; }
      pools++;
      assert.equal(pool.capacity, Number(stat.amount));
      let instance = card('gear', { definitionId: definition.id, faceId: face.id, counters: { unrelated: 7 } });
      assert.equal(gearChargeRemaining(instance, pool), pool.capacity);
      for (let remaining = pool.capacity - 1; remaining >= 0; remaining--) {
        instance = spendGearCharge(instance, face, index);
        assert.equal(gearChargeRemaining(instance, pool), remaining);
      }
      instance = spendGearCharge(instance, face, index);
      assert.equal(gearChargeRemaining(instance, pool), pool.capacity);
      assert.deepEqual(instance.counters, { unrelated: 7 });
    }
    assert.deepEqual(face, original);
  }
  assert.equal(pools, 28);
  const custom = { ...face, data: { ...face.data, defensiveStatistics: [{ type: 'Energy', amount: '2' }, { type: 'Energy', amount: '3' }] } };
  let instance = spendGearCharge(card('gear'), custom, 1);
  assert.equal(gearChargeRemaining(instance, gearChargePool(custom, 0)), 2);
  assert.equal(gearChargeRemaining(instance, gearChargePool(custom, 1)), 2);
  const back = { ...custom, id: 'back' };
  instance = spendGearCharge({ ...instance, faceId: 'back' }, back, 0);
  assert.equal(gearChargeRemaining(instance, gearChargePool(back, 0)), 1);
  assert.equal(gearChargeRemaining(instance, gearChargePool(custom, 0)), 2);
});

test('charge edits belong to one equipped physical card and reject stale callbacks, missing pools and invalid owners', () => {
  const original = fresh(), snapshot = structuredClone(original);
  let party = tap(original);
  assert.equal(gearChargeRemaining(party.argonauts[0].instances[0], gearChargePool(face, 0)), 1);
  assert.equal(party.argonauts[1], original.argonauts[1]);
  for (const changes of [{ partyId: 'other' }, { argonautId: 'missing' }, { instanceId: 'b:gear' }, { definitionId: 'other' },
    { faceId: 'back' }, { index: -1 }, { index: 1 }, { index: 0.5 }]) assert.equal(tap(party, 'a', changes), party);
  const unassigned = structuredClone(party); unassigned.argonauts[0].equipment = [];
  assert.equal(tap(unassigned), unassigned);
  party = tap(party); assert.equal(gearChargeRemaining(party.argonauts[0].instances[0], gearChargePool(face, 0)), 0);
  party = tap(party); assert.deepEqual(party.argonauts[0].instances[0].counters, {});
  assert.deepEqual(original, snapshot);
});

test('Tides of Fate restores all face pools, exhaustion and discards while Refresh Gear preserves charges', () => {
  let party = fresh();
  for (const owner of party.order) party = tap(party, owner);
  party.argonauts = party.argonauts.map((member, index) => ({ ...member, instances: [{ ...member.instances[0],
    exhausted: index % 2 === 0, discarded: index % 2 === 1,
    counters: { ...member.instances[0].counters, 'gear-charge:back:0': 0, unrelated: 4 } }] }));
  const snapshot = structuredClone(party);
  const refreshed = partyReducer(party, { type: 'refresh-gear', argonautId: 'a' }, catalogue);
  assert.deepEqual(refreshed.argonauts[0].instances[0].counters, party.argonauts[0].instances[0].counters);
  assert.equal(partyReducer(party, { type: 'clear-all', partyId: party.id, argonautId: 'a', confirmed: false }, catalogue), party);
  const reset = partyReducer(party, { type: 'clear-all', partyId: party.id, argonautId: 'a', confirmed: true }, catalogue);
  for (const [index, member] of reset.argonauts.entries()) {
    assert.equal(member.instances[0].exhausted, false); assert.equal(member.instances[0].discarded ?? false, false);
    assert.deepEqual(member.instances[0].counters, { unrelated: 4 });
    assert.equal(gearChargeRemaining(member.instances[0], gearChargePool(face, 0)), 2);
    assert.equal(member.equipment, party.argonauts[index].equipment);
  }
  assert.deepEqual(party, snapshot);
  assert.equal(partyReducer(reset, { type: 'clear-all', partyId: party.id, argonautId: 'a', confirmed: true }, catalogue), reset);
  // A spent charge alone must be sufficient to trigger the reset.
  const spent = tap(fresh()), clean = partyReducer(spent, { type: 'clear-all', partyId: spent.id, argonautId: 'a', confirmed: true }, catalogue);
  assert.deepEqual(clean.argonauts[0].instances[0].counters, {});
});

test('charges survive save/backup round trips and older saves default to full; malformed charge counters are rejected', () => {
  const party = tap(tap(fresh())), profile = { id: party.id, name: 'Charge tracking', party };
  assert.deepEqual(parseParty(JSON.parse(JSON.stringify(party))), party);
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  assert.equal(gearChargeRemaining(fresh().argonauts[0].instances[0], gearChargePool(face, 0)), 2);
  for (const [key, value] of [['gear-charge:front:0', -1], ['gear-charge:front:0', 1.5], ['gear-charge:other:0', 1]]) {
    const invalid = fresh(); invalid.argonauts[0].instances[0].counters[key] = value;
    assert.throws(() => parseParty(invalid), /Gear charges|instance state/);
  }
});
