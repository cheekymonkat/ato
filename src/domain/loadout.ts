import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { CardFace, FaceId, SlotKind } from './cards.ts';
import type { Argonaut, CardInstance, EquipmentAssignment } from './party.ts';
import { DEFAULT_BASELINE, deriveCapacity, meetsSlotRestriction } from './slots.ts';
import type { CapacityPosition, CapacitySource } from './slots.ts';
import { titanHandRule } from './hand-rules.ts';

export interface SlotOption { kind: SlotKind; units: number; label: string; review?: boolean }
export interface LoadoutIssue { code: string; message: string; requiresOverride: boolean }
const issue = (code: string, message: string, requiresOverride = true): LoadoutIssue => ({ code, message, requiresOverride });

/** Printed slot syntax only; unusual combinations remain an explicit player choice. */
export function slotOptions(face: CardFace, handRule: ReturnType<typeof titanHandRule> = null): SlotOption[] {
  if (face.kind !== 'gear') return [];
  return face.data.slot.split(',').flatMap<SlotOption>(part => {
    const value = part.trim(), simple = { Support: 'support', Armor: 'armor', Attachment: 'attachment', DoubleAttachment: 'attachment' } as const;
    if (Object.hasOwn(simple, value)) return [{ kind: simple[value as keyof typeof simple], units: value === 'DoubleAttachment' ? 2 : 1, label: value }];
    const hands = value.match(/^(\d+)( 1)? Hands?$/);
    if (hands) return [
      ...(handRule && value === '3 Hands' ? [{ kind: 'hand' as const, units: 2, label: '2 Hands (Titan ability)' }] : []),
      { kind: 'hand' as const, units: Number(hands[1]), label: value, review: Boolean(hands[2]) },
    ];
    if (value === '* Hands') return [1, 2, 3].map(units => ({ kind: 'hand' as const, units, label: `${units} ${units === 1 ? 'Hand' : 'Hands'} (manual)`, review: true }));
    return [];
  });
}

function assignmentIssues(argonaut: Argonaut, assignment: EquipmentAssignment, positions: CapacityPosition[], catalogue: CatalogueRepository): LoadoutIssue[] {
  const instance = argonaut.instances.find(item => item.id === assignment.instanceId), face = instance && catalogue.getFace(instance.definitionId, instance.faceId);
  if (!face || face.kind !== 'gear') return [issue('definition', 'Gear definition or selected face is unavailable.')];
  const occupied = assignment.positionIds.map(id => positions.find(position => position.id === id));
  if (occupied.some(position => !position)) return [issue('capacity', assignment.positionIds.some(id => id.startsWith('unassigned:')) ? 'This card needs a destination.' : 'A required position is no longer available.')];
  const actual = occupied as CapacityPosition[], kinds = new Set(actual.map(position => position.kind));
  const options = slotOptions(face, titanHandRule(argonaut, catalogue)), issues: LoadoutIssue[] = [];
  const option = options.find(option => kinds.size === 1 && option.kind === actual[0].kind && option.units === actual.length);
  if (!option) issues.push(issue('slot', `Printed slot ${face.data.slot} does not match these ${actual.length} positions.`));
  if (actual.some(position => !meetsSlotRestriction(face, position))) issues.push(issue('restriction', 'This bonus position requires the printed traits shown on the slot.'));
  if (option?.review) issues.push(issue('interpretation', `Confirm the hand requirement for ${face.data.slot} from its ability text.`, false));
  return issues;
}

function accepts(assignment: EquipmentAssignment, issues: LoadoutIssue[]): boolean {
  return issues.every(entry => !entry.requiresOverride || Boolean(assignment.override?.reason.trim() && assignment.override.codes.includes(entry.code)));
}

/** Resolve capacity chains from independently available base positions. */
export function loadoutState(argonaut: Argonaut, catalogue: CatalogueRepository) {
  let positions = deriveCapacity([], DEFAULT_BASELINE), active = new Set<string>();
  for (let iteration = 0; iteration <= argonaut.equipment.length; iteration++) {
    const nextActive = new Set(argonaut.equipment.filter(assignment =>
      assignment.positionIds.every(id => positions.some(position => position.id === id)) &&
      accepts(assignment, assignmentIssues(argonaut, assignment, positions, catalogue))).map(entry => entry.instanceId));
    const sources: CapacitySource[] = [...nextActive].flatMap(id => {
      const instance = argonaut.instances.find(item => item.id === id), definition = instance && catalogue.get(instance.definitionId);
      return instance && definition ? [{ instance, definition }] : [];
    });
    const nextPositions = deriveCapacity(sources, DEFAULT_BASELINE, { gateSatisfied: (condition, source) => {
      const face = source.definition.faces.find(face => face.id === source.instance.faceId);
      return Boolean(face?.slotEffects.some(effect => effect.conditions.includes(condition) && source.instance.satisfiedEffectIds?.includes(effect.id)));
    } });
    const same = nextActive.size === active.size && [...nextActive].every(id => active.has(id)) && nextPositions.length === positions.length && nextPositions.every(position => positions.some(old => old.id === position.id));
    active = nextActive; positions = nextPositions;
    if (same) break;
  }
  const pending = argonaut.equipment.filter(entry => !active.has(entry.instanceId)).map(assignment => ({ assignment,
    reasons: assignmentIssues(argonaut, assignment, positions, catalogue).map(entry => entry.message) }));
  return { positions, activeInstanceIds: active, pending };
}

