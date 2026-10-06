import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty } from '../src/domain/party.ts';
import { TECHNOLOGY_CYCLE_POLICY } from '../src/domain/technology-rules.ts';
import { activeTechnologyIds, changeTechnology, projectList, researchedTechnologyIds, technologyAvailable,
  technologyAutomatic, technologyCycle, technologyLimit, technologyResearchStatus, technologyType,
  parseTechnologyRequirement, technologyRequirementStatus } from '../src/domain/technologies.ts';
import { argoTrack, argoTrackDefinition } from '../src/domain/argo.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';

const raw = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(raw);
const fresh = cycle => ({ ...createParty('p', ['a', 'b', 'c', 'd'], catalogue.version), campaignCycle: cycle });
const byId = id => { const cards = catalogue.byPrintedId(id); assert.equal(cards.length, 1, id); return cards[0]; };
const all = catalogue.search({ family: 'Technology' });

test('all named cycle-only technologies retire on schedule, including repeated-name editions', () => {
  for (const [cycleText, entries] of Object.entries(TECHNOLOGY_CYCLE_POLICY.cycleOnly)) {
    const cycle = Number(cycleText);
    for (const [id, name] of Object.entries(entries)) {
      const card = byId(id);
      assert.equal(card.faces[0].name, name, id);
      assert.deepEqual(card.technologyRules.availableCycles, [cycle]);
      assert.equal(technologyAvailable(card, fresh(cycle)), true);
      const later = { ...fresh(cycle + 1), technologies: { version: 1, researched: [card.id] } };
      assert.equal(technologyAvailable(card, later), false);
      assert.equal(activeTechnologyIds(later, catalogue).includes(card.id), false);
      assert.equal(projectList(later, catalogue).some(project => project.id === card.id), false);
      assert.equal(catalogue.search({ family: 'Technology', campaignCycle: cycle + 1, query: id }).length, 0);
      assert.equal(changeTechnology(later, card.id, 'research', catalogue), later);
      assert.deepEqual(researchedTechnologyIds(later), [card.id], 'Retirement preserves the save record');
      assert.deepEqual(readBackup(exportProfile({ id: later.id, name: 'Inherited', party: later }), catalogue).profile.party, later);
    }
  }
  assert.deepEqual(byId('AA0031').technologyRules.availableCycles, [1]);
  assert.deepEqual(byId('CA1626').technologyRules.availableCycles, [3], 'Cycle III Intelligence Gathering has its own rule');
});

test('Cycle III and IV Structural restrictions cover every card, while Combat and Core carry forward', () => {
  for (const cycle of [3, 4]) {
    const exceptions = TECHNOLOGY_CYCLE_POLICY.structuralCarryForward[cycle];
    for (const [id, name] of Object.entries(exceptions)) assert.equal(byId(id).faces[0].name, name);
    const cards = all.filter(card => technologyCycle(card) === cycle);
    for (const card of cards) {
      const carries = technologyType(card) !== 'Structural' || card.printedIds.some(id => Object.hasOwn(exceptions, id));
      assert.equal(technologyAvailable(card, fresh(cycle)), true, card.faces[0].name);
      for (let later = cycle + 1; later <= 5; later++) {
        assert.equal(technologyAvailable(card, fresh(later)), carries, card.faces[0].name);
        assert.equal(activeTechnologyIds(fresh(later), catalogue).includes(card.id), carries, card.faces[0].name);
      }
    }
  }
  assert.ok(all.filter(card => technologyCycle(card) === 5).every(card => technologyAvailable(card, fresh(5))));
});

test('new and advanced later-cycle campaigns automatically gain applicable earlier technologies, without save mutations', () => {
  for (const cycle of [2, 3, 4, 5]) {
    const party = fresh(cycle), ids = activeTechnologyIds(party, catalogue);
    assert.equal(new Set(ids).size, ids.length);
    const earlier = all.filter(card => technologyCycle(card) < cycle && technologyAvailable(card, party));
    assert.ok(earlier.length > 0);
    for (const card of earlier) {
      assert.ok(ids.includes(card.id), card.faces[0].name);
      assert.equal(technologyAutomatic(card, party), true);
      assert.equal(technologyResearchStatus(card, party, catalogue).canResearch, false);
      assert.equal(changeTechnology(party, card.id, 'remove', catalogue), party);
    }
    assert.ok(projectList(party, catalogue).every(card => technologyCycle(card) === cycle));
    assert.deepEqual(researchedTechnologyIds(party), []);
  }
  const previous = fresh(1);
  const advanced = partyReducer(previous, { type: 'advance-cycle', partyId: previous.id, argonautId: 'a', expectedCycle: 1, confirmed: true }, catalogue);
  assert.deepEqual(activeTechnologyIds(advanced, catalogue), activeTechnologyIds(fresh(2), catalogue));
  assert.equal(advanced.technologies, undefined);
});

