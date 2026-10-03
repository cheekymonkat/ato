import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { canExhaustCard, hasExhaustCost } from '../src/domain/ability-costs.ts';
import { formatParagraph } from '../src/domain/card-presentation.ts';
import { canExhaustMemory, memoryAt, memoryProgress } from '../src/domain/memories.ts';
import { titanAbilityRows } from '../src/domain/titan-presentation.ts';
import { createKeywordRepository } from '../src/domain/keywords.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';

const raw = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(raw);
const fresh = () => createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
const named = name => catalogue.byName(name)[0];
const reduce = (party, action, repo = catalogue) => partyReducer(party, { argonautId: 'a', ...action }, repo);
const sentence = (keyword, costs) => ({ abilityText: [{ type: 'keyword', value: keyword }], ...(costs ? { costs } : {}) });

test('Despair Resilience remains a complete ability name with the user-supplied explanation and no invented cost', () => {
  const titan = named('Trespasser').faces[0];
  const before = structuredClone(titan);
  const override = JSON.parse(fs.readFileSync(new URL('../data/reference/keyword-overrides.json', import.meta.url)));
  const row = titanAbilityRows(titan, createKeywordRepository(override)).find(row => row.details.some(detail => detail.name === 'Despair Resilience 1'));
  assert.equal(formatParagraph(row.heading, true).label, 'Despair Resilience 1.');
  assert.equal(row.heading.costs, undefined);
  assert.equal(formatParagraph(row.details[0].definition.main).label, 'Reduce the effect of Despair by 1.');
  assert.equal(canExhaustCard(titan), false);
  const resourceCosts = sentence('Despair Resilience 1', ['Despair', 'Ambrosia', 'Midas']);
  assert.equal(formatParagraph(resourceCosts).label, '[Despair] [Ambrosia] [Midas] Despair Resilience 1.');
  assert.deepEqual(titan, before);
});

test('exhaust eligibility requires the explicit cost on the relevant ability or Fated side', () => {
  for (const cost of ['Despair', 'Ambrosia', 'Midas', 'Fate', 'Discard']) assert.equal(hasExhaustCost(sentence('Resilience 1', [cost])), false);
  assert.equal(hasExhaustCost([[sentence('Reflex', ['Fate', 'Exhaust'])]]), true);
  assert.equal(hasExhaustCost({ abilityText: [{ type: 'icon', value: 'Exhaust' }, { type: 'plainText', value: 'Exhaust another card' }] }), false);
  assert.equal(canExhaustCard(undefined), false);
  const gear = structuredClone(named('Hammer-Sword').faces[0]);
  gear.data.abilities = []; gear.data.gatedAbilities = []; gear.data.asteriskEffect = null;
  gear.data.faq = [sentence('Reflex', ['Exhaust'])];
  assert.equal(canExhaustCard(gear), false);
  gear.data.gatedAbilities = [{ abilities: [sentence('Reflex', ['Exhaust'])] }];
  assert.equal(canExhaustCard(gear), true);
  gear.data.gatedAbilities = []; gear.data.asteriskEffect = sentence('Reflex', ['Exhaust']);
  assert.equal(canExhaustCard(gear), true);
  const fated = structuredClone(catalogue.search({ family: 'Fated Mnemos' })[0].faces[0]);
  fated.data.effect = sentence('Reflex'); fated.data.growthAbility = sentence('Reflex', ['Exhaust']);
  for (const node of [null, 0, 1, 2]) assert.equal(canExhaustMemory(fated, { node, growthUnlocked: true }), false);
  assert.equal(canExhaustMemory(fated, { node: 3, growthUnlocked: false }), true);
});

