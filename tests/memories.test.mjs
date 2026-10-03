import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { makeFace } from '../src/domain/cards.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { assignMemory, duplicateMemories, memoryConflict, fatedGrowthAvailable, MEMORY_GATEWAYS, memoryAbilityAvailable, memoryAt, memoryNodeLimit, memoryProgress } from '../src/domain/memories.ts';
import { fatedMemorySide, memoryAbilityGroups, memoryAbilityPanels } from '../src/domain/memory-presentation.ts';
import { argonautSkills, memorySkillModifiers } from '../src/domain/argonaut-stats.ts';
import { formatParagraph } from '../src/domain/card-presentation.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup, importProfile, parseWorkspace, referenceProblems } from '../src/storage/workspace.ts';

const raw = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(raw);
const fresh = () => createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
const [memory, memory2] = catalogue.search({ family: 'Mnemos' }), [fated, fated2, fated3] = catalogue.search({ family: 'Fated Mnemos' });
const assign = (party, owner, kind, index, id, definition = kind === 'mnemos' ? memory : fated, repo = catalogue) => partyReducer(party, {
  type: 'memory', argonautId: owner, request: { kind, index, instanceId: id, definitionId: definition.id, faceId: 'front' },
}, repo);
const update = (party, id, changes, owner = 'a', repo = catalogue) => partyReducer(party, { type: 'memory-state', argonautId: owner, instanceId: id, ...changes }, repo);
const legacyExhausted = (party, id) => {
  const saved = structuredClone(party);
  saved.argonauts.flatMap(member => member.instances).find(item => item.id === id).exhausted = true;
  return parseParty(saved);
};

test('memory slots retain empty gaps and second-card progress when the first is removed', () => {
  let party = assign(fresh(), 'a', 'mnemos', 1, 'second', memory2);
  assert.deepEqual(party.argonauts[0].mnemosIds, [null, 'second']);
  party = update(party, 'second', { progress: { node: 3 }, exhausted: true });
  party = assign(party, 'a', 'mnemos', 0, 'first', memory2);
  party = partyReducer(party, { type: 'remove-memory', argonautId: 'a', kind: 'mnemos', index: 0 }, catalogue);
  assert.deepEqual(party.argonauts[0].mnemosIds, [null, 'second']);
  assert.equal(memoryAt(party.argonauts[0], 'mnemos', 0), undefined);
  assert.equal(memoryProgress(memoryAt(party.argonauts[0], 'mnemos', 1)).node, 3);
  assert.equal(memoryAt(party.argonauts[0], 'mnemos', 1).exhausted, true);
  assert.equal(party.argonauts[0].instances.length, 1);
});

test('distinct memories, two families and different Argonauts own independent progress and exhaustion', () => {
  let party = assign(assign(assign(assign(fresh(), 'a', 'mnemos', 0, 'm1'), 'a', 'mnemos', 1, 'm2', memory2), 'a', 'fated-mnemos', 0, 'f1'), 'b', 'fated-mnemos', 0, 'f2', fated2);
  party = update(party, 'm1', { progress: { node: 0 }, exhausted: true });
  party = update(party, 'm2', { progress: { node: 7 } });
  party = update(party, 'f1', { progress: { node: 3, growthUnlocked: true } });
  assert.deepEqual(memoryProgress(party.argonauts[0].instances.find(i => i.id === 'm1')), { node: 0, growthUnlocked: false });
  assert.equal(party.argonauts[0].instances.find(i => i.id === 'm2').exhausted, false);
  assert.deepEqual(memoryProgress(party.argonauts[1].instances[0]), { node: 0, growthUnlocked: false });
  assert.equal(update(party, 'f1', { progress: { node: 99 } }, 'b'), party);
  assert.equal(JSON.stringify(catalogue.get(memory.id)), JSON.stringify(raw.cards.find(c => c.id === memory.id)));
  assert.deepEqual(party.argonauts[0].skills, fresh().argonauts[0].skills);
});

