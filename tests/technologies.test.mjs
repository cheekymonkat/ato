import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { activeTechnologyIds, argoAbilityLimit, changeTechnology, currentCoreTechnologies, parseTechnologyRequirement, projectList, researchedTechnologyIds, resolveTechnologyName, technologyLeadsTo, technologyName, technologyRequirementStatus, technologyResearchStatus, technologyType } from '../src/domain/technologies.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup, referenceProblems, parseWorkspace } from '../src/storage/workspace.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const card = (name, cycle) => catalogue.byName(name).find(card => card.family === 'Technology' && (!cycle || card.faces[0].cycle === cycle));
const fresh = () => createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
const research = (party, name) => changeTechnology(party, card(name).id, 'research', catalogue);
const ready = (party, name) => technologyResearchStatus(card(name), party, catalogue).canResearch;
const status = (text, party = fresh()) => technologyRequirementStatus(parseTechnologyRequirement(text, card('Trireme Weapons'), catalogue), party, catalogue);

test('all 319 technologies are classified; Core is never a project', () => {
  const all = catalogue.search({ family: 'Technology' });
  assert.equal(all.length, 319);
  assert.ok(all.every(card => technologyType(card)));
  assert.equal(technologyType(card('Nietzschean Sighting')), 'Argo Ability');
  for (const cycle of [1, 2, 3, 4, 5]) {
    const projects = projectList({ ...fresh(), campaignCycle: cycle }, catalogue);
    assert.ok(projects.every(card => technologyType(card) !== 'Core'));
    assert.ok(projects.every(card => technologyResearchStatus(card, { ...fresh(), campaignCycle: cycle }, catalogue).canResearch));
  }
});

test('automatic Propylon unlocks weapons and armor; ranged weapons require both', () => {
  const original = fresh();
  assert.equal(ready(original, 'Trireme Weapons'), true);
  assert.equal(ready(original, 'Trireme Armor'), true);
  assert.equal(changeTechnology(original, card('Antikratos Project').id, 'research', catalogue), original);
  let party = original;
  assert.equal(ready(party, 'Trireme Weapons'), true);
  assert.equal(ready(party, 'Trireme Armor'), true);
  assert.equal(ready(party, 'Trireme Ranged Weapons'), false);
  assert.deepEqual(technologyLeadsTo(card('Antikratos Project'), catalogue).map(card => card.faces[0].name), ['Trireme Weapons', 'Trireme Armor']);
  party = research(party, 'Trireme Weapons');
  assert.equal(ready(party, 'Trireme Ranged Weapons'), false);
  party = research(party, 'Trireme Armor');
  assert.equal(ready(party, 'Trireme Ranged Weapons'), true);
  party = research(party, 'Trireme Ranged Weapons');
  assert.equal(ready(party, 'Arrow Barrage'), true);
  party = research(party, 'Arrow Barrage');
  assert.equal(ready(party, 'Crisis Protocol'), true);
  assert.equal(ready(party, 'Basic Support Equipment'), true);
  assert.equal(ready(party, 'Arrow Barrage'), false);
  assert.deepEqual(party.argonauts, original.argonauts);
  assert.deepEqual(party.resources, original.resources);
  assert.equal(original.technologies, undefined);
});

test('project and researched names both resolve to automatic Core technologies', () => {
  let party = fresh();
  assert.equal(ready(party, 'Trading Solutions'), true);
  assert.equal(status('Grand Agora', party).met, true);
  party = research(party, 'Trading Solutions');
  assert.equal(ready(party, 'Diplomatic Relations'), true);
  assert.equal(ready(party, 'Rhetoric'), true);
  assert.equal(ready(party, 'Titan Hunting'), false);
  party = research(party, 'Rhetoric');
  assert.equal(ready(party, 'Titan Hunting'), true);
  const required = parseTechnologyRequirement('Titanoaristia / Titan Stoa', card('Advanced Titan Breeding'), catalogue);
  assert.deepEqual(required.definitionIds, [card('Titanoaristia').id]);
  assert.equal(technologyName(card('Antikratos Project'), 'technology'), 'Excursion Propylon');
});

