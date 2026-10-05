import type { EquipmentAssignment } from '../domain/party.ts';
import type { CapacityPosition } from '../domain/slots.ts';

/** Keep real occupied positions for validation; display a multi-hand Weapon only once. */
export function visibleEquipmentPositions(positions: readonly CapacityPosition[], assignments: readonly EquipmentAssignment[], activeInstanceIds: ReadonlySet<string>): CapacityPosition[] {
  const shownWeapons = new Set<string>();
  return positions.filter(position => {
    if (position.kind !== 'hand') return true;
    const assignment = assignments.find(entry => activeInstanceIds.has(entry.instanceId) && entry.positionIds.includes(position.id));
    if (!assignment) return true;
    if (shownWeapons.has(assignment.instanceId)) return false;
    shownWeapons.add(assignment.instanceId);
    return true;
  });
}
