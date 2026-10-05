export const MEMORY_CARD_WIDTH = 262, MEMORY_MIN_WIDTH = 200, MEMORY_GAP = 12;
const span = (count: number, width: number) => count * width + (count - 1) * MEMORY_GAP;

/** Allocate whole memory families from the parent width before sizing their cards. */
export function memoryGroupWidths(width: number, counts: readonly number[]): number[] {
  const available = Math.max(1, Math.floor(width) - 2);
  const sizes = counts.map(count => Math.max(1, count)), result: number[] = [];
  let row: number[] = [], used = 0;
  const finish = () => {
    const slots = row.reduce((sum, index) => sum + sizes[index], 0);
    const extra = Math.max(0, available - used);
    for (const index of row) result[index] = Math.min(span(sizes[index], MEMORY_CARD_WIDTH),
      Math.min(available, span(sizes[index], MEMORY_MIN_WIDTH)) + Math.floor(extra * sizes[index] / slots));
    row = []; used = 0;
  };
  sizes.forEach((count, index) => {
    const minimum = Math.min(available, span(count, MEMORY_MIN_WIDTH));
    if (row.length && used + MEMORY_GAP + minimum > available) finish();
    used += (row.length ? MEMORY_GAP : 0) + minimum;
    row.push(index);
  });
  if (row.length) finish();
  return result;
}

/** Round down and reserve a pixel so fractional browser/native widths cannot wrap the last card. */
export function memoryCardSize(width: number, count: number): { columns: number; width: number } {
  const available = Math.max(1, Math.floor(width) - 1);
  const columns = Math.min(Math.max(1, count), Math.max(1, Math.floor((Math.floor(width) + MEMORY_GAP) / (MEMORY_MIN_WIDTH + MEMORY_GAP))));
  return { columns, width: Math.min(MEMORY_CARD_WIDTH, Math.floor((available - MEMORY_GAP * (columns - 1)) / columns)) };
}
