import type { DefinitionId, FaceId } from './cards.ts';
import { assert, isJsonValue, isRecord } from './json.ts';
import type { JsonValue } from './json.ts';

export const ARGONAUT_COLOURS = ['#B54A48', '#416EAA', '#547E59', '#B38A35'] as const;
export const SKILL_NAMES = ['Courage', 'Cunning', 'Endurance', 'Fury', 'Will', 'Wisdom'] as const;
export type SkillName = typeof SKILL_NAMES[number];
export interface CardInstance {
  id: string; definitionId: DefinitionId; faceId: FaceId; exhausted: boolean;
  enabledEffectIds: string[]; counters: Record<string, number>;
}
export interface EquipmentAssignment { instanceId: string; positionIds: string[]; attachmentHostId: string | null }
export interface Argonaut {
  id: string; name: string; colour: string; argonautDefinitionId: DefinitionId | null;
  skills: Record<SkillName, number>; titan: CardInstance | null;
  instances: CardInstance[]; equipment: EquipmentAssignment[];
  mnemosIds: string[]; fatedMnemosIds: string[];
  counters: { rage: number; fate: number; danger: number };
  localConditions: string[]; tokens: Record<string, number>;
}
export interface Party {
  saveSchemaVersion: 1; id: string; catalogueVersion: string;
  argonauts: Argonaut[]; order: string[]; activeArgonautId: string;
  resources: Record<string, number>;
}

export function isColour(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** IDs are supplied by the state/storage layer: no platform API in the domain. */
export function createParty(id: string, argonautIds: readonly string[], catalogueVersion: string): Party {
  assert(id.trim() && catalogueVersion.trim(), 'Party and catalogue IDs must be nonblank');
  assert(argonautIds.length === 4 && new Set(argonautIds).size === 4 && argonautIds.every(v => v.trim()), 'Supply four distinct nonblank Argonaut IDs');
  const argonauts = argonautIds.map((argonautId, index): Argonaut => ({ id: argonautId, name: `Argonaut ${index + 1}`,
    colour: ARGONAUT_COLOURS[index], argonautDefinitionId: null,
    skills: { Courage: 0, Cunning: 0, Endurance: 0, Fury: 0, Will: 0, Wisdom: 0 },
    titan: null, instances: [], equipment: [], mnemosIds: [], fatedMnemosIds: [],
    counters: { rage: 0, fate: 0, danger: 0 }, localConditions: [], tokens: {} }));
  return { saveSchemaVersion: 1, id, catalogueVersion, argonauts, order: [...argonautIds], activeArgonautId: argonautIds[0], resources: {} };
}

function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(v => typeof v === 'string' && v.trim()); }
function dictionary(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(v => Number.isSafeInteger(v));
}
function checkInstance(value: unknown, path: string): asserts value is CardInstance {
  assert(isRecord(value) && typeof value.id === 'string' && value.id.trim() && typeof value.definitionId === 'string' && value.definitionId.trim(), `${path}: invalid instance identity`);
  assert(value.faceId === 'front' || value.faceId === 'back', `${path}: invalid face`);
  assert(typeof value.exhausted === 'boolean' && strings(value.enabledEffectIds) && dictionary(value.counters), `${path}: invalid instance state`);
}

