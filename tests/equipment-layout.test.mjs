import assert from 'node:assert/strict';
import test from 'node:test';
import { equipmentGroupWidths, equipmentSlotSize, GROUP_GAP, SLOT_GAP } from '../src/dashboard/equipment-layout.ts';

test('wide layouts retain all columns as complete groups join the same row', () => {
  for (const counts of [[3, 2, 3], [3, 3, 3], [4, 3, 2]]) {
    for (let width = 700; width <= 5000; width += 0.5) {
      const widths = equipmentGroupWidths(width, counts);
      widths.forEach((groupWidth, index) => {
        const size = equipmentSlotSize(groupWidth, counts[index]);
        if (groupWidth >= counts[index] * 200 + (counts[index] - 1) * SLOT_GAP) assert.equal(size.columns, counts[index]);
        assert.ok(size.width * size.columns + SLOT_GAP * (size.columns - 1) <= groupWidth);
      });
    }
  }
});
test('mobile groups and breakpoint rows fit the available width, including dynamic bonus slots', () => {
  for (const counts of [[3, 2, 2], [3, 3, 3], [4, 4, 4]]) for (const width of [280, 320, 375, 624, 625, 1038, 1039, 1040, 1709, 1710, 1711, 2500]) {
    const widths = equipmentGroupWidths(width, counts);
    assert.ok(widths.every(w => w > 0 && w < width));
    if (width < 400) assert.ok(widths.every(w => equipmentSlotSize(w, counts[0]).columns === 1));
    const minimum = counts.reduce((sum, count) => sum + count * 200 + (count - 1) * SLOT_GAP, 0) + GROUP_GAP * 2;
    if (width >= minimum + 2) assert.ok(widths.reduce((a, b) => a + b, 0) + GROUP_GAP * 2 < width);
  }
});
