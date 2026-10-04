import { assert, isJsonValue, isRecord } from './json.ts';
import type { JsonObject, JsonValue } from './json.ts';

export const CARD_FAMILIES = ['AI | BP', 'Argonaut', 'Attack', 'BP', 'Clue', 'Condition', 'Doom',
  'Exploration', 'Fated Mnemos', 'Gear', 'Godform', 'Kratos', 'Map', 'Mnemos', 'Moiros', 'Nymph',
  'Pattern', 'Payload', 'Primordial', 'Sig | Rout', 'Story', 'Technology', 'Terrain', 'Titan',
  'Trait', 'Trait-like', 'Trauma', 'VP'] as const;
export type KnownCardFamily = typeof CARD_FAMILIES[number];
export type DefinitionId = string;
export type FaceId = 'front' | 'back';

/** Rich tokens remain lossless; value and auxiliary fields vary across source families. */
export interface AbilityToken extends JsonObject { type: string }
export interface SourceCard extends JsonObject {
  name: string; renderType: string; cardType: string; game: string; cycle: string;
  cardSize: string; cardIDs: string[];
}
export interface SourcePage {
  cards: SourceCard[]; currentPage: number; totalCards: number; totalPages: number; perPageLimit: number;
}
export type SlotKind = 'support' | 'hand' | 'armor' | 'attachment' | 'mnemos' | 'fated-mnemos';
export interface SlotEligibility { family: 'Gear'; requiredTraits: string[] }
export interface EffectCondition { type: 'gate'; gate: string; value: string | null }
export interface SlotCapacityEffect {
  id: string; type: 'slot-capacity'; slot: SlotKind; amount: number;
  source: { definitionId: DefinitionId; faceId: FaceId; pointer: string; tokens: AbilityToken[] };
  activation: 'automatic' | 'optional-loadout';
  eligibility: SlotEligibility | null;
  conditions: EffectCondition[];
  /** Kept as text: subsequent gameplay consequences need a separate explicit rule. */
  consequences: string[];
}
export type OffensiveStatistics = JsonObject & {
  attackDice?: string; precision?: string; power?: JsonValue[];
};
export interface GearData extends SourceCard {
  slot: string; traits: string[]; abilities: JsonValue[]; gatedAbilities: JsonValue[];
  offensiveStatistics: OffensiveStatistics; defensiveStatistics: JsonValue[];
}
export interface TitanData extends SourceCard {
  titanPower: string; speed: string; abilities: JsonValue[];
  kratosTable: JsonValue[]; traumaTable: JsonValue[];
}
export interface MnemosData extends SourceCard { traits: string[]; abilities: JsonValue[]; stats: string[] }
export interface FatedMnemosData extends SourceCard {
  traits: string[]; stats: string[]; effect: JsonValue; growthAbility: JsonValue; growthName: string;
}
interface FaceBase { id: FaceId; name: string; family: string; printedIds: string[]; cycle: string; game: string; inheritedFields: string[]; slotEffects: SlotCapacityEffect[] }
export interface GearArtwork {
  image: string; grayscaleImage: string; width: number; height: number; artBottom: number;
}
export type CardFace =
  | (FaceBase & { kind: 'gear'; data: GearData; artwork?: GearArtwork })
  | (FaceBase & { kind: 'titan'; data: TitanData })
  | (FaceBase & { kind: 'mnemos'; data: MnemosData })
  | (FaceBase & { kind: 'fated-mnemos'; data: FatedMnemosData })
  | (FaceBase & { kind: 'other'; data: SourceCard });
export interface CardDefinition {
  id: DefinitionId; family: string; printedIds: string[]; faces: CardFace[];
  source: { file: string; page: number; recordIndex: number; pointer: string };
}
export type CatalogueIndex = Record<string, DefinitionId[]>;
export interface Catalogue {
  schemaVersion: 1; catalogueVersion: string; cards: CardDefinition[];
  indexes: { name: CatalogueIndex; printedId: CatalogueIndex; family: CatalogueIndex; cycle: CatalogueIndex; slot: CatalogueIndex };
  provenance: { files: { file: string; sha256: string; records: number; page: number }[]; sourceRecords: number; importerVersion: number };
}