/** Catalogue resolution is separate so missing definitions can be recovered on restore. */
export function parseParty(value: unknown): Party {
  assert(isRecord(value) && isJsonValue(value) && value.saveSchemaVersion === 1, 'Unsupported party save schema or non-JSON state');
  assert(typeof value.id === 'string' && value.id.trim() && typeof value.catalogueVersion === 'string' && value.catalogueVersion.trim(), 'Invalid party identity/version');
  assert(Array.isArray(value.argonauts) && value.argonauts.length === 4, 'Party must contain four Argonauts');
  const allInstanceIds = new Set<string>();
  for (const [index, argonaut] of value.argonauts.entries()) {
    const path = `argonauts/${index}`;
    assert(isRecord(argonaut) && typeof argonaut.id === 'string' && argonaut.id.trim() && typeof argonaut.name === 'string', `${path}: invalid identity`);
    assert(isColour(argonaut.colour), `${path}: colour must be #RRGGBB`);
    assert(argonaut.argonautDefinitionId === null || (typeof argonaut.argonautDefinitionId === 'string' && argonaut.argonautDefinitionId.trim()), `${path}: invalid Argonaut definition`);
    const skills = argonaut.skills, counters = argonaut.counters;
    assert(dictionary(skills) && SKILL_NAMES.every(skill => Object.hasOwn(skills, skill)), `${path}: missing or invalid skill`);
    assert(dictionary(counters) && ['rage', 'fate', 'danger'].every(key => Object.hasOwn(counters, key)), `${path}: invalid counters`);
    assert(dictionary(argonaut.tokens) && strings(argonaut.localConditions) && strings(argonaut.mnemosIds) && strings(argonaut.fatedMnemosIds), `${path}: invalid conditions/memories/tokens`);
    assert(Array.isArray(argonaut.instances) && Array.isArray(argonaut.equipment), `${path}: invalid loadout`);
    const ownIds = new Set<string>();
    for (const instance of argonaut.instances) {
      checkInstance(instance, path);
      assert(!allInstanceIds.has(instance.id), `${path}: duplicate instance ID ${instance.id}`);
      ownIds.add(instance.id); allInstanceIds.add(instance.id);
    }
    if (argonaut.titan !== null) {
      checkInstance(argonaut.titan, `${path}/titan`);
      assert(!allInstanceIds.has(argonaut.titan.id), `${path}: duplicate Titan instance ID`);
      allInstanceIds.add(argonaut.titan.id);
    }
    const equipped = new Set<string>(), occupied = new Set<string>();
    for (const assignment of argonaut.equipment) {
      assert(isRecord(assignment) && typeof assignment.instanceId === 'string' && ownIds.has(assignment.instanceId), `${path}: dangling equipment instance`);
      assert(!equipped.has(assignment.instanceId), `${path}: duplicate assignment`); equipped.add(assignment.instanceId);
      assert(strings(assignment.positionIds) && assignment.positionIds.length > 0, `${path}: missing positions`);
      for (const positionId of assignment.positionIds) { assert(!occupied.has(positionId), `${path}: position assigned twice`); occupied.add(positionId); }
      assert(assignment.attachmentHostId === null || (typeof assignment.attachmentHostId === 'string' && ownIds.has(assignment.attachmentHostId) && assignment.attachmentHostId !== assignment.instanceId), `${path}: invalid attachment host`);
    }
    for (const instanceId of [...argonaut.mnemosIds, ...argonaut.fatedMnemosIds]) assert(ownIds.has(instanceId), `${path}: dangling memory instance`);
    const assigned = [...argonaut.equipment.map(a => (a as Record<string, unknown>).instanceId), ...argonaut.mnemosIds, ...argonaut.fatedMnemosIds];
    assert(new Set(assigned).size === assigned.length, `${path}: instance assigned to multiple areas`);
  }
  const ids = value.argonauts.map(a => (a as Record<string, unknown>).id);
  assert(new Set(ids).size === 4 && strings(value.order) && value.order.length === 4 && new Set(value.order).size === 4 && value.order.every(id => ids.includes(id)), 'Invalid party order');
  assert(typeof value.activeArgonautId === 'string' && value.order.includes(value.activeArgonautId), 'Invalid active Argonaut');
  assert(dictionary(value.resources), 'Invalid party resources');
  return value as unknown as Party;
}

export function partyAsJson(party: Party): JsonValue {
  // The validation boundary also prevents NaN/Infinity reaching storage.
  return parseParty(party) as unknown as JsonValue;
}
