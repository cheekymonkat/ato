import type { DefinitionId, FaceId } from './cards.ts';
import { assert, isJsonValue, isRecord } from './json.ts';
import type { JsonValue } from './json.ts';
import { isCampaignCycle, TOKEN_TYPES } from './tokens.ts';
import type { CampaignCycle } from './tokens.ts';
import { validConditionRecords } from './conditions.ts';
import { isAfflictionId } from './afflictions.ts';
import type { AfflictionId } from './afflictions.ts';

export const ARGONAUT_COLOURS = ['#B54A48', '#416EAA', '#547E59', '#B38A35'] as const;
export const SKILL_NAMES = ['Courage', 'Cunning', 'Endurance', 'Fury', 'Will', 'Wisdom'] as const;
export type SkillName = typeof SKILL_NAMES[number];
export interface CardReference { definitionId: DefinitionId; faceId: FaceId }
export interface ConditionRecord {
  id: string; name: string; reference: CardReference | null;
  source: string; duration: string; amount: number;
}
export interface MemoryProgress { node: number | null; growthUnlocked: boolean; breakthroughs?: [boolean, boolean] }
export interface CardInstance {
  id: string; definitionId: DefinitionId; faceId: FaceId; exhausted: boolean;
  /** Reversible discard marker; absent in older saves means false. */
  discarded?: boolean;
  enabledEffectIds: string[]; counters: Record<string, number>;
  /** Explicit player confirmation, never inferred from a condition's prose. */
  satisfiedEffectIds?: string[];
  memoryProgress?: MemoryProgress;
}
export interface EquipmentAssignment {
  instanceId: string; positionIds: string[];
  /** Legacy metadata; new attachments are placed directly with a null host. */
  attachmentHostId: string | null;
  override?: { reason: string; codes: string[] };
}
export interface Argonaut {
  id: string; name: string; colour: string; argonautDefinitionId: DefinitionId | null;
  /** Manual contributions; portrait and equipped memory bonuses and display bounds are derived. */
  skills: Record<SkillName, number>; titan: CardInstance | null;
  instances: CardInstance[]; equipment: EquipmentAssignment[];
  mnemosIds: (string | null)[]; fatedMnemosIds: (string | null)[];
  tableOverrides: { trauma: CardReference | null; kratos: CardReference | null };
  counters: { rage: number; fate: number; danger: number };
  localConditions: string[]; tokens: Record<string, number>;
  /** Signed modifier-token totals; absent in older saves means zero. Derived Gear effects are not stored here. */
  combatModifiers?: { precision: number; speed: number };
  /** Optional structured records; legacy labels remain recoverable separately. */
  conditions?: ConditionRecord[];
  /** Free-text notes; absent in older saves means empty. */
  notes?: string;
  /** Persistent selections from the affliction reference list; absent means none. */
  afflictions?: AfflictionId[];
}
export interface Party {
  saveSchemaVersion: 2; id: string; catalogueVersion: string;
  /** Optional for compatibility with existing saves; missing means Cycle 1. */
  campaignCycle?: CampaignCycle;
  /** Read-only assigned-card gate highlighting; absent in existing saves means off. */
  rulesAssistance?: boolean;
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
    titan: null, instances: [], equipment: [], mnemosIds: [null, null], fatedMnemosIds: [null, null], tableOverrides: { trauma: null, kratos: null },
    counters: { rage: 0, fate: 0, danger: 0 }, localConditions: [], tokens: {} }));
  return { saveSchemaVersion: 2, id, catalogueVersion, campaignCycle: 1, argonauts, order: [...argonautIds], activeArgonautId: argonautIds[0], resources: {} };
}

function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(v => typeof v === 'string' && v.trim()); }
function dictionary(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(v => Number.isSafeInteger(v));
}
function memoryIds(value: unknown): value is (string | null)[] {
  return Array.isArray(value) && value.every(id => id === null || typeof id === 'string' && id.trim());
}
function checkReference(value: unknown): boolean {
  return value === null || isRecord(value) && typeof value.definitionId === 'string' && !!value.definitionId.trim() && (value.faceId === 'front' || value.faceId === 'back');
}

/** Version 1 had dense memory arrays and no table overrides. Preserve every existing record. */
function migrateParty(value: unknown): unknown {
  if (!isRecord(value) || value.saveSchemaVersion !== 1) return value;
  assert(isJsonValue(value) && Array.isArray(value.argonauts), 'Invalid legacy party');
  return { ...value, saveSchemaVersion: 2, argonauts: value.argonauts.map(member => {
    assert(isRecord(member) && strings(member.mnemosIds) && strings(member.fatedMnemosIds) && Array.isArray(member.instances), 'Invalid legacy memory records');
    const ids = [...member.mnemosIds, ...member.fatedMnemosIds];
    const padded = (values: string[]) => [...values, ...Array(Math.max(0, 2 - values.length)).fill(null)];
    return { ...member, tableOverrides: member.tableOverrides ?? { trauma: null, kratos: null }, mnemosIds: padded(member.mnemosIds), fatedMnemosIds: padded(member.fatedMnemosIds),
      instances: member.instances.map(instance => {
        if (!isRecord(instance) || !ids.includes(String(instance.id)) || instance.memoryProgress !== undefined) return instance;
        const node = isRecord(instance.counters) ? instance.counters.node : undefined;
        return { ...instance, memoryProgress: { node: Number.isSafeInteger(node) && (node as number) >= 0 ? node : null, growthUnlocked: false } };
      }) };
  }) };
}
function checkInstance(value: unknown, path: string): asserts value is CardInstance {
  assert(isRecord(value) && typeof value.id === 'string' && value.id.trim() && typeof value.definitionId === 'string' && value.definitionId.trim(), `${path}: invalid instance identity`);
  assert(value.faceId === 'front' || value.faceId === 'back', `${path}: invalid face`);
  assert(typeof value.exhausted === 'boolean' && strings(value.enabledEffectIds) && dictionary(value.counters), `${path}: invalid instance state`);
  assert(value.discarded === undefined || typeof value.discarded === 'boolean', `${path}: invalid discarded state`);
  assert(!(value.discarded && value.exhausted), `${path}: discarded card cannot also be exhausted`);
  assert(value.satisfiedEffectIds === undefined || strings(value.satisfiedEffectIds), `${path}: invalid confirmed effects`);
  const progress = value.memoryProgress;
  assert(progress === undefined || isRecord(progress) && (progress.node === null || Number.isSafeInteger(progress.node) && (progress.node as number) >= 0) && typeof progress.growthUnlocked === 'boolean', `${path}: invalid memory progress`);
  assert(progress === undefined || progress.breakthroughs === undefined || Array.isArray(progress.breakthroughs) && progress.breakthroughs.length === 2 && progress.breakthroughs.every(value => typeof value === 'boolean') && (!progress.breakthroughs[1] || progress.breakthroughs[0]), `${path}: invalid memory breakthroughs`);
}

