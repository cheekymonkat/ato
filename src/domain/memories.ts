import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { CardFace } from './cards.ts';
import { canDiscardCard, canExhaustCard } from './ability-costs.ts';
import { unlinkRemovedHost, loadoutState } from './loadout.ts';
import type { Argonaut, CardInstance, MemoryProgress, Party } from './party.ts';
export type MemoryKind = 'mnemos' | 'fated-mnemos';
export const memoryKey = (kind: MemoryKind) => kind === 'mnemos' ? 'mnemosIds' : 'fatedMnemosIds';
export const memoryFamily = (kind: MemoryKind) => kind === 'mnemos' ? 'Mnemos' : 'Fated Mnemos';
export const MEMORY_NODE_LIMIT = 10;
export const memoryNodeLimit = (kind: MemoryKind) => kind === 'fated-mnemos' ? 3 : MEMORY_NODE_LIMIT;
/** User-corrected gateways sit after ordinary nodes 3 and 7; markers are not extra nodes. */
export const MEMORY_GATEWAYS = [3, 7] as const;
export const memoryBreakthroughs = (progress: MemoryProgress): [boolean, boolean] => progress.breakthroughs ?? [false, false];
export function memoryAbilityAvailable(index: number, progress: MemoryProgress): boolean {
  if (index === 0) return true;
  const threshold = MEMORY_GATEWAYS[index - 1];
  return threshold !== undefined && (progress.node ?? 0) >= threshold;
}
export const fatedGrowthAvailable = (progress: MemoryProgress) => (progress.node ?? 0) >= memoryNodeLimit('fated-mnemos');
export const canExhaustMemory = (face: CardFace | undefined, progress: MemoryProgress) => canExhaustCard(face, fatedGrowthAvailable(progress));
export const canDiscardMemory = (face: CardFace | undefined, progress: MemoryProgress) => canDiscardCard(face, fatedGrowthAvailable(progress));
export const validMemoryNode = (value: number, kind: MemoryKind = 'mnemos') => Number.isSafeInteger(value) && value >= 0 && value <= memoryNodeLimit(kind);
export function memoryProgress(instance: CardInstance): MemoryProgress {
  return instance.memoryProgress || { node: null, growthUnlocked: false };
}
export function memoryAt(argonaut: Argonaut, kind: MemoryKind, index: number): CardInstance | undefined {
  return argonaut.instances.find(instance => instance.id === argonaut[memoryKey(kind)][index]);
}
export interface MemoryPosition { argonautId: string; kind: MemoryKind; index: number }
export interface AssignedMemory extends MemoryPosition { argonautName: string; instance: CardInstance }
export function assignedMemories(party: Pick<Party, 'argonauts'>): AssignedMemory[] {
  return party.argonauts.flatMap(member => (['mnemos', 'fated-mnemos'] as const).flatMap(kind => member[memoryKey(kind)].flatMap((id, index) => {
    const instance = member.instances.find(item => item.id === id);
    return instance ? [{ argonautId: member.id, argonautName: member.name, kind, index, instance }] : [];
  })));
}
/** Exclude only the position being edited, so reselecting its card preserves progress. */
export function memoryConflict(party: Pick<Party, 'argonauts'>, definitionId: string, target: MemoryPosition): AssignedMemory | undefined {
  return assignedMemories(party).find(assignment => assignment.instance.definitionId === definitionId
    && !(assignment.argonautId === target.argonautId && assignment.kind === target.kind && assignment.index === target.index));
}
export function duplicateMemories(party: Pick<Party, 'argonauts'>): AssignedMemory[] {
  const seen = new Set<string>();
  return assignedMemories(party).filter(assignment => {
    if (seen.has(assignment.instance.definitionId)) return true;
    seen.add(assignment.instance.definitionId); return false;
  });
}
export function removeMemory(argonaut: Argonaut, kind: MemoryKind, index: number): Argonaut {
  const item = memoryAt(argonaut, kind, index);
  if (!item) return argonaut;
  const detached = unlinkRemovedHost(argonaut, item.id);
  return { ...detached, [memoryKey(kind)]: argonaut[memoryKey(kind)].map((id, slot) => slot === index ? null : id), instances: argonaut.instances.filter(instance => instance.id !== item.id) };
}
export interface MemoryRequest { kind: MemoryKind; index: number; definitionId: string; faceId: 'front' | 'back'; instanceId: string }
export function assignMemory(argonaut: Argonaut, request: MemoryRequest, catalogue: CatalogueRepository): Argonaut {
  const { kind, index, definitionId, faceId, instanceId } = request;
  const face = catalogue.getFace(definitionId, faceId);
  if (memoryConflict({ argonauts: [argonaut] }, definitionId, { argonautId: argonaut.id, kind, index })) return argonaut;
  const capacity = loadoutState(argonaut, catalogue).positions.filter(position => position.kind === kind).length;
  if (!['mnemos', 'fated-mnemos'].includes(kind) || !Number.isSafeInteger(index) || index < 0 || index >= capacity || face?.kind !== kind || !instanceId.trim() || instanceId === argonaut.id || instanceId === argonaut.titan?.id) return argonaut;
  const old = memoryAt(argonaut, kind, index), existing = argonaut.instances.find(instance => instance.id === instanceId);
  if (existing && (existing.id !== old?.id || existing.definitionId !== definitionId)) return argonaut;
  const cleaned = old && old.id !== instanceId ? removeMemory(argonaut, kind, index) : argonaut;
  const instance: CardInstance = existing ? { ...existing, faceId } : { id: instanceId, definitionId, faceId, exhausted: false, enabledEffectIds: [], counters: {}, memoryProgress: { node: 0, growthUnlocked: false } };
  const ids = [...cleaned[memoryKey(kind)]];
  while (ids.length <= index) ids.push(null);
  ids[index] = instance.id;
  return { ...cleaned, [memoryKey(kind)]: ids, instances: existing ? cleaned.instances.map(item => item.id === instance.id ? instance : item) : [...cleaned.instances, instance] };
}
export function updateMemory(argonaut: Argonaut, id: string, changes: { faceId?: 'front' | 'back'; exhausted?: boolean; discarded?: boolean; progress?: Partial<MemoryProgress> }, catalogue: CatalogueRepository): Argonaut {
  const kind = argonaut.mnemosIds.includes(id) ? 'mnemos' : argonaut.fatedMnemosIds.includes(id) ? 'fated-mnemos' : null;
  const item = argonaut.instances.find(instance => instance.id === id);
  if (!kind || !item) return argonaut;
  if (changes.faceId && catalogue.getFace(item.definitionId, changes.faceId)?.kind !== kind) return argonaut;
  const progress = { ...memoryProgress(item), ...changes.progress };
  const face = catalogue.getFace(item.definitionId, changes.faceId || item.faceId);
  if (changes.discarded !== undefined && typeof changes.discarded !== 'boolean') return argonaut;
  if (changes.discarded === true && !canDiscardMemory(face, progress)) return argonaut;
  if (changes.exhausted === true && (item.discarded || changes.discarded || !canExhaustMemory(face, progress))) return argonaut;
  // Historical saves can contain larger counts. Keep them on read, but validate every new node edit.
  if (changes.progress?.node !== undefined && changes.progress.node !== null && !validMemoryNode(changes.progress.node, kind)) return argonaut;
  if (changes.progress?.breakthroughs !== undefined) {
    const completed = changes.progress.breakthroughs;
    if (kind !== 'mnemos' || !Array.isArray(completed) || completed.length !== 2 || completed.some(value => typeof value !== 'boolean') || completed[1] && !completed[0]
      || completed.some((value, index) => value && !memoryBreakthroughs(memoryProgress(item))[index] && (progress.node ?? 0) < MEMORY_GATEWAYS[index])) return argonaut;
  }
  if (changes.progress?.growthUnlocked === true && (progress.node ?? 0) < memoryNodeLimit('fated-mnemos')) return argonaut;
  if (progress.node !== null && (!Number.isSafeInteger(progress.node) || progress.node < 0) || typeof progress.growthUnlocked !== 'boolean' || kind === 'mnemos' && changes.progress?.growthUnlocked !== undefined) return argonaut;
  return { ...argonaut, instances: argonaut.instances.map(instance => instance.id === id ? { ...instance,
    ...(changes.faceId ? { faceId: changes.faceId } : {}), ...(changes.exhausted === undefined ? {} : { exhausted: changes.exhausted }),
    ...(changes.discarded === undefined ? {} : { discarded: changes.discarded, ...(changes.discarded ? { exhausted: false } : {}) }),
    ...(changes.progress ? { memoryProgress: progress } : {}) } : instance) };
}

/** Apply deltas to current reducer state so rapid taps cannot overwrite one another. */
export function changeMemoryNodes(argonaut: Argonaut, id: string, delta: -1 | 1, catalogue: CatalogueRepository): Argonaut {
  const item = argonaut.instances.find(instance => instance.id === id);
  const kind = argonaut.mnemosIds.includes(id) ? 'mnemos' : argonaut.fatedMnemosIds.includes(id) ? 'fated-mnemos' : null;
  if (!item || !kind || ![-1, 1].includes(delta)) return argonaut;
  const node = memoryProgress(item).node ?? 0, next = node + delta;
  return validMemoryNode(node, kind) && validMemoryNode(next, kind) ? updateMemory(argonaut, id, { progress: { node: next } }, catalogue) : argonaut;
}
