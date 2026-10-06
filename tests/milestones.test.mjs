import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { MILESTONE_POLICY, milestoneTokenMaximum } from '../src/domain/milestone-rules.ts';
import { currentMilestone, milestoneSequence } from '../src/domain/milestones.ts';
import { parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, newProfile, readBackup, referenceProblems } from '../src/storage/workspace.ts';

const raw = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(raw);
const fresh = cycle => newProfile('p', 'Expedition', catalogue.version, cycle).party;
const current = (party, kind = 'story') => currentMilestone(party, kind, catalogue);
const owner = (party, kind = 'story') => ({ partyId: party.id, argonautId: party.activeArgonautId,
  expectedCycle: party.campaignCycle, kind, expectedReference: current(party, kind).reference });
const choose = (party, label, kind = 'story') => partyReducer(party, { type: 'milestone-select', ...owner(party, kind),
  reference: current(party, kind).sequence.find(side => side.label === label).reference }, catalogue);
const set = (party, value, token = 'Progress', kind = 'story') => partyReducer(party, { type: 'milestone-token-edit', ...owner(party, kind), token, value }, catalogue);

test('all 36 numbered Story/Doom cards have audited JSON rules, ordered A/B sides and per-cycle defaults', () => {
  assert.equal(Object.keys(MILESTONE_POLICY).length, 36);
  assert.equal(raw.cards.filter(card => card.milestoneRules).length, 36);
  for (const cycle of [1, 2, 3, 4, 5]) for (const kind of ['story', 'doom']) {
    const sequence = milestoneSequence(kind, cycle, catalogue), cards = kind === 'doom' ? 3 : cycle === 5 ? 5 : 4;
    assert.deepEqual(sequence.map(side => side.label), Array.from({ length: cards }, (_, index) => [`${index + 1}A`, `${index + 1}B`]).flat());
    assert.ok(sequence.every(side => side.card.milestoneRules.faces[side.face.id]));
    assert.ok(sequence.every(side => side.card.faces[0].data.cardNumber !== 'IO'));
    assert.equal(current(fresh(cycle), kind).side.label, '1A');
  }
});

test('targets match the printed side, while sides without targets omit counters', () => {
  const story = [[6, null, 2, null, 9, null, 12, 5], [7, null, 6, 10, null, null, 10, null],
    [6, 5, 5, 9, 9, 9, null, null], [5, 7, 7, null, 5, null, 9, null], [0, 0, 4, null, 5, null, null, null, 5, 5]];
  const doom = [[5, 6, 5, 6, 5, 6], [5, 5, 5, 6, 5, 6], [7, 7, 7, 7, 7, 7], [5, 6, 7, 7, 6, 5], [5, 5, 5, 4, 4, 6]];
  for (const cycle of [1, 2, 3, 4, 5]) {
    assert.deepEqual(milestoneSequence('story', cycle, catalogue).map(side => side.tokens[0]?.target ?? null), story[cycle - 1]);
    assert.deepEqual(milestoneSequence('doom', cycle, catalogue).map(side => side.tokens[0]?.target ?? null), doom[cycle - 1]);
  }
  const investment = milestoneSequence('doom', 4, catalogue);
  assert.deepEqual(investment.map(side => side.tokens.map(rule => rule.token)), Array.from({ length: 6 }, () => ['Doom', 'Progress']));
  assert.deepEqual(investment.map(side => side.tokens[1].target), [3, 4, 5, 6, 7, 8]);
  assert.equal(milestoneSequence('story', 5, catalogue).at(-1).tokens[0].token, 'Doom');
});

test('sequential advancement updates targets, carries explicit Story tokens and resets for the next card', () => {
  let party = set(fresh(2), 7);
  assert.equal(current(party).side.label, '1A', 'Reaching the target does not execute narrative effects');
  party = choose(party, '1B'); assert.equal(current(party).side.face.name, 'Gatecrashing');
  assert.deepEqual(current(party).side.tokens, []);
  party = choose(party, '2A'); assert.equal(current(party).tokens.Progress, 0);
  party = set(party, 6); party = choose(party, '2B');
  assert.equal(current(party).tokens.Progress, 6);
  assert.equal(current(party).side.tokens[0].target, 10);
  party = set(party, 21);
  assert.equal(current(party).tokens.Progress, 21, 'A threshold is not a storage limit: the printed 20+ tier remains reachable');
  party = choose(party, '3A'); assert.equal(current(party).side.tokens.length, 0);
  assert.equal(set(party, 1), party, 'No hidden generic counter can be changed on a targetless side');
});