test('replacement resets only the replaced memory; reselecting it preserves its state', () => {
  let party = assign(assign(fresh(), 'a', 'fated-mnemos', 0, 'f1'), 'a', 'fated-mnemos', 1, 'f2', fated2);
  party = update(update(party, 'f1', { progress: { node: 3, growthUnlocked: true } }), 'f2', { progress: { node: 2 } });
  party = legacyExhausted(party, 'f1');
  const same = assign(party, 'a', 'fated-mnemos', 0, 'f1');
  assert.deepEqual(same.argonauts[0].instances, party.argonauts[0].instances);
  const next = assign(party, 'a', 'fated-mnemos', 0, 'new', fated3);
  assert.equal(next.argonauts[0].instances.some(i => i.id === 'f1'), false);
  assert.deepEqual(memoryProgress(memoryAt(next.argonauts[0], 'fated-mnemos', 0)), { node: 0, growthUnlocked: false });
  assert.equal(memoryProgress(memoryAt(next.argonauts[0], 'fated-mnemos', 1)).node, 2);
  assert.equal(memoryAt(next.argonauts[0], 'fated-mnemos', 0).exhausted, false);
  const cleared = update(same, 'f1', { progress: { node: null } });
  assert.deepEqual(memoryProgress(memoryAt(cleared.argonauts[0], 'fated-mnemos', 0)), { node: null, growthUnlocked: true });
});

