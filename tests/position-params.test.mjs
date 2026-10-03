import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { resolveHref } from '../node_modules/expo-router/build/link/href.js';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { loadoutState, planEquipment } from '../src/domain/loadout.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { positionFromRoute, positionRouteParam } from '../src/loadout/position-params.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => createParty('positions', ['a', 'b', 'c', 'd'], catalogue.version);
// Installed Expo Router parses searchParams, then useLocalSearchParams decodes each value again.
const localParams = position => decodeURIComponent(new URL(resolveHref({ pathname: '/loadout/[id]', params: { id: 'a', position } }), 'https://example.test').searchParams.get('position'));
const equip = (party, name, positionId, instanceId) => partyReducer(party, { type: 'equip', argonautId: 'a', request: { definitionId: catalogue.byName(name)[0].id, faceId: 'front', positionId, instanceId } }, catalogue);

test('Trireme bonus slot survives dashboard navigation, card selection and placement with a real generated ID', () => {
  let party = equip(fresh(), 'Trireme Breastplate', 'base:armor:0', 'a:gear:armor');
  const positions = loadoutState(party.argonauts[0], catalogue).positions;
  const bonus = positions.find(position => position.kind === 'support' && position.source);
  const value = localParams(positionRouteParam(bonus.id));
  assert.equal(value, bonus.id); assert.equal(positionFromRoute(positions, value), bonus);
  const selectedUrl = new URL(resolveHref({ pathname: '/loadout/[id]', params: { id: 'a', position: positionRouteParam(bonus.id), definition: catalogue.byName('Mazegma')[0].id, face: 'front' } }), 'https://example.test');
  assert.equal(positionFromRoute(positions, decodeURIComponent(selectedUrl.searchParams.get('position'))), bonus);
  const request = { definitionId: catalogue.byName('Mazegma')[0].id, faceId: 'front', positionId: positionFromRoute(positions, value).id, instanceId: 'a:gear:support' };
  assert.ok(planEquipment(party.argonauts[0], request, catalogue).next);
  party = partyReducer(party, { type: 'equip', argonautId: 'a', request }, catalogue);
  assert.ok(loadoutState(party.argonauts[0], catalogue).activeInstanceIds.has(request.instanceId));
  assert.deepEqual(party.argonauts[0].equipment.find(item => item.instanceId === request.instanceId).positionIds, [bonus.id]);
  assert.deepEqual(parseParty(JSON.parse(JSON.stringify(party))), party);
  // router.setParams stores its value directly; the local hook still decodes it once.
  assert.equal(positionFromRoute(positions, decodeURIComponent(positionRouteParam(bonus.id))), bonus);
});

test('old bonus links resolve against live capacity while stale links still fail after their source is removed', () => {
  const start = equip(fresh(), 'Trireme Breastplate', 'base:armor:0', 'a:gear:armor');
  const positions = loadoutState(start.argonauts[0], catalogue).positions, bonus = positions.find(p => p.kind === 'support' && p.source);
  const legacy = localParams(bonus.id); assert.notEqual(legacy, bonus.id);
  assert.equal(positionFromRoute(positions, legacy), bonus);
  const removed = partyReducer(start, { type: 'remove-equipment', argonautId: 'a', instanceId: 'a:gear:armor' }, catalogue);
  const remaining = loadoutState(removed.argonauts[0], catalogue).positions;
  assert.equal(positionFromRoute(remaining, legacy), undefined);
  assert.equal(positionFromRoute(remaining, localParams(positionRouteParam(bonus.id))), undefined);
});

test('restriction checks remain enforced after resolving a bonus route, while eligible Gear can be equipped', () => {
  const party = equip(fresh(), 'Horseskull Pauldron', 'base:armor:0', 'a:gear:pauldron');
  const positions = loadoutState(party.argonauts[0], catalogue).positions, bonus = positions.find(p => p.kind === 'support' && p.source);
  const target = positionFromRoute(positions, localParams(positionRouteParam(bonus.id)));
  const request = { faceId: 'front', positionId: target.id, instanceId: 'a:gear:extra' };
  const supports = catalogue.search({ family: 'Gear', slot: 'Support' });
  const plain = supports.find(c => !c.faces[0].data.traits.includes('Paradox'));
  const paradox = supports.find(c => c.faces[0].data.traits.includes('Paradox'));
  assert.equal(planEquipment(party.argonauts[0], { ...request, definitionId: plain.id }, catalogue).next, null);
  assert.ok(planEquipment(party.argonauts[0], { ...request, definitionId: paradox.id }, catalogue).next);
});

test('normal positions and encoded punctuation/Unicode round-trip without treating unknown or malformed links as slots', () => {
  for (const id of ['base:support:0', 'bonus:a%3Agear:front%3Aany%3A%255B%255D:0', 'bonus:a%253Ab:%E2%9C%93:0']) {
    const positions = [{ id }]; assert.equal(positionFromRoute(positions, localParams(positionRouteParam(id))), positions[0]);
  }
  const positions = [{ id: 'base:support:0' }];
  for (const value of [null, undefined, ['base:support:0'], '%GG', 'unknown']) assert.equal(positionFromRoute(positions, value), undefined);
  const ambiguous = [{ id: 'bonus:%41:0' }, { id: 'bonus:A:0' }];
  assert.equal(positionFromRoute(ambiguous, 'bonus:A:0'), ambiguous[1]);
});