/** Catalogue resolution is separate so missing definitions can be recovered on restore. */
export function parseParty(value: unknown): Party {
  value = migrateParty(value);
  assert(isRecord(value) && isJsonValue(value) && value.saveSchemaVersion === 2, 'Unsupported party save schema or non-JSON state');
  assert(typeof value.id === 'string' && value.id.trim() && typeof value.catalogueVersion === 'string' && value.catalogueVersion.trim(), 'Invalid party identity/version');
  assert(value.campaignCycle === undefined || isCampaignCycle(value.campaignCycle), 'Invalid campaign cycle');
  assert(value.rulesAssistance === undefined || typeof value.rulesAssistance === 'boolean', 'Invalid rules assistance setting');
  assert(Array.isArray(value.argonauts) && value.argonauts.length === 4, 'Party must contain four Argonauts');
  const allInstanceIds = new Set<string>();
  for (const [index, argonaut] of value.argonauts.entries()) {
    const path = `argonauts/${index}`;
    assert(isRecord(argonaut) && typeof argonaut.id === 'string' && argonaut.id.trim() && typeof argonaut.name === 'string', `${path}: invalid identity`);
    assert(argonaut.notes === undefined || typeof argonaut.notes === 'string', `${path}: invalid notes`);
    assert(argonaut.afflictions === undefined || Array.isArray(argonaut.afflictions) && argonaut.afflictions.every(isAfflictionId) && new Set(argonaut.afflictions).size === argonaut.afflictions.length, `${path}: invalid or duplicate afflictions`);
    assert(isColour(argonaut.colour), `${path}: colour must be #RRGGBB`);
    assert(argonaut.argonautDefinitionId === null || (typeof argonaut.argonautDefinitionId === 'string' && argonaut.argonautDefinitionId.trim()), `${path}: invalid Argonaut definition`);
    const skills = argonaut.skills, counters = argonaut.counters;
    assert(dictionary(skills) && SKILL_NAMES.every(skill => Object.hasOwn(skills, skill)), `${path}: missing or invalid skill`);
    assert(dictionary(counters) && ['rage', 'fate', 'danger'].every(key => Object.hasOwn(counters, key)), `${path}: invalid counters`);
    assert(argonaut.combatModifiers === undefined || dictionary(argonaut.combatModifiers) && ['precision', 'speed'].every(key => Object.hasOwn(argonaut.combatModifiers as object, key)), `${path}: invalid combat modifiers`);
    const tokens = argonaut.tokens;
    assert(dictionary(tokens) && strings(argonaut.localConditions) && memoryIds(argonaut.mnemosIds) && memoryIds(argonaut.fatedMnemosIds), `${path}: invalid conditions/memories/tokens`);
    assert(TOKEN_TYPES.every(token => tokens[token.name] === undefined || tokens[token.name] >= 0), `${path}: token counts cannot be negative`);
    const conditions = argonaut.conditions;
    assert(conditions === undefined || validConditionRecords(conditions), `${path}: invalid or duplicate condition records`);
    assert(isRecord(argonaut.tableOverrides) && checkReference(argonaut.tableOverrides.trauma) && checkReference(argonaut.tableOverrides.kratos), `${path}: invalid table overrides`);
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
      const titanId = isRecord(argonaut.titan) ? argonaut.titan.id : null;
      assert(assignment.attachmentHostId === null || (typeof assignment.attachmentHostId === 'string' && (ownIds.has(assignment.attachmentHostId) || assignment.attachmentHostId === titanId || assignment.attachmentHostId === argonaut.id) && assignment.attachmentHostId !== assignment.instanceId), `${path}: invalid attachment host`);
      assert(assignment.override === undefined || (isRecord(assignment.override) && typeof assignment.override.reason === 'string' && assignment.override.reason.trim() && strings(assignment.override.codes)), `${path}: invalid override`);
    }
    for (const instanceId of [...argonaut.mnemosIds, ...argonaut.fatedMnemosIds]) assert(instanceId === null || ownIds.has(instanceId), `${path}: dangling memory instance`);
    const assigned = [...argonaut.equipment.map(a => (a as Record<string, unknown>).instanceId), ...argonaut.mnemosIds, ...argonaut.fatedMnemosIds].filter(id => id !== null);
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