test('wrong families, stale indices, unsafe progress and instance reuse across areas are rejected', () => {
  const party = assign(assign(fresh(), 'a', 'mnemos', 0, 'owned'), 'b', 'fated-mnemos', 0, 'other');
  for (const index of [-1, 2, 0.5, NaN]) assert.equal(assign(party, 'a', 'mnemos', index, 'new'), party);
  for (const definition of [fated, catalogue.search({ family: 'Gear' })[0], catalogue.search({ family: 'Titan' })[0]]) assert.equal(assign(party, 'a', 'mnemos', 1, 'new', definition), party);
  for (const id of ['owned', 'other', 'b', '   ']) assert.equal(assign(party, 'a', 'mnemos', 1, id), party);
  for (const node of [-1, 11, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(update(party, 'owned', { progress: { node } }), party);
  assert.equal(update(party, 'owned', { progress: { growthUnlocked: true } }), party);
  assert.equal(update(party, 'owned', { faceId: 'back' }), party);
  const titanParty = partyReducer(party, { type: 'titan', argonautId: 'a', titan: { id: 'titan', definitionId: catalogue.search({ family: 'Titan' })[0].id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} } }, catalogue);
  assert.equal(assign(titanParty, 'a', 'mnemos', 1, 'titan'), titanParty);
});

test('future reversible memories preserve progress independently on face changes and backup round trips', () => {
  // Current exports have only one face. Add an explicit reverse solely as a forward-compatibility fixture.
  const input = structuredClone(raw), fixture = input.cards.find(c => c.id === fated.id);
  fixture.faces.push(makeFace(structuredClone(fixture.faces[0].data), 'back', 'test'));
  const repo = createCatalogueRepository(input);
  let party = assign(assign(fresh(), 'a', 'fated-mnemos', 0, 'first', fated, repo), 'a', 'fated-mnemos', 1, 'second', fated2, repo);
  party = legacyExhausted(party, 'first');
  party = update(party, 'first', { faceId: 'back', progress: { node: 3, growthUnlocked: true } }, 'a', repo);
  assert.equal(memoryAt(party.argonauts[0], 'fated-mnemos', 0).faceId, 'back');
  assert.equal(memoryAt(party.argonauts[0], 'fated-mnemos', 1).faceId, 'front');
  assert.equal(assign(party, 'b', 'fated-mnemos', 0, 'copy', fated, repo), party);
  const profile = { id: party.id, name: 'Memories', party };
  const restored = readBackup(exportProfile(profile), repo).profile;
  assert.deepEqual(restored, profile); assert.deepEqual(parseParty(JSON.parse(JSON.stringify(party))), party);
  const workspace = parseWorkspace(fresh()), imported = importProfile(workspace, restored, 'imported', 'Restored memories');
  assert.deepEqual(imported.profiles[1].party.argonauts, party.argonauts);
  assert.deepEqual(workspace.profiles[0].party, fresh());
});

test('save validation rejects malformed progress, duplicate assignments and invalid override shapes', () => {
  const party = assign(fresh(), 'a', 'mnemos', 0, 'm');
  for (const progress of [{ node: -1, growthUnlocked: false }, { node: 0 }, { node: '2', growthUnlocked: false }, { node: null, growthUnlocked: 'yes' }]) {
    const input = structuredClone(party); input.argonauts[0].instances[0].memoryProgress = progress;
    assert.throws(() => parseParty(input), /memory progress/);
  }
  const duplicate = structuredClone(party); duplicate.argonauts[0].mnemosIds[1] = 'm';
  assert.throws(() => parseParty(duplicate), /multiple areas/);
  const broken = structuredClone(party); broken.argonauts[0].tableOverrides.kratos = { definitionId: memory.id, faceId: 'sideways' };
  assert.throws(() => parseParty(broken), /table overrides/);
});

test('node +/- actions apply sequentially, cap Mnemos at 10 and Fated at 3, keeping Growth separate', () => {
  let party = assign(assign(assign(fresh(), 'a', 'mnemos', 0, 'first'), 'a', 'mnemos', 1, 'second', memory2), 'a', 'fated-mnemos', 0, 'fated');
  const step = (id, delta, owner = 'a') => { party = partyReducer(party, { type: 'memory-node', argonautId: owner, instanceId: id, delta }, catalogue); };
  const initial = party; step('first', -1); assert.equal(party, initial);
  for (let i = 0; i < 10; i++) step('first', 1);
  assert.equal(memoryAt(party.argonauts[0], 'mnemos', 0).memoryProgress.node, 10);
  const capped = party; step('first', 1); assert.equal(party, capped);
  step('first', -1); step('first', -1);
  assert.equal(memoryAt(party.argonauts[0], 'mnemos', 0).memoryProgress.node, 8);
  assert.equal(memoryAt(party.argonauts[0], 'mnemos', 1).memoryProgress.node, 0);
  const ownerCheck = party; step('first', 1, 'b'); assert.equal(party, ownerCheck);
  for (let i = 0; i < 10; i++) step('fated', 1);
  assert.deepEqual(memoryAt(party.argonauts[0], 'fated-mnemos', 0).memoryProgress, { node: 3, growthUnlocked: false });
  const profile = { id: party.id, name: 'Node trackers', party };
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
});

test('unrecorded and historical out-of-range saves are preserved until explicitly corrected', () => {
  let party = assign(fresh(), 'a', 'mnemos', 0, 'memory');
  party = update(party, 'memory', { progress: { node: null } });
  const incremented = partyReducer(party, { type: 'memory-node', argonautId: 'a', instanceId: 'memory', delta: 1 }, catalogue);
  assert.equal(memoryAt(incremented.argonauts[0], 'mnemos', 0).memoryProgress.node, 1);
  party.argonauts[0].instances[0].memoryProgress.node = 12;
  assert.equal(parseParty(party).argonauts[0].instances[0].memoryProgress.node, 12);
  assert.equal(partyReducer(party, { type: 'memory-node', argonautId: 'a', instanceId: 'memory', delta: -1 }, catalogue), party);
  assert.equal(update(party, 'memory', { exhausted: true }).argonauts[0].instances[0].memoryProgress.node, 12);
  assert.equal(update(party, 'memory', { progress: { node: 10 } }).argonauts[0].instances[0].memoryProgress.node, 10);
});

test('Mnemos presentation retains each source ability panel, including grouped sentences, gates and costs', () => {
  for (const card of catalogue.search({ family: 'Mnemos' })) for (const face of card.faces) {
    const groups = memoryAbilityGroups(face);
    assert.deepEqual(groups, face.data.abilities);
    assert.equal(groups.length, face.data.abilities.length);
    for (const group of groups) {
      const presentation = formatParagraph(group, true);
      assert.deepEqual(presentation.diagnostics, [], face.name);
      for (const sentence of group) {
        if (sentence.gate) assert.ok(presentation.label.includes(sentence.gate));
        for (const cost of sentence.costs || []) assert.ok(presentation.label.includes(`[${cost}]`));
      }
    }
  }
});

test('every Fated memory switches from its original front to only its embedded Growth data at three nodes', () => {
  for (const card of catalogue.search({ family: 'Fated Mnemos' })) {
    const original = structuredClone(card), face = card.faces[0];
    for (const progress of [undefined, ...[null, 0, 1, 2].map(node => ({ node, growthUnlocked: true }))]) {
      assert.deepEqual(fatedMemorySide(face, progress), { resolved: false, name: face.name, ability: face.data.effect,
        flavor: face.data.flavor, traits: face.data.traits, stats: face.data.stats }, face.name);
    }
    for (const node of [3, 8]) {
      const side = fatedMemorySide(face, { node, growthUnlocked: false });
      assert.deepEqual(side, { resolved: true, name: face.data.growthName, ability: face.data.growthAbility,
        flavor: undefined, traits: [], stats: [] }, face.name);
      assert.ok(side.name.trim());
      assert.deepEqual(formatParagraph(side.ability, true).diagnostics, [], face.name);
    }
    assert.deepEqual(card, original);
  }
});

test('Fated node transitions flip the same unique card, restore the Growth side and reverse below three nodes', () => {
  let party = assign(fresh(), 'a', 'fated-mnemos', 0, 'f');
  party = legacyExhausted(party, 'f');
  const side = () => fatedMemorySide(fated.faces[0], memoryAt(party.argonauts[0], 'fated-mnemos', 0).memoryProgress);
  const step = delta => { party = partyReducer(party, { type: 'memory-node', argonautId: 'a', instanceId: 'f', delta }, catalogue); };
  assert.equal(side().resolved, false);
  step(1); assert.equal(side().resolved, false);
  step(1); assert.equal(side().resolved, false);
  step(1); assert.equal(side().name, fated.faces[0].data.growthName);
  party = readBackup(exportProfile({ id: party.id, name: 'Resolved Fated', party }), catalogue).profile.party;
  assert.equal(side().resolved, true);
  assert.equal(assign(party, 'b', 'fated-mnemos', 0, 'copy'), party);
  step(-1); assert.equal(side().name, fated.faces[0].name);
  step(1); assert.equal(side().resolved, true);
  const instance = memoryAt(party.argonauts[0], 'fated-mnemos', 0);
  assert.equal(instance.id, 'f'); assert.equal(instance.faceId, 'front'); assert.equal(instance.exhausted, true);
});

test('equipped memory stats stack, follow replacement/removal and stay isolated through restore', () => {
  let party = fresh();
  for (const skill of Object.values(argonautSkills(party.argonauts[0], catalogue))) assert.equal(skill, 0);
  party = assign(assign(party, 'a', 'mnemos', 0, 'm'), 'a', 'mnemos', 1, 'm2', memory2);
  const expected = Object.fromEntries(Object.keys(party.argonauts[0].skills).map(skill => [skill,
    Number(memory.faces[0].data.stats.includes(skill)) + Number(memory2.faces[0].data.stats.includes(skill))]));
  assert.deepEqual(memorySkillModifiers(party.argonauts[0], catalogue), expected);
  assert.deepEqual(argonautSkills(party.argonauts[0], catalogue), expected);
  party = update(party, 'm', { progress: { node: 0 }, exhausted: true });
  assert.deepEqual(argonautSkills(party.argonauts[0], catalogue), expected);
  assert.deepEqual(argonautSkills(party.argonauts[1], catalogue), fresh().argonauts[1].skills);
  const reselected = assign(party, 'a', 'mnemos', 0, 'm');
  assert.deepEqual(argonautSkills(reselected.argonauts[0], catalogue), expected);
  party = readBackup(exportProfile({ id: party.id, name: 'Skill bonuses', party }), catalogue).profile.party;
  assert.deepEqual(argonautSkills(party.argonauts[0], catalogue), expected);
  assert.deepEqual(party.argonauts[0].skills, fresh().argonauts[0].skills);
  party = partyReducer(party, { type: 'remove-memory', argonautId: 'a', kind: 'mnemos', index: 0 }, catalogue);
  assert.deepEqual(argonautSkills(party.argonauts[0], catalogue), Object.fromEntries(Object.keys(expected).map(skill => [skill, Number(memory2.faces[0].data.stats.includes(skill))])));
  party = assign(party, 'a', 'mnemos', 1, 'replacement', memory);
  assert.deepEqual(argonautSkills(party.argonauts[0], catalogue), Object.fromEntries(Object.keys(expected).map(skill => [skill, Number(memory.faces[0].data.stats.includes(skill))])));
});

test('stat controls reach signed bounds with bonuses, and preserve manual edits when memories leave', () => {
  let party = assign(fresh(), 'a', 'mnemos', 0, 'm');
  const skill = memory.faces[0].data.stats[0];
  const step = delta => { party = partyReducer(party, { type: 'skill', argonautId: 'a', skill, delta }, catalogue); };
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], 1);
  for (let i = 0; i < 10; i++) step(-1);
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], -9);
  const bottom = party; step(-1); assert.equal(party, bottom);
  assert.deepEqual(parseParty(JSON.parse(JSON.stringify(party))), party);
  for (let i = 0; i < 18; i++) step(1);
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], 9);
  const top = party; step(1); assert.equal(party, top);
  party = partyReducer(party, { type: 'remove-memory', argonautId: 'a', kind: 'mnemos', index: 0 }, catalogue);
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], 8);
  step(1);
  party = assign(party, 'a', 'mnemos', 0, 'again');
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], 9);
  step(-1); assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], 8);
  party = partyReducer(party, { type: 'remove-memory', argonautId: 'a', kind: 'mnemos', index: 0 }, catalogue);
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], 7);
  assert.equal(partyReducer(party, { type: 'skill', argonautId: 'a', skill, delta: 2 }, catalogue), party);
});