test('legacy excess Doom carries forward while current counters are capped, and investment resets when flipped', () => {
  let party = set(fresh(4), 5, 'Doom', 'doom'); party = set(party, 3, 'Progress', 'doom');
  const key = '4:doom';
  party = { ...party, argo: { ...party.argo, milestones: { ...party.argo.milestones, [key]: { ...party.argo.milestones[key], tokens: { Doom: 7, Progress: 3 } } } } };
  party = choose(party, '1B', 'doom');
  assert.deepEqual(current(party, 'doom').tokens, { Doom: 2, Progress: 0 });
  assert.equal(current(party, 'doom').side.face.name, 'Market Forces');
  const capped = set(party, 6, 'Doom', 'doom');
  assert.equal(set(capped, 9, 'Doom', 'doom'), capped);
  party = choose(capped, '2A', 'doom');
  assert.deepEqual(current(party, 'doom').tokens, { Doom: 0, Progress: 0 });
  assert.equal(current(party).tokens.Progress, 0, 'The Story pool stays independent');
});

test('Story token minima allow a counter up to 50 without changing the printed threshold', () => {
  for (const label of ['2B', '4A']) {
    let party = choose(fresh(2), label);
    const rule = current(party).side.tokens[0];
    assert.equal(rule.target, 10); assert.equal(rule.comparison, 'at-least');
    assert.equal(rule.counterMaximum, 50); assert.equal(rule.maximum, undefined);
    party = set(party, 50); assert.equal(current(party).tokens.Progress, 50);
    assert.equal(set(party, 51), party);
    assert.equal(partyReducer(party, { type: 'milestone-token', ...owner(party), token: 'Progress', delta: 1 }, catalogue), party);
    assert.deepEqual(readBackup(exportProfile({ id: party.id, name: 'Minimum', party }), catalogue).profile.party, party);
  }
  assert.equal(current(choose(fresh(2), '1B')).side.tokens.length, 0, 'A Defector prerequisite does not create a Progress counter');
  assert.equal(current(choose(fresh(2), '3B')).side.tokens.length, 0, 'Identity cards are not Progress tokens');
  const legacy = choose(fresh(2), '2A');
  legacy.argo.milestones['2:story'].tokens.Progress = 60;
  const carried = choose(legacy, '2B');
  assert.equal(current(carried).tokens.Progress, 50, 'Forward carry respects the destination counter limit');
  assert.deepEqual(referenceProblems(carried, catalogue), []);
});

test('every Story/Doom token counter stops at its effective limit through plus and direct edits', () => {
  for (const cycle of [1, 2, 3, 4, 5]) for (const kind of ['story', 'doom']) {
    for (const side of milestoneSequence(kind, cycle, catalogue)) for (const rule of side.tokens) {
      let party = choose(fresh(cycle), side.label, kind);
      const maximum = milestoneTokenMaximum(rule);
      party = set(party, maximum, rule.token, kind);
      assert.equal(current(party, kind).tokens[rule.token], maximum, `${cycle}:${kind}:${side.label}:${rule.token}`);
      assert.equal(set(party, maximum + 1, rule.token, kind), party);
      assert.equal(partyReducer(party, { type: 'milestone-token', ...owner(party, kind), token: rule.token, delta: 1 }, catalogue), party);
      const decreased = partyReducer(party, { type: 'milestone-token', ...owner(party, kind), token: rule.token, delta: -1 }, catalogue);
      assert.equal(current(decreased, kind).tokens[rule.token], maximum - 1);
      assert.deepEqual(referenceProblems(party, catalogue), []);
    }
  }
});

test('countdown sides start at their printed amounts, and explicit storage caps are enforced', () => {
  let party = fresh(5);
  assert.equal(current(party).tokens.Progress, 4);
  assert.equal(current(party).side.tokens[0].target, 0);
  party = set(party, 0); assert.equal(current(party).side.label, '1A');
  party = choose(party, '1B'); assert.equal(current(party).tokens.Progress, 3);
  assert.equal(set(party, 4), party);
  party = choose(party, '2A'); assert.equal(current(party).tokens.Progress, 0);
  const capped = set(choose(fresh(1), '2A'), 9);
  assert.equal(current(capped).side.tokens[0].target, 2);
  assert.equal(set(capped, 10), capped);
  assert.equal(partyReducer(capped, { type: 'milestone-token', ...owner(capped), token: 'Progress', delta: 1 }, catalogue), capped);
});

