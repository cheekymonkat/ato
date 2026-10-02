import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { Argonaut, CardInstance } from '../domain/party.ts';
import { deriveCapacity, DEFAULT_BASELINE } from '../domain/slots.ts';
import type { CapacityPosition, CapacitySource } from '../domain/slots.ts';

export function dashboardPositions(argonaut: Argonaut, catalogue: CatalogueRepository): CapacityPosition[] {
  const sources: CapacitySource[] = [];
  // Start from independently available positions: a grant cannot activate itself
  // from its own bonus position, or through a circular chain of other grants.
  let positions = deriveCapacity([], DEFAULT_BASELINE);
  for (let iteration = 0; iteration <= argonaut.equipment.length; iteration++) {
    const positionIds = new Set(positions.map(position => position.id));
    const eligible = argonaut.equipment.filter(assignment => assignment.positionIds.every(id => positionIds.has(id)));
    sources.length = 0;
    for (const assignment of eligible) {
      const instance = argonaut.instances.find(item => item.id === assignment.instanceId);
      const definition = instance && catalogue.get(instance.definitionId);
      if (instance && definition) sources.push({ instance, definition });
    }
    const next = deriveCapacity(sources, DEFAULT_BASELINE);
    if (next.length === positions.length && next.every(position => positionIds.has(position.id))) return next;
    positions = next;
  }
  return positions;
}

/** Explicit development fixtures; never equipped through the production UI. */
export function armourFixture(name: string, argonautId: string, catalogue: CatalogueRepository) {
  const aliases: Record<string, string> = { trireme: 'AJ0266', paradox: 'CJ1521', baseline: '' };
  if (!Object.hasOwn(aliases, name)) return undefined;
  if (name === 'baseline') return { instances: [], equipment: [] };
  const definition = catalogue.byPrintedId(aliases[name])[0];
  if (!definition) return undefined;
  const instance: CardInstance = { id: `${argonautId}:preview-armour`, definitionId: definition.id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} };
  return { instances: [instance], equipment: [{ instanceId: instance.id, positionIds: ['base:armor:0'], attachmentHostId: null }] };
}

/** Ignore short, diagonal and multi-touch gestures. Left advances, right returns. */
export function swipeDirection(dx: number, dy: number, touches: number): -1 | 1 | undefined {
  if (touches !== 1 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.7) return undefined;
  return dx < 0 ? 1 : -1;
}
