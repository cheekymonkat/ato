import assert from 'node:assert/strict';
import test from 'node:test';
import { createParty } from '../src/domain/party.ts';
import { chooseLikelyArgonaut, evaluateArgonautLikelihood, getStandardMnemosStats } from '../src/domain/argonaut-likelihood.ts';

const catalogue = { getFace: id => ({ kind: id === 'standard' ? 'mnemos' : id === 'fated' ? 'fated-mnemos' : 'trauma' }) };
const member = (id, nodes = [], fated = []) => {
  const base = createParty('party', ['a', 'b', 'c', 'd'], 'catalogue').argonauts[0];
  const instance = (kind, node, index) => ({ id: `${id}:${kind}:${index}`, definitionId: kind, faceId: 'front', exhausted: false,
    enabledEffectIds: [], counters: {}, memoryProgress: { node, growthUnlocked: false } });
  const standard = nodes.map((node, index) => instance('standard', node, index)), fate = fated.map((node, index) => instance('fated', node, index));
  return { ...base, id, name: id, mnemosIds: standard.map(card => card.id), fatedMnemosIds: fate.map(card => card.id), instances: [...standard, ...fate] };
};

test('card count takes priority over total nodes for Least and Most Likely', () => {
  const a = member('a', [2]), b = member('b', [0, 0]);
  assert.deepEqual(evaluateArgonautLikelihood([a, b], catalogue), { stats: { a: { cardCount: 1, nodeCount: 2 }, b: { cardCount: 2, nodeCount: 0 } }, leastIds: ['a'], mostIds: ['b'] });
  const reverseNodes = evaluateArgonautLikelihood([member('a', [10]), b], catalogue);
  assert.deepEqual(reverseNodes.leastIds, ['a']); assert.deepEqual(reverseNodes.mostIds, ['b']);
});

test('total nodes across both standard cards break card-count ties', () => {
  const result = evaluateArgonautLikelihood([member('a', [1, 2]), member('b', [3, 3]), member('c', [1, 3]), member('d', [3, 2])], catalogue);
  assert.deepEqual(result.leastIds, ['a']); assert.deepEqual(result.mostIds, ['b']);
  const oneEach = evaluateArgonautLikelihood([member('a', [3]), member('b', [6])], catalogue);
  assert.deepEqual(oneEach.leastIds, ['a']); assert.deepEqual(oneEach.mostIds, ['b']);
});

test('Fated memories, Trauma, unassigned cards and empty slots never contribute', () => {
  const a = member('a', [], [3, 3]), b = member('b', [0]);
  a.instances.push({ ...b.instances[0], id: 'unassigned', memoryProgress: { node: 10, growthUnlocked: false } });
  a.instances.push({ ...b.instances[0], id: 'trauma', definitionId: 'trauma', memoryProgress: { node: 10, growthUnlocked: false } });
  a.mnemosIds = [null, 'missing', 'trauma', a.fatedMnemosIds[0]];
  const result = evaluateArgonautLikelihood([a, b], catalogue);
  assert.deepEqual(result.stats.a, { cardCount: 0, nodeCount: 0 });
  assert.deepEqual(result.leastIds, ['a']); assert.deepEqual(result.mostIds, ['b']);
});

test('null or absent progress means zero nodes; exhaustion and discard do not remove assigned memories', () => {
  const a = member('a', [null, 4]); delete a.instances[0].memoryProgress;
  a.instances[0].exhausted = true; a.instances[1].discarded = true;
  assert.deepEqual(getStandardMnemosStats(a, catalogue), { cardCount: 2, nodeCount: 4 });
  assert.deepEqual(getStandardMnemosStats(member('b', [null]), catalogue), { cardCount: 1, nodeCount: 0 });
});

test('exact ties retain every candidate and random resolution only selects among that group', () => {
  const party = [member('a', [3]), member('b', [3]), member('c', [6]), member('d', [6])], before = structuredClone(party);
  const result = evaluateArgonautLikelihood(party, catalogue);
  assert.deepEqual(result.leastIds, ['a', 'b']); assert.deepEqual(result.mostIds, ['c', 'd']);
  assert.equal(chooseLikelyArgonaut(result.leastIds, () => 0), 'a');
  assert.equal(chooseLikelyArgonaut(result.leastIds, () => 0.999), 'b');
  assert.equal(chooseLikelyArgonaut(result.mostIds, () => 0.999), 'd');
  assert.deepEqual(party, before);
  const emptyMemories = evaluateArgonautLikelihood(['a', 'b', 'c', 'd'].map(id => member(id)), catalogue);
  assert.deepEqual(emptyMemories.leastIds, ['a', 'b', 'c', 'd']); assert.deepEqual(emptyMemories.mostIds, emptyMemories.leastIds);
});

test('unique candidates consume no random draw and empty parties are rejected', () => {
  assert.equal(chooseLikelyArgonaut(['a'], () => { throw new Error('Unexpected draw'); }), 'a');
  assert.throws(() => evaluateArgonautLikelihood([], catalogue), /Party cannot be empty/);
  assert.throws(() => chooseLikelyArgonaut([]), /No eligible/);
});
