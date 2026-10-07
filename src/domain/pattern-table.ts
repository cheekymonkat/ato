import { isRecord } from './json.ts';
import type { JsonValue } from './json.ts';

export type PatternKind = 'Trauma' | 'Kratos';
export type PatternEffect = { name: string; quantity?: string };
export type KratosRow = { rage: number; options: PatternEffect[][] };
export type TraumaRow = { range: string; type: string };

/** Keep alternatives separate; effects within an alternative are combined. */
export function kratosRows(table: readonly JsonValue[]): KratosRow[] {
  return table.map((row, index) => ({
    rage: index + 1,
    options: (Array.isArray(row) ? row : [row]).map(option =>
      (Array.isArray(option) ? option : [option]).map(effect => {
        if (!isRecord(effect) || typeof effect.name !== 'string') return { name: readableValue(effect) };
        const quantity = effect.x_value;
        return { name: effect.name, ...(typeof quantity === 'string' || typeof quantity === 'number' ? { quantity: String(quantity) } : {}) };
      })),
  }));
}

export function traumaRows(table: readonly JsonValue[]): TraumaRow[] {
  return table.map(row => isRecord(row) && typeof row.range === 'string' && typeof row.type === 'string'
    ? { range: row.range, type: row.type }
    : { range: '—', type: readableValue(row) });
}

/** Kratos rows accumulate; Trauma selects the band containing current Danger. */
export function kratosRowActive(row: KratosRow, rage: number): boolean {
  return Number.isFinite(rage) && rage >= row.rage;
}
export function traumaRowActive(row: TraumaRow, danger: number): boolean {
  const range = /^(\d+)\s*(?:[-–]\s*(\d+)|(\+))?$/.exec(row.range.trim());
  if (!range || !Number.isFinite(danger)) return false;
  const minimum = Number(range[1]), maximum = range[3] ? Infinity : Number(range[2] ?? range[1]);
  return danger >= minimum && danger <= maximum;
}

function readableValue(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function effectLabel(effect: PatternEffect): string {
  return `${effect.quantity === undefined ? '' : `${effect.quantity} `}${effect.name}`;
}

export function kratosRowLabel(row: KratosRow): string {
  return `Rage ${row.rage}: ${row.options.map(option => option.map(effectLabel).join(' plus ')).join(' or ')}`;
}

/** ATCC resolves unquantified colour tokens as Power dice and Reroll as PowerReroll. */
export function patternIconKey(effect: PatternEffect): string {
  if (effect.name === 'Reroll') return 'PowerReroll';
  if (effect.quantity === undefined && ['Red', 'Black', 'White', 'Mortal'].includes(effect.name)) return `${effect.name}PowerDie`;
  return effect.name;
}
