import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { canDiscardCard, hasDiscardCost } from '../src/domain/ability-costs.ts';
import { canDiscardMemory, memoryProgress } from '../src/domain/memories.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';

const raw = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(raw);
const fresh = () => createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
const named = name => catalogue.byName(name)[0];
const reduce = (party, action, repo = catalogue) => partyReducer(party, { argonautId: 'a', ...action }, repo);
const ability = costs => ({ abilityText: [{ type: 'keyword', value: 'Reflex' }], costs });
const withCosts = (card, field, costs) => {
  const input = structuredClone(raw);
  input.cards.find(item => item.id === card.id).faces[0].data[field] = [ability(costs)];
  return createCatalogueRepository(input);
};
const equip = (party, card, id = 'g', positionId = 'base:attachment:0', repo = catalogue) => reduce(party, {
  type: 'equip', request: { definitionId: card.id, faceId: 'front', positionId, instanceId: id },
}, repo);
const assign = (card, kind = 'mnemos', repo = catalogue) => reduce(fresh(), {
  type: 'memory', request: { kind, index: 0, definitionId: card.id, faceId: 'front', instanceId: 'm' },
}, repo);

test('Discard eligibility comes from ability costs on the current face, never prose, effect icons or FAQ', () => {
  assert.equal(hasDiscardCost([ability(['Discard'])]), true);
  assert.equal(hasDiscardCost(ability(['Exhaust', 'Ambrosia'])), false);
  assert.equal(hasDiscardCost({ abilityText: [{ type: 'icon', value: 'Discard' }, { type: 'plainText', value: 'Discard another card' }] }), false);
  assert.equal(canDiscardCard(undefined), false);
  assert.equal(canDiscardCard(named('Hermes Gear Mk. I').faces[0]), true);
  assert.equal(canDiscardCard(named('Dogma').faces[0]), true);
  const face = structuredClone(named('Hermes Gear Mk. I').faces[0]);
  face.data.abilities = []; face.data.gatedAbilities = []; face.data.asteriskEffect = null;
  face.data.faq = [ability(['Discard'])];
  assert.equal(canDiscardCard(face), false);
  face.data.gatedAbilities = [{ abilities: [ability(['Discard'])] }];
  assert.equal(canDiscardCard(face), true);
  face.data.gatedAbilities = []; face.data.asteriskEffect = ability(['Discard']);
  assert.equal(canDiscardCard(face), true);
});

test('Gear discard clears exhaustion, preserves assignments and copies, blocks exhaust and can be restored', () => {
  const card = named('Hermes Gear Mk. I'), repo = withCosts(card, 'abilities', ['Exhaust', 'Discard']);
  let party = equip(equip(fresh(), card, 'g', 'base:attachment:0', repo), card, 'copy', 'base:attachment:1', repo);
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'g', exhausted: true }, repo);
  const before = structuredClone(party), assignments = structuredClone(party.argonauts[0].equipment);
  party = reduce(party, { type: 'equipment-discarded', instanceId: 'g', discarded: true }, repo);
  assert.equal(party.argonauts[0].instances[0].discarded, true);
  assert.equal(party.argonauts[0].instances[0].exhausted, false);
  assert.deepEqual(party.argonauts[0].instances[1], before.argonauts[0].instances[1]);
  assert.deepEqual(party.argonauts[0].equipment, assignments);
  assert.deepEqual(party.argonauts.slice(1), before.argonauts.slice(1));
  assert.equal(reduce(party, { type: 'equipment-exhausted', instanceId: 'g', exhausted: true }, repo), party);
  assert.equal(reduce(party, { type: 'equipment-discarded', argonautId: 'b', instanceId: 'g', discarded: true }, repo), party);
  assert.equal(reduce(party, { type: 'equipment-discarded', instanceId: 'missing', discarded: true }, repo), party);
  party = reduce(parseParty(structuredClone(party)), { type: 'equipment-discarded', instanceId: 'g', discarded: false }, repo);
  assert.equal(party.argonauts[0].instances[0].discarded, false);
  assert.equal(party.argonauts[0].instances[0].exhausted, false);
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'g', exhausted: true }, repo);
  assert.equal(party.argonauts[0].instances[0].exhausted, true);
  party = equip(party, named('Atlantean Oscillator'), 'replacement');
  assert.equal(reduce(party, { type: 'equipment-discarded', instanceId: 'g', discarded: true }), party);
  assert.equal(reduce(party, { type: 'equipment-discarded', instanceId: 'replacement', discarded: true }), party);
  assert.equal(before.argonauts[0].instances[0].exhausted, true);
});

