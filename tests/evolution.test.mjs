import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { changeEvolution, disabledPrimordialTraits, evolutionValues, mnestisPrimordialLevels, primordialLevels, resolveBattleSetup, trackedLevel } from '../src/domain/evolution.ts';
import { canMarkEvolutionNode, EVOLUTION_RULES, primordialPath } from '../src/domain/evolution-rules.ts';
import { parseParty } from '../src/domain/party.ts';
import { newProfile, exportProfile, readBackup } from '../src/storage/workspace.ts';
import { partyReducer } from '../src/state/party-reducer.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = (cycle = 1) => newProfile('evo', 'Evolution', catalogue.version, cycle).party;
const change = (party, edit, overrides = {}) => partyReducer(party, { type: 'evolution', partyId: party.id,
  argonautId: party.activeArgonautId, expectedCycle: party.campaignCycle, edit, ...overrides }, catalogue);
const markPath = (party, id, count) => primordialPath(EVOLUTION_RULES[party.campaignCycle], id).slice(0, count)
  .reduce((party, node) => change(party, { kind: 'node', nodeId: node.id, marked: true }), party);

test('every pictured regular track resolves to an actual level block and exact named monster, including shared printed IDs', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    const rules = EVOLUTION_RULES[cycle];
    assert.equal(new Set(rules.nodes.map(node => node.id)).size, rules.nodes.length);
    for (const track of rules.regular) for (const node of primordialPath(rules, track.printedId)) {
      const setup = resolveBattleSetup(track, node.level, catalogue);
      assert.ok(setup); assert.equal(setup.primordial.name, track.name);
    }
    for (const track of [rules.boss, ...rules.adversaries]) assert.ok(resolveBattleSetup(track, 1, catalogue));
  }
  assert.deepEqual(primordialPath(EVOLUTION_RULES[1], 'AU0447').map(node => node.level), [0, 1, 1, 2, 2, 3, 3, 4, 4, 4]);
  assert.deepEqual(primordialPath(EVOLUTION_RULES[3], 'CU1384').map(node => node.level), [1, 1, 2, 2, 3, 3, 4, 4, 4, 5]);
  assert.equal(primordialPath(EVOLUTION_RULES[4], 'DU2394').length, 15);
  assert.equal(primordialPath(EVOLUTION_RULES[4], 'DU2394').at(-1).level, 6);
  assert.equal(resolveBattleSetup(EVOLUTION_RULES[4].regular[0], 1, catalogue).stats.wounds, '10', 'Not the Nosoi Dragon sharing DU2394');
});

test('first encounter defaults preserve Hekaton level zero; independent and shared diamonds update exactly their paths', () => {
  const party = fresh(), before = structuredClone(party), rules = EVOLUTION_RULES[1];
  assert.equal(trackedLevel(party, 'AU0447'), 0); assert.equal(trackedLevel(party, 'AU0448'), 1);
  const left = markPath(party, 'AU0447', 4);
  assert.equal(trackedLevel(left, 'AU0447'), 2); assert.equal(trackedLevel(left, 'AU0448'), 1);
  const shared = markPath(left, 'AU0447', 6);
  for (const track of rules.regular) assert.equal(trackedLevel(shared, track.printedId), 3);
  const undone = change(shared, { kind: 'node', nodeId: '5-shared', marked: false });
  assert.equal(trackedLevel(undone, 'AU0447'), 2); assert.equal(trackedLevel(undone, 'AU0448'), 2);
  assert.deepEqual(evolutionValues(shared).marked, ['0-left', '1-left', '2-shared', '3-left', '4-shared', '5-shared']);
  assert.equal(change(shared, { kind: 'node', nodeId: '5-shared', marked: true }), shared);
  assert.deepEqual(party, before); assert.equal(shared.argonauts, party.argonauts);
});

test('diamonds require a connected starting path and follow repeated levels without skipping', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    const rules = EVOLUTION_RULES[cycle], track = rules.regular[0], path = primordialPath(rules, track.printedId);
    let party = fresh(cycle);
    for (const [index, node] of path.entries()) {
      for (const later of path.slice(index + 1)) assert.equal(change(party, { kind: 'node', nodeId: later.id, marked: true }), party);
      assert.ok(canMarkEvolutionNode(rules, evolutionValues(party).marked, node.id));
      party = change(party, { kind: 'node', nodeId: node.id, marked: true });
      assert.equal(trackedLevel(party, track.printedId), node.level);
    }
    assert.equal(change(party, { kind: 'node', nodeId: path.at(-1).id, marked: true }), party);
    for (const node of [...path].reverse()) {
      assert.ok(evolutionValues(party).marked.includes(node.id));
      party = change(party, { kind: 'node', nodeId: node.id, marked: false });
      assert.ok(!evolutionValues(party).marked.includes(node.id));
    }
    assert.deepEqual(evolutionValues(party).marked, []);
  }
  let party = markPath(fresh(2), 'BU0780', 2);
  party = change(party, { kind: 'node', nodeId: '2-right', marked: true });
  assert.deepEqual(evolutionValues(party).marked, ['0-right', '1-shared', '2-right']);
  assert.equal(trackedLevel(party, 'BU0724'), 1); assert.equal(trackedLevel(party, 'BU0780'), 2);
});

