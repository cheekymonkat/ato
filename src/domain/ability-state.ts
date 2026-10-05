import type { CardFace } from './cards.ts';
import type { JsonValue } from './json.ts';
import { isRecord } from './json.ts';
import { hasExhaustCost } from './ability-costs.ts';
import { fatedGrowthAvailable, memoryAbilityAvailable, memoryProgress } from './memories.ts';
import type { CardInstance, MemoryProgress } from './party.ts';

export interface CardAbility { id: string; heading: JsonValue; available: boolean }
/** Path IDs keep two identical printed abilities independent, including locked memory panels. */
export function cardAbilities(face: CardFace, progress?: MemoryProgress): CardAbility[] {
  const walk = (value: JsonValue, path: string, available = true): CardAbility[] => Array.isArray(value)
    ? value.flatMap((child, index) => walk(child, `${path}:${index}`, available))
    : isRecord(value) && Array.isArray(value.abilityText) ? [{ id: `${face.id}:${path}`, heading: value, available }] : [];
  if (face.kind === 'titan') return walk(face.data.abilities, 'abilities');
  if (face.kind === 'mnemos') return face.data.abilities.flatMap((group, index) => walk(group, `abilities:${index}`, !progress || memoryAbilityAvailable(index, progress)));
  if (face.kind === 'fated-mnemos') {
    const growth = Boolean(progress && fatedGrowthAvailable(progress));
    return [...walk(face.data.effect, 'effect', !growth), ...walk(face.data.growthAbility, 'growthAbility', growth)];
  }
  return [];
}
/** Old whole-card markers affect only currently unlocked Exhaust-cost abilities, never passives. */
export function exhaustedAbilities(instance: CardInstance, face?: CardFace): string[] {
  if (instance.exhaustedAbilityIds !== undefined) return instance.exhaustedAbilityIds;
  return instance.exhausted && face ? cardAbilities(face, face.kind === 'titan' ? undefined : memoryProgress(instance))
    .filter(ability => ability.available && hasExhaustCost(ability.heading)).map(ability => ability.id) : [];
}
export function setAbilityExhausted(instance: CardInstance, face: CardFace | undefined, abilityId: string, exhausted: boolean): CardInstance {
  if (typeof exhausted !== 'boolean' || typeof abilityId !== 'string' || !abilityId.trim()) return instance;
  const ids = exhaustedAbilities(instance, face), ability = face && cardAbilities(face, face.kind === 'titan' ? undefined : memoryProgress(instance)).find(row => row.id === abilityId);
  if (exhausted && (instance.discarded || !ability?.available || !hasExhaustCost(ability.heading))) return instance;
  if (!exhausted && !ids.includes(abilityId) || exhausted && ids.includes(abilityId)) return instance;
  const next = new Set(ids);
  if (exhausted) next.add(abilityId); else next.delete(abilityId);
  return { ...instance, exhausted: false, exhaustedAbilityIds: [...next] };
}