test('AND/EITHER/OR retain tracked requirements and ignore unsupported game checks', () => {
  const ids = names => ({ ...fresh(), technologies: { version: 1, researched: names.map(name => card(name).id) } });
  const expression = 'Advanced Trireme Weapons and either: Teleresuscitation OR Trireme Reach Weapons';
  assert.equal(status(expression, ids(['Advanced Trireme Weapons'])).met, false);
  assert.equal(status(expression, ids(['Teleresuscitation'])).met, false);
  assert.equal(status(expression, ids(['Advanced Trireme Weapons', 'Teleresuscitation'])).met, true);
  assert.equal(status(expression, ids(['Advanced Trireme Weapons', 'Trireme Reach Weapons'])).met, true);
  const other = 'Calculate Statistical Certainty AND EITHER Dragon of Phobos Live Study OR Meduketos Live Study';
  assert.equal(status(other, ids(['Calculate Statistical Certainty'])).met, false);
  assert.equal(status(other, ids(['Calculate Statistical Certainty', 'Meduketos Live Study'])).met, true);
  assert.deepEqual(status('45+ explored tiles'), { text: '45+ explored tiles', tracked: false, met: true });
  assert.equal(status('Temenos LVL 1 Battle and either: Labyrinthauros Live Study OR Hekaton Live Study').met, false);
  assert.equal(status('Temenos LVL 1 Battle and either: Labyrinthauros Live Study OR Hekaton Live Study', ids(['Hekaton Live Study'])).met, true);
  assert.equal(status('Trireme Weapons OR 45+ explored tiles').met, false, 'An ignored alternative cannot bypass supported requirements');
  assert.equal(status('and either: Hypertime Oracle LVL 2 Battle OR gain +1 Paradox').met, true);
});

test('recorded Argo Knowledge and Argo Fate thresholds block research until met', () => {
  const original = fresh();
  assert.equal(ready(original, 'Mnestis Thesis'), false);
  assert.equal(ready({ ...original, resources: { 'Argo Knowledge': 5 } }, 'Mnestis Thesis'), false);
  for (const key of ['Argo Knowledge', 'ArgoKnowledge', '@ArgoKnowledge', 'argo knowledge']) {
    assert.equal(ready({ ...original, resources: { [key]: 6 } }, 'Mnestis Thesis'), true);
  }
  assert.equal(status('@ArgoFate 46+', { ...original, resources: { 'Argo Fate': 45 } }).met, false);
  assert.equal(status('@ArgoFate 46+', { ...original, resources: { 'Argo Fate': 46 } }).met, true);
  assert.deepEqual(original.resources, {});
});

test('known source typos resolve explicitly without altering printed data', () => {
  for (const [typo, canonical] of [['Theseus Methods', 'Theseus Method'], ['Grassroots Projects', 'Grassroot Projects'], ['Forved Kratos Reaction', 'Forced Kratos Reaction'], ['Sanstorm Sailling', 'Sandstorm Sailing']]) {
    assert.deepEqual(resolveTechnologyName(typo, card('Trireme Weapons'), catalogue).map(card => card.faces[0].name), [canonical]);
  }
  assert.equal(status('Sisyphus Gear').tracked, false);
  assert.ok(card('Odyssey Training').faces[0].data.requirements.includes('Sanstorm Sailling'));
});

test('technology reducer rejects wrong campaign, unknown Argonaut, invalid operations, duplicates and future cycles', () => {
  const party = fresh(), core = card('Antikratos Project');
  const action = { type: 'technology-research', partyId: party.id, argonautId: 'a', definitionId: card('Trireme Weapons').id };
  assert.equal(partyReducer(party, { ...action, partyId: 'other' }, catalogue), party);
  assert.equal(partyReducer(party, { ...action, argonautId: 'other' }, catalogue), party);
  assert.equal(partyReducer(party, action), party);
  assert.equal(partyReducer(party, { ...action, definitionId: core.id }, catalogue), party);
  assert.equal(partyReducer(party, { ...action, definitionId: card('Trireme Ranged Weapons').id }, catalogue), party);
  assert.equal(changeTechnology(party, 'missing', 'research', catalogue), party);
  assert.equal(changeTechnology(party, catalogue.search({ family: 'Gear' })[0].id, 'research', catalogue), party);
  const laterCore = catalogue.search({ family: 'Technology', cycle: 'Cycle V' }).find(card => technologyType(card) === 'Core');
  assert.equal(changeTechnology(party, laterCore.id, 'research', catalogue), party);
  const updated = partyReducer(party, action, catalogue);
  assert.deepEqual(researchedTechnologyIds(updated), [action.definitionId]);
  assert.equal(partyReducer(updated, action, catalogue), updated);
});