test('clearing a branch prunes disconnected descendants while an alternate selected branch preserves shared progress', () => {
  const id = 'BU0724'; let party = markPath(fresh(2), id, 9);
  const cleared = change(party, { kind: 'node', nodeId: '1-shared', marked: false });
  assert.deepEqual(evolutionValues(cleared).marked, ['0-left']);
  party = change(party, { kind: 'node', nodeId: '0-right', marked: true });
  const alternate = change(party, { kind: 'node', nodeId: '0-left', marked: false });
  assert.equal(evolutionValues(alternate).marked.length, 9);
  assert.equal(trackedLevel(alternate, id), 4);
  assert.ok(evolutionValues(alternate).marked.includes('8-shared'));
  // Disconnected selections from an earlier version cannot unlock another jump.
  const legacy = { ...fresh(2), argo: { version: 1, tracks: {}, limits: {}, records: {}, evolution: { version: 1, cycles: { 2: {
    marked: ['2-left'], bossBattles: 0, adversaryId: null, adversaryBattles: 0,
  } } } } };
  assert.deepEqual(parseParty(legacy), legacy);
  assert.equal(change(legacy, { kind: 'node', nodeId: '3-shared', marked: true }), legacy);
});

test('boss and adversary counters start at zero, have no battle caps and never become campaign levels', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    const rules = EVOLUTION_RULES[cycle]; let party = fresh(cycle);
    if (!evolutionValues(party).adversaryId) party = change(party, { kind: 'adversary', primordialId: rules.adversaries[0].printedId, expectedId: null, confirmed: false });
    for (const [track, field, id] of [['boss', 'bossBattles', rules.boss.printedId],
      ['adversary', 'adversaryBattles', evolutionValues(party).adversaryId]]) {
      assert.equal(evolutionValues(party)[field], 0);
      for (const value of [10, 11, 50, 1000]) {
        party = change(party, { kind: 'battle', track, value });
        assert.equal(evolutionValues(party)[field], value); assert.equal(trackedLevel(party, id), 1);
      }
      for (const value of [-1, 1.5, '2', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(change(party, { kind: 'battle', track, value }), party);
    }
    const profile = { id: party.id, name: 'Saved', party };
    assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  }
  const blank = fresh(2);
  assert.equal(change(blank, { kind: 'battle', track: 'adversary', value: 1 }), blank);
});

test('adversary replacement requires confirmation when progress exists and rejects stale selections', () => {
  let party = change(fresh(2), { kind: 'adversary', primordialId: 'AU0622', expectedId: null, confirmed: false });
  party = markPath(party, 'BU0724', 2);
  party = change(party, { kind: 'battle', track: 'boss', value: 2 });
  party = change(party, { kind: 'battle', track: 'adversary', value: 17 });
  const edit = { kind: 'adversary', primordialId: 'BU1149', expectedId: 'AU0622', confirmed: false };
  assert.equal(change(party, edit), party);
  const next = change(party, { ...edit, confirmed: true });
  assert.deepEqual(evolutionValues(next), { marked: ['0-left', '1-shared'], bossBattles: 2, adversaryId: 'BU1149', adversaryBattles: 0 });
  assert.equal(change(next, { ...edit, confirmed: true, primordialId: null }), next);
  assert.equal(change(next, { ...edit, confirmed: true, primordialId: 'unknown', expectedId: 'BU1149' }), next);
});

test('cycle advancement retains history, carries compatible adversary battles and starts new regular tracks', () => {
  let party = markPath(fresh(), 'AU0447', 3);
  party = change(party, { kind: 'battle', track: 'adversary', value: 17 });
  for (const cycle of [2, 3, 4, 5]) {
    party = partyReducer(party, { type: 'advance-cycle', partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: cycle - 1, confirmed: true });
    const state = evolutionValues(party);
    assert.deepEqual(state.marked, []); assert.equal(state.bossBattles, 0);
    assert.equal(state.adversaryBattles, cycle <= 3 ? 17 : 0);
    assert.equal(state.adversaryId, cycle <= 3 ? 'AU0622' : cycle === 4 ? 'DU2514' : 'EU3144');
    party = change(party, { kind: 'battle', track: 'boss', value: 1 });
    assert.deepEqual(parseParty(JSON.parse(JSON.stringify(party))), party);
  }
  assert.deepEqual(party.argo.evolution.cycles[1].marked, ['0-left', '1-left', '2-shared']);
});

