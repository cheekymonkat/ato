export const SLOT_WIDTH = 262, MINIMUM_SLOT_WIDTH = 200, SLOT_GAP = 12, GROUP_GAP = 24;
const span = (count: number, width: number) => count * width + (count - 1) * SLOT_GAP;

/** Allocate complete groups before sizing cards; never let child intrinsic widths resize a group. */
export function equipmentGroupWidths(width: number, counts: number[]): number[] {
  const available = Math.max(1, Math.floor(width) - 2); // Leave room for browser/native fractional rounding.
  const sizes = counts.map(count => Math.max(1, count)), result: number[] = [];
  let row: number[] = [], used = 0;
  const finish = () => {
    const slots = row.reduce((sum, index) => sum + sizes[index], 0);
    const extra = Math.max(0, available - used);
    for (const index of row) result[index] = Math.min(span(sizes[index], SLOT_WIDTH),
      Math.min(available, span(sizes[index], MINIMUM_SLOT_WIDTH)) + Math.floor(extra * sizes[index] / slots));
    row = []; used = 0;
  };
  sizes.forEach((count, index) => {
    const minimum = Math.min(available, span(count, MINIMUM_SLOT_WIDTH));
    if (row.length && used + GROUP_GAP + minimum > available) finish();
    used += (row.length ? GROUP_GAP : 0) + minimum; row.push(index);
  });
  if (row.length) finish();
  return result;
}
export function equipmentSlotSize(width: number, count: number): { columns: number; width: number } {
  const available = Math.max(1, Math.floor(width) - 1);
  const columns = Math.min(Math.max(1, count), Math.max(1, Math.floor((Math.floor(width) + SLOT_GAP) / (MINIMUM_SLOT_WIDTH + SLOT_GAP))));
  return { columns, width: Math.min(SLOT_WIDTH, Math.floor((available - SLOT_GAP * (columns - 1)) / columns)) };
}
