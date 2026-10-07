import type { CardFace } from './cards.ts';
import { objects } from './card-presentation.ts';
import type { CardInstance } from './party.ts';

export interface GearChargePool { key: string; capacity: number }
/** Each printed Energy box has its own pool, including separate reverse faces. */
export function gearChargePool(face: CardFace, index: number): GearChargePool | null {
  if (face.kind !== 'gear' || !Number.isSafeInteger(index) || index < 0) return null;
  const entry = objects(face.data.defensiveStatistics)[index];
  if (entry?.type !== 'Energy' || typeof entry.amount !== 'string' && typeof entry.amount !== 'number') return null;
  const capacity = Number(entry.amount);
  return Number.isSafeInteger(capacity) && capacity > 0 ? { key: `gear-charge:${face.id}:${index}`, capacity } : null;
}
export function gearChargeRemaining(instance: CardInstance | undefined, pool: GearChargePool): number {
  const saved = instance?.counters[pool.key];
  return typeof saved === 'number' && Number.isSafeInteger(saved) && saved >= 0 && saved <= pool.capacity ? saved : pool.capacity;
}
export function isGearChargeKey(key: string): boolean { return /^gear-charge:(front|back):\d+$/.test(key); }
export function hasGearCharges(instance: CardInstance): boolean { return Object.keys(instance.counters).some(isGearChargeKey); }
/** Tapping zero restores the printed amount. Missing state means the pool is full. */
export function spendGearCharge(instance: CardInstance, face: CardFace, index: number): CardInstance {
  const pool = gearChargePool(face, index);
  if (!pool || instance.faceId !== face.id) return instance;
  const remaining = gearChargeRemaining(instance, pool), counters = { ...instance.counters };
  if (remaining === 0) delete counters[pool.key]; else counters[pool.key] = remaining - 1;
  return { ...instance, counters };
}
export function resetGearCharges(instance: CardInstance): CardInstance {
  if (!hasGearCharges(instance)) return instance;
  return { ...instance, counters: Object.fromEntries(Object.entries(instance.counters).filter(([key]) => !isGearChargeKey(key))) };
}
