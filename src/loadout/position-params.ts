import type { CapacityPosition } from '../domain/slots.ts';

/** Expo Router decodes local params after URL query decoding. Preserve the ID's own escapes. */
export function positionRouteParam(positionId: string): string { return encodeURIComponent(positionId); }

/** Resolve only a currently available position; tolerate the extra decode in older bonus-slot links. */
export function positionFromRoute(positions: readonly CapacityPosition[], value: unknown): CapacityPosition | undefined {
  if (typeof value !== 'string') return undefined;
  const exact = positions.find(position => position.id === value);
  if (exact) return exact;
  const matches = positions.filter(position => {
    try { return decodeURIComponent(position.id) === value; } catch { return false; }
  });
  return matches.length === 1 ? matches[0] : undefined;
}