test('confirmed removal retains successors while recalculating future project gates', () => {
  let party = research(research(research(fresh(), 'Trireme Weapons'), 'Trireme Armor'), 'Trireme Ranged Weapons');
  const action = { type: 'technology-remove', partyId: party.id, argonautId: 'a', definitionId: card('Trireme Weapons').id, confirmed: false };
  assert.equal(partyReducer(party, action, catalogue), party);
  party = partyReducer(party, { ...action, confirmed: true }, catalogue);
  assert.deepEqual(researchedTechnologyIds(party), [card('Trireme Armor').id, card('Trireme Ranged Weapons').id]);
  assert.equal(status('Trireme Weapons', party).met, false);
  const withLater = { ...party, campaignCycle: 1, technologies: { version: 1, researched: [...researchedTechnologyIds(party), card('War Propylon').id] } };
  assert.ok(researchedTechnologyIds(withLater).includes(card('War Propylon').id));
  assert.ok(!projectList(withLater, catalogue).some(card => card.faces[0].cycle === 'Cycle II'));
});

test('AA limit includes automatic Propylon and updates when a researched upgrade is removed', () => {
  const party = fresh();
  assert.equal(argoAbilityLimit(party, catalogue), 2);
  const later = { ...party, technologies: { version: 1, researched: [...researchedTechnologyIds(party), card('War Propylon').id] } };
  assert.equal(argoAbilityLimit(later, catalogue), 4);
  assert.equal(argoAbilityLimit(changeTechnology(later, card('War Propylon').id, 'remove', catalogue), catalogue), 2);
});

test('technology records persist through saves/backups and invalid lists are rejected', () => {
  const party = research(fresh(), 'Trireme Weapons');
  const profile = { id: party.id, name: 'Technology expedition', party };
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  assert.deepEqual(parseWorkspace(JSON.parse(JSON.stringify({ format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile] }))).profiles[0], profile);
  assert.deepEqual(researchedTechnologyIds(parseParty(fresh())), []);
  for (const technologies of [null, { version: 2, researched: [] }, { version: 1, researched: ['x', 'x'] }, { version: 1, researched: [3] }, { version: 1, researched: [''] }]) {
    assert.throws(() => parseParty({ ...party, technologies }), /campaign technologies/);
  }
  const broken = { ...party, technologies: { version: 1, researched: ['missing'] } };
  assert.match(referenceProblems(broken, catalogue)[0], /unavailable Technology missing/);
  assert.throws(() => readBackup(exportProfile({ ...profile, party: broken }), catalogue), /unresolved references/);
});

test('all five Core cards follow the exact campaign cycle without needing saved acquisitions', () => {
  const original = fresh();
  for (const cycle of [1, 2, 3, 4, 5]) {
    const party = { ...original, campaignCycle: cycle };
    const cores = currentCoreTechnologies(party, catalogue);
    assert.equal(cores.length, 5);
    assert.ok(cores.every(card => card.faces[0].cycle === ['Cycle I', 'Cycle II', 'Cycle III', 'Cycle IV', 'Cycle V'][cycle - 1]));
    assert.deepEqual(activeTechnologyIds(party, catalogue), cores.map(card => card.id));
    for (const core of cores) {
      assert.equal(status(core.faces[0].name, party).met, true);
      assert.equal(technologyResearchStatus(core, party, catalogue).canResearch, false);
      assert.equal(changeTechnology(party, core.id, 'remove', catalogue), party);
      assert.equal(changeTechnology(party, core.id, 'research', catalogue), party);
    }
    assert.equal(party.technologies, undefined);
  }
  assert.equal(ready({ ...original, campaignCycle: 3 }, 'Advanced Titan Breeding'), true);
  assert.equal(ready({ ...original, campaignCycle: 2 }, 'Advanced Titan Breeding'), false);
  assert.deepEqual(original, fresh());
});

test('legacy recorded Core IDs are preserved and current-cycle Core cards remain unique and unremovable', () => {
  const core = card('Antikratos Project');
  const party = { ...fresh(), technologies: { version: 1, researched: [core.id] } };
  assert.equal(activeTechnologyIds(party, catalogue).filter(id => id === core.id).length, 1);
  assert.equal(partyReducer(party, { type: 'technology-remove', partyId: 'p', argonautId: 'a', definitionId: core.id, confirmed: true }, catalogue), party);
  assert.deepEqual(researchedTechnologyIds(parseParty(party)), [core.id]);
  let changed = party;
  for (const expectedCycle of [1, 2, 3]) changed = partyReducer(changed, { type: 'advance-cycle', partyId: party.id, argonautId: 'a', expectedCycle, confirmed: true }, catalogue);
  assert.deepEqual(researchedTechnologyIds(changed), [core.id]);
  assert.ok(currentCoreTechnologies(changed, catalogue).every(card => card.faces[0].cycle === 'Cycle IV'));
});
