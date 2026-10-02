import type { CardDefinition, CardFace, EffectCondition, SlotEligibility, SlotKind } from './cards.ts';
import type { CardInstance, EquipmentAssignment } from './party.ts';
import { assert } from './json.ts';

export type SlotBaseline = Record<SlotKind, number>;
/** Starting UI baseline; attachment-host and hand-span rules are added in Stage 4. */
export const DEFAULT_BASELINE: Readonly<SlotBaseline> = Object.freeze({ hand: 2, armor: 1, support: 2, attachment: 3, mnemos: 2, 'fated-mnemos': 2 });
export interface CapacityPosition {
  id: string; kind: SlotKind; eligibility: SlotEligibility | null;
  source: { definitionId: string; instanceId: string; faceId: string; effectId: string } | null;
}
export interface CapacitySource { instance: CardInstance; definition: CardDefinition }
export interface CapacityContext { gateSatisfied?: (condition: EffectCondition, source: CapacitySource) => boolean }

export function bonusPositionId(instanceId: string, effectId: string, index: number): string {
  return `bonus:${encodeURIComponent(instanceId)}:${encodeURIComponent(effectId)}:${index}`;
}

/** Pure derived state. Callers supply active equipped sources; no saved slot counters. */
export function deriveCapacity(sources: readonly CapacitySource[], baseline: SlotBaseline = DEFAULT_BASELINE, context: CapacityContext = {}): CapacityPosition[] {
  const positions: CapacityPosition[] = [], sourceIds = new Set<string>();
  for (const [kind, count] of Object.entries(baseline)) {
    assert(Number.isSafeInteger(count) && count >= 0, `Invalid ${kind} baseline`);
    for (let index = 0; index < count; index++) positions.push({ id: `base:${kind}:${index}`, kind: kind as SlotKind, eligibility: null, source: null });
  }
  for (const source of sources) {
    assert(!sourceIds.has(source.instance.id), 'Duplicate capacity source instance'); sourceIds.add(source.instance.id);
    assert(source.instance.definitionId === source.definition.id, 'Capacity source definition mismatch');
    const face = source.definition.faces.find(f => f.id === source.instance.faceId);
    assert(face, 'Capacity source face missing');
    for (const effect of face.slotEffects) {
      if (effect.activation === 'optional-loadout' && !source.instance.enabledEffectIds.includes(effect.id)) continue;
      if (!effect.conditions.every(condition => context.gateSatisfied?.(condition, source) === true)) continue;
      for (let index = 0; index < effect.amount; index++) positions.push({ id: bonusPositionId(source.instance.id, effect.id, index), kind: effect.slot,
        eligibility: effect.eligibility, source: { definitionId: source.definition.id, instanceId: source.instance.id, faceId: face.id, effectId: effect.id } });
    }
  }
  return positions;
}

/** Only the additional eligibility restriction; does not validate multi-hand/host rules. */
export function meetsSlotRestriction(face: CardFace, position: CapacityPosition): boolean {
  return !position.eligibility || (face.family === position.eligibility.family && face.kind === 'gear' && position.eligibility.requiredTraits.every(trait => face.data.traits.includes(trait)));
}

/** Retain occupied positions after a grant disappears. The UI can surface these records. */
export function findAssignmentsNeedingReassignment(assignments: readonly EquipmentAssignment[], positions: readonly CapacityPosition[]): EquipmentAssignment[] {
  const ids = new Set(positions.map(position => position.id));
  return assignments.filter(assignment => assignment.positionIds.some(id => !ids.has(id)));
}
