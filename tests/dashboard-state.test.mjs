import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createParty, parseParty } from '../src/domain/party.ts';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { partyReducer, adjacentArgonautId } from '../src/state/party-reducer.ts';
import { armourFixture, dashboardPositions, swipeDirection } from '../src/dashboard/model.ts';

const catalogue = createCatalogueRepository(JSON.parse(await readFile(new URL('../data/generated/catalogue.json', import.meta.url), 'utf8')));
const initial = () => createParty('party', ['a', 'b', 'c', 'd'], catalogue.version);

test('editing and navigating retain isolated identity, colour, skills, counters and Titans', () => {
  const start = initial();
  let party = partyReducer(start, { type: 'name', argonautId: 'a', name: 'Ariadne' });
  party = partyReducer(party, { type: 'colour', argonautId: 'a', colour: '#123abc' });
  party = partyReducer(party, { type: 'skill', argonautId: 'a', skill: 'Courage', delta: 1 });
  party = partyReducer(party, { type: 'counter', argonautId: 'a', counter: 'rage', value: 4 });
  const titan = { id: 'a:titan', definitionId: catalogue.search({ family: 'Titan' })[0].id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} };
  party = partyReducer(party, { type: 'titan', argonautId: 'a', titan });
  party = partyReducer(party, { type: 'select', argonautId: 'b' });
  assert.equal(party.activeArgonautId, 'b');
  assert.equal(party.argonauts[0].name, 'Ariadne'); assert.equal(party.argonauts[0].colour, '#123ABC');
  assert.equal(party.argonauts[0].skills.Courage, 1); assert.equal(party.argonauts[0].counters.rage, 4);
  assert.deepEqual(party.argonauts[0].titan, titan);
  for (const argonaut of party.argonauts.slice(1)) {
    assert.equal(argonaut.skills.Courage, 0); assert.equal(argonaut.counters.rage, 0); assert.equal(argonaut.titan, null);
  }
  assert.deepEqual(start, initial());
  assert.deepEqual(parseParty(JSON.parse(JSON.stringify(party))), party);
  // A callback opened for A continues to name A explicitly after selecting B.
  party = partyReducer(party, { type: 'colour', argonautId: 'a', colour: '#ABC123' });
  assert.equal(party.argonauts[1].colour, start.argonauts[1].colour);
});

test('overflow requires confirmation, decrements remain possible and malformed edits do nothing', () => {
  const party = partyReducer(initial(), { type: 'counter', argonautId: 'a', counter: 'danger', value: 9 });
  assert.equal(partyReducer(party, { type: 'counter', argonautId: 'a', counter: 'danger', value: 10 }), party);
  const manual = partyReducer(party, { type: 'counter', argonautId: 'a', counter: 'danger', value: 11, confirmOverflow: true });
  assert.equal(manual.argonauts[0].counters.danger, 11);
  assert.equal(partyReducer(manual, { type: 'counter', argonautId: 'a', counter: 'danger', value: 10 }).argonauts[0].counters.danger, 10);
  assert.deepEqual(manual.argonauts[0].localConditions, []);
  assert.equal(partyReducer(party, { type: 'colour', argonautId: 'a', colour: 'red' }), party);
  assert.equal(partyReducer(party, { type: 'select', argonautId: 'missing' }), party);
  assert.equal(partyReducer(party, { type: 'counter', argonautId: 'a', counter: 'danger', value: -1 }), party);
  assert.equal(partyReducer(party, { type: 'counter', argonautId: 'a', counter: 'danger', value: Infinity, confirmOverflow: true }), party);
  const start = initial(); assert.equal(partyReducer(start, { type: 'skill', argonautId: 'a', skill: 'Courage', delta: -1 }), start);
});

test('navigation obeys party order and stops at boundaries; swipes ignore vertical and multi-touch input', () => {
  const order = ['c', 'a', 'd', 'b'];
  assert.equal(adjacentArgonautId(order, 'c', -1), undefined);
  assert.equal(adjacentArgonautId(order, 'b', 1), undefined);
  assert.equal(adjacentArgonautId(order, 'a', 1), 'd');
  assert.equal(adjacentArgonautId(order, 'missing', 1), undefined);
  assert.equal(swipeDirection(-100, 12, 1), 1); assert.equal(swipeDirection(100, 12, 1), -1);
  assert.equal(swipeDirection(20, 0, 1), undefined); assert.equal(swipeDirection(90, 100, 1), undefined);
  assert.equal(swipeDirection(-100, 0, 2), undefined);
});

test('dashboard derives two Supports by default, three from armour and restricted bonus eligibility', () => {
  const argonaut = initial().argonauts[0];
  const base = dashboardPositions(argonaut, catalogue);
  assert.equal(base.filter(p => p.kind === 'support').length, 2);
  assert.equal(base.filter(p => p.kind === 'mnemos').length, 2);
  assert.equal(base.filter(p => p.kind === 'fated-mnemos').length, 2);
  const trireme = armourFixture('trireme', 'a', catalogue);
  const expanded = dashboardPositions({ ...argonaut, ...trireme }, catalogue);
  assert.equal(expanded.filter(p => p.kind === 'support').length, 3);
  const paradox = armourFixture('paradox', 'a', catalogue);
  const restricted = dashboardPositions({ ...argonaut, ...paradox }, catalogue).find(p => p.source);
  assert.deepEqual(restricted.eligibility.requiredTraits, ['Paradox']);
  const orphan = { ...argonaut, ...trireme, equipment: [{ ...trireme.equipment[0], positionIds: ['missing-slot'] }] };
  assert.equal(dashboardPositions(orphan, catalogue).filter(p => p.kind === 'support').length, 2);
  assert.equal(orphan.instances.length, 1);
  const ownBonusId = expanded.find(p => p.source).id;
  const circular = { ...argonaut, ...trireme, equipment: [{ ...trireme.equipment[0], positionIds: [ownBonusId] }] };
  assert.equal(dashboardPositions(circular, catalogue).filter(p => p.kind === 'support').length, 2);
  assert.equal(armourFixture('unknown', 'a', catalogue), undefined);
});