test('level blocks use exact absolute modifiers, preserve unusual values and remove inactive traits', () => {
  const hekaton = EVOLUTION_RULES[1].regular[0];
  assert.equal(resolveBattleSetup(hekaton, 0, catalogue).atBonus, -1);
  assert.equal(resolveBattleSetup(hekaton, 1, catalogue).atBonus, 0);
  const level2 = resolveBattleSetup(hekaton, 2, catalogue);
  assert.deepEqual(level2.stats.activeTraits, ['Clever Boy', 'A Fist for a Fist']);
  assert.ok(!level2.stats.activeTraits.includes('Friendly Warning'));
  const midas = resolveBattleSetup(EVOLUTION_RULES[4].regular[0], 6, catalogue);
  assert.equal(midas.stats.speed, 'Inf'); assert.equal(midas.atBonus, 3); assert.equal(midas.dangerBonus, 2); assert.equal(midas.preBattleEscalationCount, 3);
  assert.equal(resolveBattleSetup(EVOLUTION_RULES[4].boss, 1, catalogue).stats.speed, '-');
  assert.equal(resolveBattleSetup(EVOLUTION_RULES[1].adversaries[0], 1, catalogue).stats.speed, '6*');
  const before = structuredClone(evolutionValues(fresh(4)));
  for (const level of primordialLevels(EVOLUTION_RULES[4].regular[0], catalogue)) {
    assert.ok(resolveBattleSetup(EVOLUTION_RULES[4].regular[0], level.level, catalogue));
  }
  assert.deepEqual(evolutionValues(fresh(4)), before);
  assert.equal(resolveBattleSetup(hekaton, 11, catalogue), null);
  assert.equal(resolveBattleSetup({ printedId: 'unknown', name: 'Unknown' }, 1, catalogue), null);
});

test('edits guard campaign, cycle and valid node ownership and legacy notes survive backups', () => {
  const party = fresh(), edit = { kind: 'node', nodeId: '0-left', marked: true };
  for (const overrides of [{ partyId: 'other' }, { expectedCycle: 2 }, { argonautId: 'missing' }]) assert.equal(change(party, edit, overrides), party);
  for (const invalid of [{ ...edit, nodeId: 'missing' }, { ...edit, marked: 1 }, { kind: 'unknown' },
    { kind: 'battle', track: 'unknown', value: 1 }]) assert.equal(change(party, invalid), party);
  const legacy = { ...party, argo: { version: 1, tracks: {}, limits: {}, records: { evolution: 'Old notes', glyphs: 'Keep' } } };
  const saved = change(legacy, edit), profile = { id: saved.id, name: 'Saved', party: saved };
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  assert.equal(saved.argo.records.evolution, 'Old notes'); assert.equal(saved.argo.records.glyphs, 'Keep');
  assert.deepEqual(parseParty(legacy), legacy);
  assert.equal(changeEvolution(party, { kind: 'node', nodeId: '2-shared', marked: false }), party);
});

test('saved state rejects invalid versions, cycle keys, counts, marks and unavailable adversaries', () => {
  const saved = markPath(fresh(), 'AU0447', 3), state = saved.argo.evolution;
  for (const invalid of [null, { ...state, version: 2 }, { ...state, cycles: null }, { ...state, cycles: { 6: state.cycles[1] } },
    ...[{ marked: ['unknown'] }, { marked: ['2-shared', '2-shared'] }, { bossBattles: -1 }, { bossBattles: '1' }, { adversaryBattles: -1 },
      { adversaryBattles: 1.5 }, { bossBattles: Number.MAX_SAFE_INTEGER + 1 }, { adversaryId: 'BU1149' }, { adversaryId: null, adversaryBattles: 1 }].map(overrides => ({ ...state, cycles: { 1: { ...state.cycles[1], ...overrides } } }))]) {
    assert.throws(() => parseParty({ ...saved, argo: { ...saved.argo, evolution: invalid } }), /Invalid Argo/);
  }
});