test('every bundled memory maps each printed stat once, with opposite Fated penalties', () => {
  for (const kind of ['mnemos', 'fated-mnemos']) for (const definition of catalogue.search({ family: kind === 'mnemos' ? 'Mnemos' : 'Fated Mnemos' })) {
    const party = assign(fresh(), 'a', kind, 0, 'card', definition);
    const expected = Object.fromEntries(Object.keys(party.argonauts[0].skills).map(skill => [skill,
      definition.faces[0].data.stats.includes(skill) ? kind === 'mnemos' ? 1 : -1 : 0]));
    assert.deepEqual(argonautSkills(party.argonauts[0], catalogue), expected, definition.id);
  }
});

test('Fated penalties disappear only on resolution and return below three nodes without changing manual stats', () => {
  let party = assign(fresh(), 'a', 'fated-mnemos', 0, 'f');
  const skill = fated.faces[0].data.stats[0];
  const value = () => argonautSkills(party.argonauts[0], catalogue)[skill];
  const step = delta => { party = partyReducer(party, { type: 'memory-node', argonautId: 'a', instanceId: 'f', delta }, catalogue); };
  assert.equal(value(), -1);
  party = legacyExhausted(party, 'f'); assert.equal(value(), -1);
  step(1); assert.equal(value(), -1);
  step(1); assert.equal(value(), -1);
  step(1); assert.equal(value(), 0);
  party = readBackup(exportProfile({ id: party.id, name: 'Fated penalty', party }), catalogue).profile.party;
  assert.equal(value(), 0);
  party = partyReducer(party, { type: 'skill', argonautId: 'a', skill, delta: -1 }, catalogue);
  assert.equal(value(), -1);
  step(-1); assert.equal(value(), -2);
  party = partyReducer(party, { type: 'remove-memory', argonautId: 'a', kind: 'fated-mnemos', index: 0 }, catalogue);
  assert.equal(value(), -1);
  party = assign(party, 'a', 'fated-mnemos', 0, 'new'); assert.equal(value(), -2);
  step(1); // Removed ID cannot change the newly equipped card.
  assert.equal(value(), -2);
  for (let i = 0; i < 3; i++) party = partyReducer(party, { type: 'memory-node', argonautId: 'a', instanceId: 'new', delta: 1 }, catalogue);
  assert.equal(value(), -1);
  party = partyReducer(party, { type: 'remove-memory', argonautId: 'a', kind: 'fated-mnemos', index: 0 }, catalogue);
  assert.equal(value(), -1);
});

