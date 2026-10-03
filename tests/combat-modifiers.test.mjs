import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { combatAdjustments, adjustedStat, passiveGearModifiers } from '../src/domain/combat-modifiers.ts';
import { gateValues } from '../src/domain/rules-assistance.ts';
import { changeArgonautIdentity } from '../src/domain/argonaut-identity.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';
import { SnapshotStore } from '../src/storage/snapshots.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => createParty('modifiers', ['a', 'b', 'c', 'd'], catalogue.version);
const named = name => catalogue.byName(name)[0];
const face = name => named(name).faces[0];
const item = (name, id) => ({ id, definitionId: named(name).id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} });
function equip(owner, name, id, positions) {
  const instance = item(name, id); owner.instances.push(instance);
  owner.equipment.push({ instanceId: id, positionIds: positions, attachmentHostId: null }); return instance;
}
const precision = (owner, name) => combatAdjustments(owner, catalogue).get(face(name))?.precision?.delta ?? 0;
const speed = owner => combatAdjustments(owner, catalogue).get(face('Philoctera')).speed.delta;

test('signed counters edit only their captured owner, preserve older saves and reject malformed actions', () => {
  const start = fresh(), action = { type: 'combat-modifier', argonautId: 'b', modifier: 'precision', delta: -1 };
  const next = partyReducer(start, action, catalogue);
  assert.equal(start.argonauts[1].combatModifiers, undefined);
  assert.deepEqual(next.argonauts[1].combatModifiers, { precision: -1, speed: 0 });
  for (const index of [0, 2, 3]) assert.equal(next.argonauts[index], start.argonauts[index]);
  assert.deepEqual(parseParty(next), next); assert.deepEqual(parseParty(start), start);
  for (const change of [{ modifier: 'Courage' }, { delta: 2 }, { delta: NaN }, { argonautId: 'unknown' }]) assert.equal(partyReducer(next, { ...action, ...change }, catalogue), next);
  next.argonauts[1].combatModifiers.precision = Number.MIN_SAFE_INTEGER;
  assert.equal(partyReducer(next, action, catalogue), next);
  for (const modifiers of [{ precision: NaN, speed: 0 }, { precision: 1.5, speed: 0 }, { precision: 1 }, null, { precision: '1', speed: 0 }]) {
    const invalid = structuredClone(start); invalid.argonauts[0].combatModifiers = modifiers;
    assert.throws(() => parseParty(invalid));
  }
});

test('Puzzle Axe gains its own Precision at three equipped Labyrinth cards and relocks without changing printed data', () => {
  const owner = fresh().argonauts[0], printed = JSON.stringify(named('Puzzle Axe'));
  equip(owner, 'Puzzle Axe', 'axe', ['base:hand:0']);
  equip(owner, 'Mazegma', 'support', ['base:support:0']);
  assert.equal(precision(owner, 'Puzzle Axe'), 0);
  const shield = equip(owner, 'Temenos Scale Shield', 'shield', ['base:hand:1']);
  assert.equal(precision(owner, 'Puzzle Axe'), 1);
  assert.equal(precision(owner, 'Temenos Scale Shield'), 0);
  owner.combatModifiers = { precision: 2, speed: 0 };
  assert.equal(adjustedStat('+1', combatAdjustments(owner, catalogue).get(face('Puzzle Axe')).precision).text, '+4');
  shield.exhausted = true; assert.equal(precision(owner, 'Puzzle Axe'), 3);
  shield.exhausted = false; shield.discarded = true; assert.equal(precision(owner, 'Puzzle Axe'), 2);
  shield.discarded = false; assert.equal(precision(owner, 'Puzzle Axe'), 3);
  shield.faceId = 'back'; assert.equal(precision(owner, 'Puzzle Axe'), 2);
  shield.faceId = 'front'; owner.equipment.pop(); assert.equal(precision(owner, 'Puzzle Axe'), 2);
  assert.equal(JSON.stringify(named('Puzzle Axe')), printed);
});

test('Ambrosia gates use personal tokens and passive attachment Precision applies to each Weapon once', () => {
  const owner = fresh().argonauts[0];
  equip(owner, 'Muckbane', 'one', ['base:hand:0']); equip(owner, 'Muck Bludgeon', 'two', ['base:hand:1']);
  const attachment = equip(owner, 'Argocryptex Alpha', 'attachment', ['base:attachment:0']);
  assert.equal(precision(owner, 'Muckbane'), 1); assert.equal(precision(owner, 'Muck Bludgeon'), 1);
  owner.tokens.Ambrosia = 1; owner.combatModifiers = { precision: -2, speed: 0 };
  assert.equal(precision(owner, 'Muckbane'), 0); assert.equal(precision(owner, 'Muck Bludgeon'), 0);
  attachment.discarded = true; assert.equal(precision(owner, 'Muckbane'), -1);
  attachment.discarded = false; owner.tokens.Ambrosia = 0; assert.equal(precision(owner, 'Muckbane'), -1);
});