test('retired prerequisite research is inherited historically but future saved records do not satisfy gates', () => {
  const source = byId('CA1628');
  const retired = parseTechnologyRequirement('Diplomatic Relations', source, catalogue);
  assert.equal(technologyRequirementStatus(retired, fresh(2), catalogue).met, true);
  assert.equal(activeTechnologyIds(fresh(2), catalogue).includes(byId('AA0034').id), false);
  const future = byId('BA1038');
  const party = { ...fresh(1), technologies: { version: 1, researched: [future.id] } };
  assert.equal(technologyRequirementStatus(parseTechnologyRequirement('War Propylon', source, catalogue), party, catalogue).met, false);
  assert.equal(activeTechnologyIds(party, catalogue).includes(future.id), false);
});

test('absolute limit upgrades use the maximum, including abbreviated AA limits and lower later Core capacities', () => {
  const expected = [
    [null, null, 10, 2, null, null], [5, 8, 15, 3, null, 1], [6, 9, 20, 4, null, 2],
    [7, 10, 20, 4, null, 2], [7, 10, 20, 5, 1, 2],
  ];
  const keys = ['hull', 'crew', 'titans', 'argoAbilities', 'argoOxygen', 'summons'];
  for (const cycle of [1, 2, 3, 4, 5]) assert.deepEqual(keys.map(key => technologyLimit(fresh(cycle), catalogue, key)), expected[cycle - 1]);
  const withCards = (cycle, ids) => ({ ...fresh(cycle), technologies: { version: 1, researched: ids.map(id => byId(id).id) } });
  assert.equal(technologyLimit(withCards(1, ['AA0041']), catalogue, 'argoAbilities'), 3);
  assert.equal(technologyLimit(withCards(2, ['BA1038']), catalogue, 'argoAbilities'), 4);
  assert.equal(technologyLimit(withCards(4, ['DA2216']), catalogue, 'argoAbilities'), 5);
  assert.equal(technologyLimit(withCards(2, ['BA1042']), catalogue, 'titans'), 20);
  const oxygen = withCards(5, ['EA2777', 'EA2779']);
  assert.equal(technologyLimit(oxygen, catalogue, 'argoOxygen'), 3);
  assert.equal(argoTrack(oxygen, argoTrackDefinition('argo-oxygen', 5), catalogue).limit, 3);
  assert.equal(technologyLimit(withCards(3, ['CA1634']), catalogue, 'summons'), 3);
  assert.equal(technologyLimit(withCards(4, ['CA1634']), catalogue, 'summons'), 2, 'Retired Adyton Completion no longer raises the limit');
});

test('derived catalogue technology rules validate, and older snapshots use the same availability and limits', () => {
  const legacy = structuredClone(raw);
  legacy.cards.forEach(card => delete card.technologyRules);
  const oldCatalogue = createCatalogueRepository(legacy);
  for (const cycle of [1, 2, 3, 4, 5]) {
    assert.deepEqual(activeTechnologyIds(fresh(cycle), oldCatalogue), activeTechnologyIds(fresh(cycle), catalogue));
    assert.equal(technologyLimit(fresh(cycle), oldCatalogue, 'argoAbilities'), technologyLimit(fresh(cycle), catalogue, 'argoAbilities'));
  }
  for (const rules of [{ version: 2, availableCycles: [1], limits: {} }, { version: 1, availableCycles: [1, 2], limits: {} },
    { version: 1, availableCycles: [1], limits: { hull: 999 } }]) {
    const corrupt = structuredClone(raw);
    corrupt.cards.find(card => card.printedIds.includes('AA0049')).technologyRules = rules;
    assert.throws(() => createCatalogueRepository(corrupt), /technology rules/);
  }
});