test('signed stat limits combine positive and negative memories and ignore unassigned or duplicate physical definitions', () => {
  const skill = fated.faces[0].data.stats[0];
  const positive = catalogue.search({ family: 'Mnemos' }).find(card => card.faces[0].data.stats.includes(skill));
  let party = assign(assign(fresh(), 'a', 'mnemos', 0, 'm', positive), 'a', 'fated-mnemos', 0, 'f');
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], 0);
  party.argonauts[0].instances.push({ ...party.argonauts[0].instances[0], id: 'unassigned' });
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], 0);
  const duplicate = structuredClone(party);
  duplicate.argonauts[0].mnemosIds[1] = 'unassigned';
  assert.equal(argonautSkills(duplicate.argonauts[0], catalogue)[skill], 0);
  party = partyReducer(party, { type: 'remove-memory', argonautId: 'a', kind: 'mnemos', index: 0 }, catalogue);
  for (let i = 0; i < 10; i++) party = partyReducer(party, { type: 'skill', argonautId: 'a', skill, delta: 1 }, catalogue);
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], 9);
  const top = party;
  assert.equal(partyReducer(party, { type: 'skill', argonautId: 'a', skill, delta: 1 }, catalogue), top);
  for (let i = 0; i < 18; i++) party = partyReducer(party, { type: 'skill', argonautId: 'a', skill, delta: -1 }, catalogue);
  assert.equal(argonautSkills(party.argonauts[0], catalogue)[skill], -9);
  assert.equal(partyReducer(party, { type: 'skill', argonautId: 'a', skill, delta: -1 }, catalogue), party);
  assert.deepEqual(parseParty(JSON.parse(JSON.stringify(party))), party);
});

