import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { Argonaut, CardInstance } from '../domain/party.ts';
import { loadoutState } from '../domain/loadout.ts';
import type { CapacityPosition } from '../domain/slots.ts';

export function dashboardPositions(argonaut: Argonaut, catalogue: CatalogueRepository): CapacityPosition[] {
  return loadoutState(argonaut, catalogue).positions;
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