export function parseSourceCard(value: unknown, path: string): SourceCard {
  assert(isRecord(value) && isJsonValue(value), `${path}: expected a JSON card object`);
  for (const field of ['name', 'renderType', 'cardType', 'game', 'cycle', 'cardSize']) {
    assert(typeof value[field] === 'string' && value[field].trim().length > 0, `${path}/${field}: expected nonblank string`);
  }
  assert(Array.isArray(value.cardIDs) && value.cardIDs.every(id => typeof id === 'string'), `${path}/cardIDs: expected string array`);
  return value as SourceCard;
}

export function parseSourcePage(value: unknown, file: string): SourcePage {
  assert(isRecord(value), `${file}: expected page object`);
  const pagination: Record<string, number> = {};
  for (const field of ['currentPage', 'totalCards', 'totalPages', 'perPageLimit']) {
    const raw = value[field];
    const parsed = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
    assert(Number.isSafeInteger(parsed) && (parsed as number) > 0, `${file}/${field}: expected positive integer or decimal integer string`);
    pagination[field] = parsed as number;
  }
  assert(Array.isArray(value.cards), `${file}/cards: expected array`);
  return { cards: value.cards.map((card, index) => parseSourceCard(card, `${file}/cards/${index}`)),
    currentPage: pagination.currentPage, totalCards: pagination.totalCards,
    totalPages: pagination.totalPages, perPageLimit: pagination.perPageLimit };
}

function checkStrings(data: SourceCard, keys: string[], path: string): void {
  for (const key of keys) assert(typeof data[key] === 'string', `${path}/${key}: expected string`);
}
function checkArrays(data: SourceCard, keys: string[], path: string, strings = false): void {
  for (const key of keys) assert(Array.isArray(data[key]) && (!strings || (data[key] as JsonValue[]).every(v => typeof v === 'string')), `${path}/${key}: expected ${strings ? 'string ' : ''}array`);
}

/** Unknown families are kept as 'other' instead of being dropped or guessed. */
export function makeFace(data: SourceCard, id: FaceId, path: string, inheritedFields: string[] = []): CardFace {
  const base: FaceBase = { id, name: data.name, family: data.renderType,
    printedIds: [...new Set(data.cardIDs.map(v => v.trim()).filter(Boolean))].sort(),
    cycle: data.cycle, game: data.game, inheritedFields, slotEffects: [] };
  switch (data.renderType) {
    case 'Gear': {
      checkStrings(data, ['slot'], path); checkArrays(data, ['traits'], path, true);
      checkArrays(data, ['abilities', 'gatedAbilities', 'defensiveStatistics'], path);
      assert(isRecord(data.offensiveStatistics), `${path}/offensiveStatistics: expected object`);
      for (const key of ['attackDice', 'precision']) {
        const v = data.offensiveStatistics[key];
        assert(v === undefined || typeof v === 'string', `${path}/offensiveStatistics/${key}: expected uncoerced string`);
      }
      const power = data.offensiveStatistics.power;
      assert(power === undefined || Array.isArray(power), `${path}/offensiveStatistics/power: expected array`);
      return { ...base, kind: 'gear', data: data as GearData };
    }
    case 'Titan':
      checkStrings(data, ['titanPower', 'speed'], path); checkArrays(data, ['abilities', 'kratosTable', 'traumaTable'], path);
      return { ...base, kind: 'titan', data: data as TitanData };
    case 'Mnemos':
      checkArrays(data, ['traits', 'stats'], path, true); checkArrays(data, ['abilities'], path);
      return { ...base, kind: 'mnemos', data: data as MnemosData };
    case 'Fated Mnemos':
      checkArrays(data, ['traits', 'stats'], path, true); checkStrings(data, ['growthName'], path);
      assert(data.effect !== undefined && data.growthAbility !== undefined, `${path}: missing Fated Mnemos effects`);
      return { ...base, kind: 'fated-mnemos', data: data as FatedMnemosData };
    default: return { ...base, kind: 'other', data };
  }
}