test('Gear reducer permits per-card exhaustion without printed costs, rejects stale instances and allows Ready', () => {
  let party = reduce(fresh(), { type: 'equip', request: { definitionId: named('Argocryptex Alpha').id, faceId: 'front', positionId: 'base:attachment:0', instanceId: 'g' } });
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'g', exhausted: true });
  assert.equal(party.argonauts[0].instances[0].exhausted, true);
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'g', exhausted: false });
  assert.equal(party.argonauts[0].instances[0].exhausted, false);
  party = reduce(party, { type: 'equip', request: { definitionId: named('Atlantean Oscillator').id, faceId: 'front', positionId: 'base:attachment:0', instanceId: 'new' } });
  assert.equal(reduce(party, { type: 'equipment-exhausted', instanceId: 'g', exhausted: true }), party);
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'new', exhausted: true });
  assert.equal(party.argonauts[0].instances[0].exhausted, true);
  party = parseParty(structuredClone(party));
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'new', exhausted: false });
  assert.equal(party.argonauts[0].instances[0].exhausted, false);
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'new', exhausted: true });
  assert.equal(party.argonauts[0].instances[0].exhausted, true);
});

test('memory reducer enforces Exhaust costs including Growth thresholds and permits recovery of old exhaustion', () => {
  const assign = (party, kind, card, repo = catalogue) => reduce(party, { type: 'memory', request: { kind, index: 0, definitionId: card.id, faceId: 'front', instanceId: 'm' } }, repo);
  const eligible = catalogue.search({ family: 'Mnemos' }).find(card => canExhaustCard(card.faces[0]));
  let party = assign(fresh(), 'mnemos', eligible);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', exhausted: true });
  assert.equal(memoryAt(party.argonauts[0], 'mnemos', 0).exhausted, true);
  const fated = catalogue.search({ family: 'Fated Mnemos' })[0];
  party = assign(fresh(), 'fated-mnemos', fated);
  assert.equal(reduce(party, { type: 'memory-state', instanceId: 'm', exhausted: true }), party);
  party.argonauts[0].instances[0].exhausted = true;
  party = reduce(parseParty(structuredClone(party)), { type: 'memory-state', instanceId: 'm', exhausted: false });
  assert.equal(party.argonauts[0].instances[0].exhausted, false);
  const input = structuredClone(raw);
  input.cards.find(card => card.id === fated.id).faces[0].data.growthAbility = sentence('Reflex', ['Exhaust']);
  const repo = createCatalogueRepository(input);
  assert.equal(reduce(party, { type: 'memory-state', instanceId: 'm', exhausted: true }, repo), party);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', progress: { node: 3 } }, repo);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', exhausted: true }, repo);
  assert.equal(party.argonauts[0].instances[0].exhausted, true);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', progress: { node: 2 } }, repo);
  assert.equal(memoryProgress(party.argonauts[0].instances[0]).node, 2);
  party = reduce(party, { type: 'memory-state', instanceId: 'm', exhausted: false }, repo);
  assert.equal(reduce(party, { type: 'memory-state', instanceId: 'm', exhausted: true }, repo), party);
});

test('Titan exhaustion respects costs, ownership, selection changes and historical Ready recovery', () => {
  const select = (party, name) => reduce(party, { type: 'titan', titan: { id: 't', definitionId: named(name).id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} } });
  let party = select(fresh(), 'Gamechanger');
  assert.equal(reduce(party, { type: 'titan-exhausted', argonautId: 'b', exhausted: true }), party);
  party = reduce(party, { type: 'titan-exhausted', exhausted: true });
  assert.equal(party.argonauts[0].titan.exhausted, true);
  party = reduce(party, { type: 'titan-exhausted', exhausted: false });
  assert.equal(party.argonauts[0].titan.exhausted, false);
  party = select(party, 'Trespasser');
  assert.equal(reduce(party, { type: 'titan-exhausted', exhausted: true }), party);
  party.argonauts[0].titan.exhausted = true;
  party = reduce(parseParty(structuredClone(party)), { type: 'titan-exhausted', exhausted: false });
  assert.equal(party.argonauts[0].titan.exhausted, false);
  const empty = fresh();
  assert.equal(reduce(empty, { type: 'titan-exhausted', exhausted: true }), empty);
});
