import type { CardFace } from './cards.ts';
import type { JsonValue } from './json.ts';
import type { MemoryProgress } from './party.ts';
import { fatedGrowthAvailable, memoryAbilityAvailable } from './memories.ts';

/** Keep the outer ability groups: each is a separate grey panel on the printed card. */
export function memoryAbilityGroups(face: Extract<CardFace, { kind: 'mnemos' }>): JsonValue[][] {
  return face.data.abilities.map(group => Array.isArray(group) ? group : [group]);
}

/** Catalogue previews have no player progress; assigned cards omit locked panels entirely. */
export function memoryAbilityPanels(face: Extract<CardFace, { kind: 'mnemos' }>, progress?: MemoryProgress) {
  return memoryAbilityGroups(face).map((group, index) => ({ group, index }))
    .filter(({ index }) => !progress || memoryAbilityAvailable(index, progress));
}

/** Both physical Fated sides are embedded in one export record; nodes select the visible side. */
export function fatedMemorySide(face: Extract<CardFace, { kind: 'fated-mnemos' }>, progress?: MemoryProgress) {
  const resolved = Boolean(progress && fatedGrowthAvailable(progress));
  return {
    resolved, name: resolved ? face.data.growthName : face.name,
    ability: resolved ? face.data.growthAbility : face.data.effect,
    flavor: resolved ? undefined : face.data.flavor,
    traits: resolved ? [] : face.data.traits,
    stats: resolved ? [] : face.data.stats,
  };
}