test('milestone mutations reject wrong owners, stale sides, invalid amounts and unavailable card selections', () => {
  const party = fresh(1), update = { type: 'milestone-token-edit', ...owner(party), token: 'Progress', value: 1 };
  for (const change of [{ partyId: 'other' }, { argonautId: 'missing' }, { expectedCycle: 2 }, { kind: 'other' },
    { value: -1 }, { value: 1.5 }, { value: Infinity }, { value: Number.MAX_SAFE_INTEGER + 1 },
    { token: 'Other' }, { expectedReference: null }]) assert.equal(partyReducer(party, { ...update, ...change }, catalogue), party);
  const changed = choose(party, '1B');
  assert.equal(partyReducer(changed, update, catalogue), changed);
  const otherCycle = milestoneSequence('story', 2, catalogue)[0].reference;
  const wrongFamily = milestoneSequence('doom', 1, catalogue)[0].reference;
  for (const reference of [otherCycle, wrongFamily, { definitionId: 'missing', faceId: 'front' }, { ...update.expectedReference, faceId: 'other' }]) {
    assert.equal(partyReducer(party, { type: 'milestone-select', ...owner(party), reference }, catalogue), party);
  }
  assert.equal(partyReducer(party, { type: 'argo-track-edit', ...owner(party), id: 'story', value: 100, limit: 100, reference: '1A' }, catalogue), party);
});

test('legacy references resolve both sides and ignore manual targets, while current states persist independently through backups and cycles', () => {
  const legacy = { ...fresh(1), argo: { version: 1, tracks: { '1:story': { value: 9, reference: '4b' }, '1:doom': { value: 3, reference: '2B' } },
    limits: { '1:story': 999, '1:doom': 999 }, records: {} } };
  assert.equal(current(legacy).side.label, '4B'); assert.equal(current(legacy).side.tokens[0].target, 5);
  assert.equal(current(legacy).tokens.Progress, 9);
  assert.equal(current(legacy, 'doom').side.label, '2B'); assert.equal(current(legacy, 'doom').tokens.Doom, 3);
  let party = set(choose(fresh(4), '2A'), 4);
  party = set(choose(party, '2B', 'doom'), 3, 'Doom', 'doom');
  party = set(party, 2, 'Progress', 'doom');
  const profile = { id: party.id, name: 'Milestones', party };
  assert.deepEqual(parseParty(party), party);
  assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
  const advanced = partyReducer(party, { type: 'advance-cycle', partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: 4, confirmed: true }, catalogue);
  assert.equal(current(advanced).side.label, '1A'); assert.equal(current(advanced).tokens.Progress, 4);
  assert.deepEqual(advanced.argo.milestones['4:story'], party.argo.milestones['4:story']);
  assert.deepEqual(advanced.argo.milestones['4:doom'], party.argo.milestones['4:doom']);
});

test('malformed milestone state, references and metadata are rejected, and older catalogues remain compatible', () => {
  const party = set(fresh(1), 1), state = party.argo.milestones['1:story'];
  for (const bad of [null, { '6:story': state }, { '1:other': state }, { '1:story': { ...state, faceId: 'other' } },
    { '1:story': { ...state, tokens: { Progress: -1 } } }, { '1:story': { ...state, tokens: { Other: 1 } } }]) {
    assert.throws(() => parseParty({ ...party, argo: { ...party.argo, milestones: bad } }), /Invalid Argo/);
  }
  const missing = { ...party, argo: { ...party.argo, milestones: { '1:story': { ...state, definitionId: 'missing' } } } };
  assert.match(referenceProblems(missing, catalogue)[0], /unavailable story card/);
  assert.throws(() => readBackup(exportProfile({ id: missing.id, name: 'Missing', party: missing }), catalogue), /unresolved references/);
  const old = structuredClone(raw); old.cards.forEach(card => delete card.milestoneRules);
  assert.deepEqual(milestoneSequence('story', 1, createCatalogueRepository(old)).map(side => side.tokens), milestoneSequence('story', 1, catalogue).map(side => side.tokens));
  const corrupt = structuredClone(raw); corrupt.cards.find(card => card.printedIds.includes('AD0120')).milestoneRules.faces.front.tokens[0].target = 99;
  assert.throws(() => createCatalogueRepository(corrupt), /milestone rules/);
});
