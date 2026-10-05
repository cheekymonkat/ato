import assert from 'node:assert/strict';
import test from 'node:test';
import { MEMORY_CARD_WIDTH, MEMORY_GAP, memoryCardSize, memoryGroupWidths } from '../src/memories/memory-layout.ts';

test('both memory pairs retain their columns across fractional and very wide container widths', () => {
  for (let width = 838; width <= 5000; width += 0.25) {
    const groups = memoryGroupWidths(width, [2, 2]);
    assert.ok(groups[0] + MEMORY_GAP + groups[1] < width);
    for (const group of groups) {
      const card = memoryCardSize(group, 2);
      assert.equal(card.columns, 2);
      assert.ok(card.width * 2 + MEMORY_GAP < group);
      assert.ok(card.width <= MEMORY_CARD_WIDTH);
    }
  }
});

test('memory pairs move to separate rows before either family collapses into a single column', () => {
  const groups = memoryGroupWidths(837.9, [2, 2]);
  assert.ok(groups[0] + MEMORY_GAP + groups[1] > 837.9);
  assert.ok(groups.every(group => memoryCardSize(group, 2).columns === 2));
  for (const width of [280, 320, 375, 390, 413.9]) {
    for (const group of memoryGroupWidths(width, [2, 2])) {
      const card = memoryCardSize(group, 2);
      assert.equal(card.columns, 1);
      assert.ok(card.width > 0 && card.width < group && group < width);
    }
  }
});

test('changed memory capacity and preserved saved slots fit their allocated family widths', () => {
  for (const counts of [[1, 2], [2, 3], [3, 4], [4, 4]]) {
    for (let width = 280; width <= 2400; width += 0.5) {
      memoryGroupWidths(width, counts).forEach((group, index) => {
        const card = memoryCardSize(group, counts[index]);
        assert.ok(card.width * card.columns + MEMORY_GAP * (card.columns - 1) < group);
        assert.ok(card.columns >= 1 && card.columns <= counts[index]);
        if (group >= counts[index] * 200 + MEMORY_GAP * (counts[index] - 1)) assert.equal(card.columns, counts[index]);
      });
    }
  }
});