test('memory discard preserves nodes, obeys Fated side costs and can restore after the relevant cost disappears', () => {
  const card = named('Dogma'), repo = withCosts(card, 'abilities', ['Exhaust', 'Discard']);
  let party = assign(card, 'mnemos', repo);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', progress: { node: 7 } }, repo);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', exhausted: true }, repo);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', discarded: true }, repo);
  assert.equal(party.argonauts[0].instances[0].discarded, true);
  assert.equal(party.argonauts[0].instances[0].exhausted, false);
  assert.equal(memoryProgress(party.argonauts[0].instances[0]).node, 7);
  assert.equal(reduce(party, { type: 'memory-state', instanceId: 'm', exhausted: true }, repo), party);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', discarded: false }, repo);
  assert.equal(party.argonauts[0].instances[0].discarded, false);
  const fated = catalogue.search({ family: 'Fated Mnemos' })[0];
  const input = structuredClone(raw), face = input.cards.find(card => card.id === fated.id).faces[0];
  face.data.effect = [ability([])]; face.data.growthAbility = [ability(['Discard'])];
  const fatedRepo = createCatalogueRepository(input);
  assert.equal(canDiscardMemory(face, { node: 2, growthUnlocked: true }), false);
  assert.equal(canDiscardMemory(face, { node: 3, growthUnlocked: false }), true);
  party = assign(fated, 'fated-mnemos', fatedRepo);
  assert.equal(reduce(party, { type: 'memory-state', instanceId: 'm', discarded: true }, fatedRepo), party);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', progress: { node: 3 }, discarded: true }, fatedRepo);
  assert.equal(party.argonauts[0].instances[0].discarded, true);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', progress: { node: 2 } }, fatedRepo);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', discarded: false }, fatedRepo);
  assert.equal(party.argonauts[0].instances[0].discarded, false);
  assert.equal(memoryProgress(party.argonauts[0].instances[0]).node, 2);
});

test('Titan discard checks current identity and costs, clears exhaustion and permits historical Restore', () => {
  const card = named('Gamechanger'), repo = withCosts(card, 'abilities', ['Exhaust', 'Discard']);
  let party = reduce(fresh(), { type: 'titan', titan: { id: 't', definitionId: card.id, faceId: 'front', exhausted: true, enabledEffectIds: [], counters: {} } }, repo);
  for (const action of [{ instanceId: 'stale' }, { instanceId: 't', argonautId: 'b' }]) assert.equal(reduce(party, { type: 'titan-discarded', discarded: true, ...action }, repo), party);
  party = reduce(party, { type: 'titan-discarded', instanceId: 't', discarded: true }, repo);
  assert.equal(party.argonauts[0].titan.discarded, true);
  assert.equal(party.argonauts[0].titan.exhausted, false);
  assert.equal(reduce(party, { type: 'titan-exhausted', exhausted: true }, repo), party);
  party = reduce(parseParty(structuredClone(party)), { type: 'titan-discarded', instanceId: 't', discarded: false });
  assert.equal(party.argonauts[0].titan.discarded, false);
  assert.equal(reduce(party, { type: 'titan-discarded', instanceId: 't', discarded: true }), party);
});

test('older saves omit discard safely and validation rejects malformed or contradictory state', () => {
  const party = equip(fresh(), named('Hermes Gear Mk. I'));
  assert.deepEqual(parseParty(structuredClone(party)), party);
  for (const discarded of ['yes', 1, null]) {
    const invalid = structuredClone(party); invalid.argonauts[0].instances[0].discarded = discarded;
    assert.throws(() => parseParty(invalid), /invalid discarded state/);
  }
  const invalid = structuredClone(party);
  Object.assign(invalid.argonauts[0].instances[0], { discarded: true, exhausted: true });
  assert.throws(() => parseParty(invalid), /cannot also be exhausted/);
});