test('assigned Mnemos show only unlocked panels while catalogue previews retain all printed groups', () => {
  for (const card of catalogue.search({ family: 'Mnemos' })) {
    const face = card.faces[0], original = structuredClone(face), groups = memoryAbilityGroups(face);
    assert.deepEqual(memoryAbilityPanels(face).map(panel => panel.group), groups);
    for (const node of [null, 0, 2, 3, 6, 7, 10, 7, 6, 3, 2, 0]) {
      const progress = { node, growthUnlocked: false, breakthroughs: [true, true] };
      const panels = memoryAbilityPanels(face, progress);
      const expectedIndices = groups.map((_, index) => index).filter(index => index === 0 || index === 1 && (node ?? 0) >= 3 || index === 2 && (node ?? 0) >= 7);
      assert.deepEqual(panels.map(panel => panel.index), expectedIndices, `${face.name}, ${node} nodes`);
      assert.deepEqual(panels.map(panel => panel.group), expectedIndices.map(index => groups[index]));
    }
    assert.deepEqual(face, original);
  }
});

test('Mnemos abilities follow gateways directly on increments, decrements and saved restores', () => {
  assert.deepEqual(MEMORY_GATEWAYS, [3, 7]);
  let party = assign(assign(fresh(), 'a', 'mnemos', 0, 'm'), 'a', 'mnemos', 1, 'other', memory2);
  const step = delta => { party = partyReducer(party, { type: 'memory-node', argonautId: 'a', instanceId: 'm', delta }, catalogue); };
  const check = nodes => {
    const progress = memoryAt(party.argonauts[0], 'mnemos', 0).memoryProgress;
    assert.equal(progress.node, nodes);
    assert.deepEqual([0, 1, 2].map(index => memoryAbilityAvailable(index, progress)), [true, nodes >= 3, nodes >= 7]);
    assert.equal(memoryAbilityAvailable(1, memoryAt(party.argonauts[0], 'mnemos', 1).memoryProgress), false);
  };
  check(0);
  for (let nodes = 1; nodes <= 10; nodes++) { step(1); check(nodes); }
  const profile = { id: party.id, name: 'Gateway progress', party };
  const restored = readBackup(exportProfile(profile), catalogue).profile;
  assert.deepEqual(restored, profile);
  assert.equal(memoryAbilityAvailable(2, restored.party.argonauts[0].instances[0].memoryProgress), true);
  for (let nodes = 9; nodes >= 0; nodes--) { step(-1); check(nodes); }
  assert.equal(memoryAbilityAvailable(1, { node: null, growthUnlocked: false }), false);
});

