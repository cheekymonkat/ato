import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { CardFace } from './cards.ts';
import type { JsonValue } from './json.ts';
import type { Argonaut, CardReference } from './party.ts';
import type { PatternKind } from './pattern-table.ts';
import type { CapacitySource } from './slots.ts';

export const overrideKey = (kind: PatternKind) => kind === 'Trauma' ? 'trauma' : 'kratos';
export function faceTable(face: CardFace | undefined, kind: PatternKind): JsonValue[] | null {
  if (!face || face.family !== 'Titan' && face.family !== 'Pattern') return null;
  const table = face.data[kind === 'Trauma' ? 'traumaTable' : 'kratosTable'];
  return Array.isArray(table) && table.length > 0 ? table : null;
}
export function supportsPattern(face: CardFace | undefined, kind: PatternKind): boolean {
  return face?.family === 'Pattern' && faceTable(face, kind) !== null;
}

/** Stable unsaved source identities keep Pattern grants separate from equipment instances. */
export function assignedPatternSources(argonaut: Argonaut, catalogue: CatalogueRepository): CapacitySource[] {
  return (['Trauma', 'Kratos'] as const).flatMap(referenceKind => {
    const reference = argonaut.tableOverrides[overrideKey(referenceKind)];
    if (!reference) return [];
    const definition = catalogue.get(reference.definitionId), face = catalogue.getFace(reference.definitionId, reference.faceId);
    if (!definition || !supportsPattern(face, referenceKind)) return [];
    return [{ definition, referenceKind, instance: {
      id: `pattern:${encodeURIComponent(argonaut.id)}:${referenceKind}:${encodeURIComponent(definition.id)}:${reference.faceId}`,
      definitionId: definition.id, faceId: reference.faceId, exhausted: false, enabledEffectIds: [], counters: {},
    } }];
  });
}
export interface ResolvedTable { source: 'titan' | 'pattern' | 'missing'; face: CardFace | null; table: JsonValue[]; message: string | null }
/** An unresolved explicit override must not silently display the Titan default instead. */
export function resolveTable(argonaut: Argonaut, kind: PatternKind, catalogue: CatalogueRepository): ResolvedTable {
  const reference: CardReference | null = argonaut.tableOverrides[overrideKey(kind)] || argonaut.titan;
  const isOverride = argonaut.tableOverrides[overrideKey(kind)] !== null;
  if (!reference) return { source: 'missing', face: null, table: [], message: `Choose a Titan or a ${kind} Pattern to view this table.` };
  const face = catalogue.getFace(reference.definitionId, reference.faceId);
  const table = faceTable(face, kind);
  if (!face || !table || (isOverride ? !supportsPattern(face, kind) : face.family !== 'Titan')) {
    return { source: 'missing', face: face || null, table: [], message: `The saved ${isOverride ? 'Pattern override' : 'Titan'} has no available ${kind.toLowerCase()} table. Its reference has been kept.` };
  }
  return { source: isOverride ? 'pattern' : 'titan', face, table, message: null };
}
export function flattenAbilities(value: JsonValue): JsonValue[] {
  return Array.isArray(value) ? value.flatMap(flattenAbilities) : [value];
}