test('Toying automatically disables End of Hope without saving or erasing independent story overrides', () => {
  const hermesian = EVOLUTION_RULES[1].adversaries[0];
  for (const { level } of primordialLevels(hermesian, catalogue)) {
    const setup = resolveBattleSetup(hermesian, level, catalogue);
    const toying = setup.stats.activeTraits.includes('Toying');
    assert.ok(setup.stats.activeTraits.includes('End of Hope'));
    assert.equal(setup.activeTraits.includes('End of Hope'), !toying);
    assert.deepEqual(setup.suppressedTraits, toying ? { 'End of Hope': ['Toying'] } : {});
    const restored = resolveBattleSetup(hermesian, level, catalogue, ['Toying']);
    assert.ok(restored.activeTraits.includes('End of Hope'));
    assert.deepEqual(restored.suppressedTraits, {});
    assert.ok(!resolveBattleSetup(hermesian, level, catalogue, ['Toying', 'End of Hope']).activeTraits.includes('End of Hope'));
  }
  let party = fresh();
  const toggle = disabled => { party = change(party, { kind: 'trait', primordialId: hermesian.printedId, trait: 'Toying', disabled }); };
  toggle(true); assert.ok(resolveBattleSetup(hermesian, 1, catalogue, disabledPrimordialTraits(party, hermesian.printedId)).activeTraits.includes('End of Hope'));
  toggle(false); assert.ok(!resolveBattleSetup(hermesian, 1, catalogue, disabledPrimordialTraits(party, hermesian.printedId)).activeTraits.includes('End of Hope'));
  assert.deepEqual(disabledPrimordialTraits(party, hermesian.printedId), []);
  assert.deepEqual(resolveBattleSetup(EVOLUTION_RULES[1].regular[0], 1, catalogue).suppressedTraits, {});
});

test('Mnestis levels start after the printed campaign maximum for each monster', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    const rules = EVOLUTION_RULES[cycle];
    for (const track of [...rules.regular, rules.boss, ...rules.adversaries]) {
      const path = primordialPath(rules, track.printedId), max = path.length ? Math.max(...path.map(node => node.level)) : 1;
      const levels = mnestisPrimordialLevels(track, rules, catalogue).map(block => block.level);
      assert.deepEqual(levels, primordialLevels(track, catalogue).map(block => block.level).filter(level => level > max));
      assert.equal(levels[0], max + 1);
    }
  }
  assert.equal(mnestisPrimordialLevels(EVOLUTION_RULES[2].regular[0], EVOLUTION_RULES[2], catalogue)[0].level, 5);
  assert.equal(mnestisPrimordialLevels(EVOLUTION_RULES[4].regular[0], EVOLUTION_RULES[4], catalogue)[0].level, 7);
});

test('trait overrides persist per monster across battles, levels, cycle advancement and backups and can be restored', () => {
  const hermesian = EVOLUTION_RULES[1].adversaries[0], original = fresh();
  let party = change(original, { kind: 'trait', primordialId: hermesian.printedId, trait: 'Toying', disabled: true });
  assert.deepEqual(disabledPrimordialTraits(party, hermesian.printedId), ['Toying']);
  assert.deepEqual(disabledPrimordialTraits(party, 'EU3144'), []);
  assert.ok(!resolveBattleSetup(hermesian, 1, catalogue, disabledPrimordialTraits(party, hermesian.printedId)).activeTraits.includes('Toying'));
  assert.ok(resolveBattleSetup(hermesian, 1, catalogue).stats.activeTraits.includes('Toying'));
  party = change(party, { kind: 'battle', track: 'adversary', value: 1 });
  party = markPath(party, 'AU0447', 2);
  party = partyReducer(party, { type: 'advance-cycle', partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: 1, confirmed: true }, catalogue);
  const profile = { id: party.id, name: 'Saved', party };
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  assert.deepEqual(disabledPrimordialTraits(party, hermesian.printedId), ['Toying']);
  const restored = change(party, { kind: 'trait', primordialId: hermesian.printedId, trait: 'Toying', disabled: false });
  assert.deepEqual(disabledPrimordialTraits(restored, hermesian.printedId), []);
  assert.ok(resolveBattleSetup(hermesian, 1, catalogue, disabledPrimordialTraits(restored, hermesian.printedId)).activeTraits.includes('Toying'));
  assert.deepEqual(original, fresh());
});

test('trait edits reject unknown traits, unavailable monsters and stale campaigns; malformed overrides fail backup validation', () => {
  const party = fresh(), edit = { kind: 'trait', primordialId: 'AU0622', trait: 'Toying', disabled: true };
  for (const invalid of [{ ...edit, trait: 'Missing' }, { ...edit, primordialId: 'EU3144' }, { ...edit, disabled: 1 }]) assert.equal(change(party, invalid), party);
  for (const overrides of [{ partyId: 'other' }, { expectedCycle: 2 }]) assert.equal(change(party, edit, overrides), party);
  assert.equal(changeEvolution(party, edit), party);
  const saved = change(party, edit);
  assert.equal(change(saved, edit), saved);
  for (const disabledTraits of [null, [], { unknown: ['Toying'] }, { AU0622: 'Toying' }, { AU0622: ['Toying', 'Toying'] }, { AU0622: [''] }, { AU0622: [1] }]) {
    assert.throws(() => parseParty({ ...saved, argo: { ...saved.argo, evolution: { ...saved.argo.evolution, disabledTraits } } }), /Invalid Argo/);
  }
});