test('Fated Growth follows three nodes without confirmation; historical longer tracks are preserved', () => {
  assert.equal(memoryNodeLimit('fated-mnemos'), 3);
  assert.equal(memoryNodeLimit('mnemos'), 10);
  let party = assign(fresh(), 'a', 'fated-mnemos', 0, 'f');
  party = update(party, 'f', { progress: { node: 2 } });
  assert.equal(update(party, 'f', { progress: { growthUnlocked: true } }), party);
  assert.equal(update(party, 'f', { progress: { node: 4 } }), party);
  assert.equal(update(party, 'f', { progress: { breakthroughs: [true, true] } }), party);
  party = update(party, 'f', { progress: { node: 3 } });
  assert.equal(fatedGrowthAvailable(party.argonauts[0].instances[0].memoryProgress), true);
  party = update(party, 'f', { progress: { growthUnlocked: true } });
  assert.equal(fatedGrowthAvailable(party.argonauts[0].instances[0].memoryProgress), true);
  party = update(party, 'f', { progress: { node: 2 } });
  assert.equal(fatedGrowthAvailable(party.argonauts[0].instances[0].memoryProgress), false);
  party.argonauts[0].instances[0].memoryProgress.node = 8;
  assert.equal(parseParty(party).argonauts[0].instances[0].memoryProgress.node, 8);
  assert.equal(update(party, 'f', { exhausted: true }).argonauts[0].instances[0].memoryProgress.node, 8);
  assert.equal(partyReducer(party, { type: 'memory-node', argonautId: 'a', instanceId: 'f', delta: -1 }, catalogue), party);
  assert.equal(update(party, 'f', { progress: { node: 3 } }).argonauts[0].instances[0].memoryProgress.node, 3);
});

test('historical confirmations are preserved and validated but do not gate node-based availability', () => {
  let party = assign(fresh(), 'a', 'mnemos', 0, 'm');
  party = update(party, 'm', { progress: { node: 10 } });
  assert.equal(memoryAbilityAvailable(1, parseParty(party).argonauts[0].instances[0].memoryProgress), true);
  for (const breakthroughs of [[false, false], [true, false], [true, true]]) {
    const progress = { node: 7, growthUnlocked: false, breakthroughs };
    assert.equal(memoryAbilityAvailable(2, progress), true);
    assert.equal(memoryAbilityAvailable(2, { ...progress, node: 2 }), false);
  }
  assert.equal(fatedGrowthAvailable({ node: 3, growthUnlocked: false }), true);
  assert.equal(fatedGrowthAvailable({ node: 2, growthUnlocked: true }), false);
  for (const breakthroughs of [null, [], [true], [true, false, false], ['yes', false], [false, true]]) {
    assert.equal(update(party, 'm', { progress: { breakthroughs } }), party);
    const invalid = structuredClone(party); invalid.argonauts[0].instances[0].memoryProgress.breakthroughs = breakthroughs;
    assert.throws(() => parseParty(invalid), /memory breakthroughs/);
  }
});