test('Titan movement includes manual and passive Speed, counts two-hand Gear once and recalculates gates', () => {
  const owner = fresh().argonauts[0]; owner.titan = item('Philoctera', 'titan');
  owner.combatModifiers = { precision: 0, speed: -1 };
  const weapon = equip(owner, 'Subreme Harpoon', 'two-hands', ['base:hand:0', 'base:hand:1']);
  equip(owner, 'Spherical Armor', 'armor', ['base:armor:0']);
  assert.equal(speed(owner), 1);
  owner.counters.danger = 6; assert.equal(speed(owner), 2);
  weapon.exhausted = true; assert.equal(speed(owner), 2);
  weapon.exhausted = false; weapon.discarded = true; assert.equal(speed(owner), 1);
  owner.counters.danger = 5; assert.equal(speed(owner), 0);
  assert.equal(face('Philoctera').data.speed, '5');
});

test('costs, timing, token gains, conditional prose and unsupported gates do not create passive adjustments', () => {
  const base = face('Puzzle Axe'), values = gateValues(fresh().argonauts[0], catalogue);
  const sentence = tokens => ({ abilityText: tokens });
  const plain = value => ({ type: 'plainText', value });
  const data = { ...base.data, abilities: [
    { ...sentence([plain('+9 Precision')]), costs: ['Exhaust'] },
    sentence([{ type: 'timing', value: 'Wound' }, plain('+9 Precision')]),
    sentence([plain('Gain 1 positive Precision token')]), sentence([plain('If adjacent, gain +9 Precision')]),
    { ...sentence([plain('+9 Precision')]), gate: 'Energy', value: '1+' },
  ], gatedAbilities: [{ gate: 'Unknown', value: '1+', abilities: [sentence([plain('+9 Precision')])] }] };
  assert.deepEqual(passiveGearModifiers({ ...base, data }, values), { precision: 0, speed: 0 });
  data.abilities = [sentence([plain('Precision +2')]), sentence([plain('-1'), { type: 'whitespace', value: ' ' }, { type: 'icon', value: 'Speed' }])];
  assert.deepEqual(passiveGearModifiers({ ...base, data }, values), { precision: 2, speed: -1 });
});

test('unassigned, pending and discarded Gear do not contribute, and one Argonaut’s modifiers never affect another', () => {
  const party = fresh(), owner = party.argonauts[0], other = party.argonauts[1];
  equip(owner, 'Puzzle Axe', 'a-axe', ['base:hand:0']); equip(other, 'Puzzle Axe', 'b-axe', ['base:hand:0']);
  owner.combatModifiers = { precision: 3, speed: 0 };
  owner.instances.push(item('Argocryptex Alpha', 'unassigned'));
  equip(owner, 'Repurposed Cryptex', 'pending', ['absent:attachment:0']);
  assert.equal(precision(owner, 'Puzzle Axe'), 3); assert.equal(precision(other, 'Puzzle Axe'), 0);
  assert.equal(combatAdjustments(owner, catalogue).has(face('Repurposed Cryptex')), false);
});

test('modified displays preserve symbolic and conditional printed values and describe contributing sources', () => {
  const modifier = { delta: 2, contributions: [{ source: 'Precision modifier tokens', amount: 1 }, { source: 'Puzzle Axe', amount: 1 }] };
  assert.equal(adjustedStat('+1', modifier).text, '+3'); assert.equal(adjustedStat('5', modifier).text, '7');
  for (const printed of ['+X', '+2*', '*']) assert.equal(adjustedStat(printed, modifier).text, `${printed} (+2)`);
  assert.equal(adjustedStat('+1', { delta: -2, contributions: [] }).text, '-1');
  assert.equal(adjustedStat('+1', { delta: -1, contributions: [] }).text, '+0');
  assert.equal(adjustedStat('+1').changed, false); assert.equal(adjustedStat('+1', { delta: 0, contributions: [] }).changed, false);
  assert.match(adjustedStat('+1', modifier).label, /printed \+1; Precision modifier tokens: \+1, Puzzle Axe: \+1/);
});

test('Tides of Fate clears all modifier totals and changing an identity clears only that Argonaut’s tokens', () => {
  const party = fresh(); for (const owner of party.argonauts) owner.combatModifiers = { precision: -2, speed: 3 };
  const reset = partyReducer(party, { type: 'clear-all', partyId: party.id, argonautId: 'a', confirmed: true }, catalogue);
  for (const owner of reset.argonauts) assert.deepEqual(owner.combatModifiers, { precision: 0, speed: 0 });
  assert.equal(partyReducer(reset, { type: 'clear-all', partyId: party.id, argonautId: 'a', confirmed: true }, catalogue), reset);
  const changed = changeArgonautIdentity(party.argonauts[0], { name: 'New player', definitionId: null }, 1, catalogue);
  assert.deepEqual(changed.combatModifiers, { precision: 0, speed: 0 }); assert.equal(party.argonauts[1].combatModifiers.speed, 3);
});

test('signed modifiers round-trip through portable backup and local restart without reapplying derived bonuses', async () => {
  const party = fresh(); party.argonauts[0].combatModifiers = { precision: -3, speed: 2 };
  equip(party.argonauts[0], 'Argocryptex Alpha', 'attachment', ['base:attachment:0']);
  const profile = { id: party.id, name: 'Modifiers', party };
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile] };
  const data = new Map(), adapter = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, runExclusive: async task => task() };
  const store = new SnapshotStore(adapter); await store.load(); await store.save(workspace);
  assert.deepEqual((await new SnapshotStore(adapter).load()).workspace, workspace);
});