/** Clear legacy host metadata while preserving attachments in their own positions. */
export function unlinkRemovedHost(argonaut: Argonaut, removedId: string): Argonaut {
  if (!argonaut.equipment.some(assignment => assignment.attachmentHostId === removedId)) return argonaut;
  return { ...argonaut, equipment: argonaut.equipment.map(assignment => assignment.attachmentHostId === removedId
    ? { ...assignment, attachmentHostId: null } : assignment) };
}

export function removeEquipment(argonaut: Argonaut, instanceId: string): Argonaut {
  if (!argonaut.equipment.some(entry => entry.instanceId === instanceId)) return argonaut;
  const detached = unlinkRemovedHost(argonaut, instanceId);
  return { ...detached, instances: detached.instances.filter(item => item.id !== instanceId), equipment: detached.equipment.filter(entry => entry.instanceId !== instanceId) };
}

export interface EquipRequest {
  definitionId: string; faceId: FaceId; positionId: string; instanceId: string;
  reuse?: boolean; units?: number; overrideReason?: string;
}
export function planEquipment(argonaut: Argonaut, request: EquipRequest, catalogue: CatalogueRepository) {
  const fail = (message: string) => ({ errors: [message], issues: [] as LoadoutIssue[], next: null as Argonaut | null, replacedIds: [] as string[] });
  const face = catalogue.getFace(request.definitionId, request.faceId);
  if (!face || face.kind !== 'gear') return fail('Select a valid Gear face.');
  const currentInstance = argonaut.instances.find(item => item.id === request.instanceId);
  if (!request.instanceId.trim() || request.reuse && (!currentInstance || currentInstance.definitionId !== request.definitionId) || !request.reuse && (currentInstance || request.instanceId === argonaut.titan?.id || request.instanceId === argonaut.id)) return fail('Card instance identity is invalid.');
  const original = loadoutState(argonaut, catalogue), target = original.positions.find(position => position.id === request.positionId);
  if (!target) return fail('This position is no longer available. Choose another position.');
  const replacing = argonaut.equipment.filter(assignment => original.activeInstanceIds.has(assignment.instanceId) && assignment.instanceId !== request.instanceId && assignment.positionIds.includes(target.id)).map(entry => entry.instanceId);
  let base = argonaut;
  for (const id of replacing) base = removeEquipment(base, id);
  // Temporarily exclude a reused instance; its own grants cannot justify its placement.
  base = { ...base, equipment: base.equipment.filter(entry => entry.instanceId !== request.instanceId) };
  const state = loadoutState(base, catalogue), destination = state.positions.find(position => position.id === target.id);
  if (!destination) return fail('Replacing this source removes the chosen bonus position.');
  const options = slotOptions(face, titanHandRule(base, catalogue)).filter(option => option.kind === target.kind);
  const units = request.units ?? options[0]?.units ?? 1;
  if (!Number.isSafeInteger(units) || units < 1 || units > 12) return fail('Select a valid position count.');
  const busy = new Set(base.equipment.filter(entry => state.activeInstanceIds.has(entry.instanceId)).flatMap(entry => entry.positionIds));
  const positions = [destination, ...state.positions.filter(position => position.kind === target.kind && position.id !== target.id && !busy.has(position.id))].slice(0, units);
  const instance: CardInstance = currentInstance && request.reuse ? { ...currentInstance, faceId: request.faceId } : { id: request.instanceId, definitionId: request.definitionId, faceId: request.faceId, exhausted: false, enabledEffectIds: [], counters: {} };
  const assignment: EquipmentAssignment = { instanceId: instance.id, positionIds: positions.map(position => position.id), attachmentHostId: null };
  const selectedIds = new Set(assignment.positionIds);
  const retained = base.equipment.map(entry => entry.positionIds.some(id => selectedIds.has(id)) ? { ...entry, positionIds: [`unassigned:${entry.instanceId}`], attachmentHostId: null } : entry);
  const candidate: Argonaut = { ...base, instances: [...base.instances.filter(item => item.id !== instance.id), instance], equipment: [...retained, assignment] };
  let next: Argonaut | null = candidate;
  const issues = assignmentIssues(candidate, assignment, state.positions, catalogue);
  if (positions.length < units) issues.push(issue('slot', `This selection needs ${units} positions; only ${positions.length} are available.`));
  if (request.overrideReason?.trim()) assignment.override = { reason: request.overrideReason.trim().slice(0, 300), codes: [...new Set(issues.filter(entry => entry.requiresOverride).map(entry => entry.code))] };
  if (!accepts(assignment, issues)) next = null;
  return { errors: [] as string[], issues, next, replacedIds: replacing };
}

export function changeEquipmentFace(argonaut: Argonaut, instanceId: string, faceId: FaceId, catalogue: CatalogueRepository): Argonaut {
  const instance = argonaut.instances.find(item => item.id === instanceId), assignment = argonaut.equipment.find(entry => entry.instanceId === instanceId);
  if (!instance || !assignment || !catalogue.getFace(instance.definitionId, faceId)) return argonaut;
  const result = planEquipment(argonaut, { instanceId, reuse: true, definitionId: instance.definitionId, faceId, positionId: assignment.positionIds[0] }, catalogue);
  if (result.next) return result.next;
  // Keep the new face and independent state, but do not activate incompatible capacity.
  const detached = unlinkRemovedHost(argonaut, instanceId);
  return { ...detached, instances: detached.instances.map(item => item.id === instanceId ? { ...item, faceId } : item),
    equipment: detached.equipment.map(entry => {
      if (entry.instanceId !== instanceId) return entry;
      const rest = { ...entry }; delete rest.override;
      return { ...rest, positionIds: [`unassigned:${instanceId}`], attachmentHostId: null };
    }) };
}