test('each memory definition is unique across slots and all four Argonauts, regardless of instance ID', () => {
  for (const kind of ['mnemos', 'fated-mnemos']) {
    const definition = kind === 'mnemos' ? memory : fated;
    const another = kind === 'mnemos' ? memory2 : fated2;
    let party = assign(fresh(), 'a', kind, 0, 'original', definition);
    party = update(party, 'original', { progress: { node: 2 } });
    party = legacyExhausted(party, 'original');
    assert.equal(assign(party, 'a', kind, 1, 'different-instance', definition), party);
    for (const owner of ['b', 'c', 'd']) assert.equal(assign(party, owner, kind, 0, `copy-${owner}`, definition), party);
    const current = party.argonauts[0];
    assert.equal(assignMemory(current, { kind, index: 1, definitionId: definition.id, faceId: 'front', instanceId: 'direct-copy' }, catalogue), current);
    party = assign(party, 'b', kind, 0, 'other', another);
    assert.equal(assign(party, 'b', kind, 0, 'replacement-copy', definition), party);
    const reselected = assign(party, 'a', kind, 0, 'original', definition);
    assert.deepEqual(reselected, party);
    assert.deepEqual(memoryAt(reselected.argonauts[0], kind, 0).memoryProgress, { node: 2, growthUnlocked: false });
    party = partyReducer(party, { type: 'remove-memory', argonautId: 'a', kind, index: 0 }, catalogue);
    party = assign(party, 'b', kind, 0, 'reassigned', definition);
    assert.equal(memoryAt(party.argonauts[1], kind, 0).definitionId, definition.id);
    assert.equal(memoryAt(party.argonauts[0], kind, 0), undefined);
    assert.deepEqual(duplicateMemories(party), []);
  }
});

test('picker availability excludes only its current position and follows assignment, replacement and removal', () => {
  let party = assign(fresh(), 'a', 'mnemos', 0, 'owned');
  assert.equal(memoryConflict(party, memory.id, { argonautId: 'a', kind: 'mnemos', index: 0 }), undefined);
  for (const target of [{ argonautId: 'a', kind: 'mnemos', index: 1 }, { argonautId: 'b', kind: 'mnemos', index: 0 }]) {
    assert.equal(memoryConflict(party, memory.id, target).instance.id, 'owned');
  }
  assert.equal(memoryConflict(party, memory2.id, { argonautId: 'b', kind: 'mnemos', index: 0 }), undefined);
  party = assign(party, 'a', 'mnemos', 0, 'replacement', memory2);
  assert.equal(memoryConflict(party, memory.id, { argonautId: 'b', kind: 'mnemos', index: 0 }), undefined);
  party = assign(party, 'c', 'mnemos', 0, 'claimed-after-picker-opened');
  // A stale candidate is rejected against the latest reducer state, without moving either card.
  assert.equal(assign(party, 'b', 'mnemos', 0, 'stale-candidate'), party);
});

test('legacy duplicates retain their progress locally, are reported and cannot enter a new imported party', () => {
  let party = assign(assign(fresh(), 'a', 'mnemos', 0, 'one'), 'b', 'mnemos', 0, 'two', memory2);
  party = update(party, 'one', { progress: { node: 2 } });
  party = update(party, 'two', { progress: { node: 7 }, exhausted: true }, 'b');
  party.argonauts[1].instances[0].definitionId = memory.id; // Historical save made before uniqueness enforcement.
  const original = structuredClone(party), restored = parseWorkspace(party);
  assert.deepEqual(restored.profiles[0].party, original);
  assert.equal(duplicateMemories(party).length, 1);
  assert.match(referenceProblems(party, catalogue).join('\n'), /duplicate unique memory/);
  assert.equal(assign(party, 'c', 'mnemos', 0, 'third-copy'), party);
  const profile = { id: party.id, name: 'Historical memories', party };
  assert.throws(() => readBackup(exportProfile(profile), catalogue), /duplicate unique memory/);
  const workspace = parseWorkspace(fresh());
  assert.throws(() => importProfile(workspace, profile, 'imported', 'Duplicate memories'), /unique across the party/);
  assert.deepEqual(party, original);
  party = partyReducer(party, { type: 'remove-memory', argonautId: 'b', kind: 'mnemos', index: 0 }, catalogue);
  assert.deepEqual(referenceProblems(party, catalogue), []);
  assert.equal(memoryAt(party.argonauts[0], 'mnemos', 0).memoryProgress.node, 2);
  const valid = { ...profile, party };
  // Copies in separate campaign profiles are independent; uniqueness is per party.
  assert.deepEqual(readBackup(exportProfile(valid), catalogue).profile, valid);
  const imported = importProfile(parseWorkspace(party), valid, 'independent-campaign', 'Another campaign');
  assert.equal(imported.profiles.length, 2);
});
