import type { CardFace } from './cards.ts';
import type { Argonaut, CardReference, ConditionRecord } from './party.ts';
import { isRecord } from './json.ts';
import type { JsonObject } from './json.ts';
import type { CatalogueRepository } from '../catalogue/repository.ts';

export function supportsCondition(face: CardFace | null | undefined): boolean {
  return Boolean(face && (face.family === 'Condition' || face.family === 'Trauma' && face.data.isCondition));
}
/** Keep the printed rich-text blocks, including conditions stored as side.effect. */
export function conditionEffects(face: CardFace) {
  return isRecord(face.data.side) ? face.data.side.effect : face.data.effects;
}
/** Condition side sections stay separate so named abilities and aftermath are not lost. */
export function conditionSections(face: CardFace) {
  const side = isRecord(face.data.side) ? face.data.side : {};
  const aftermath = side.endOfBattle ? [{ abilityText: [
    { type: 'timing', value: 'End of Battle' }, { type: 'whitespace', value: ' ' }, { type: 'plainText', value: side.endOfBattle },
  ] }] : [];
  return { effect: conditionEffects(face), abilities: Array.isArray(side.abilities) ? side.abilities.filter((ability): ability is JsonObject => isRecord(ability)) : [], endOfBattle: side.endOfBattle, aftermath };
}
export function conditionReverse(reference: CardReference, catalogue: CatalogueRepository): CardFace | undefined {
  if (!supportsCondition(catalogue.getFace(reference.definitionId, reference.faceId))) return;
  return catalogue.get(reference.definitionId)?.faces.find(face => face.id !== reference.faceId && supportsCondition(face));
}
/** Legacy strings stay readable/editable without silently rewriting an old save. */
export function conditionRecords(argonaut: Argonaut): ConditionRecord[] {
  return [...(argonaut.conditions ?? []), ...argonaut.localConditions.map((name, index) => ({
    id: `legacy:${index}:${name}`, name, reference: null, source: '', duration: '', amount: 1,
  }))];
}
/** Roused changes Kratos Table Rage only; it never changes the saved counter. */
export function kratosRageBonus(argonaut: Argonaut, catalogue: CatalogueRepository): number {
  return conditionRecords(argonaut).some(condition => {
    const name = condition.reference
      ? catalogue.getFace(condition.reference.definitionId, condition.reference.faceId)?.name
      : condition.name;
    return name !== undefined && ['roused', 'rouse'].includes(normalizedName(name));
  }) ? 1 : 0;
}
export function validCondition(value: unknown): value is ConditionRecord {
  if (!isRecord(value)) return false;
  const text = (field: string, max: number) => typeof value[field] === 'string' && (value[field] as string).length <= max;
  const reference = value.reference;
  return text('id', 250) && Boolean((value.id as string).trim()) && text('name', 120) && Boolean((value.name as string).trim())
    && text('source', 500) && text('duration', 250) && value.amount === 1
    && (reference === null || isRecord(reference) && typeof reference.definitionId === 'string' && Boolean(reference.definitionId.trim())
      && (reference.faceId === 'front' || reference.faceId === 'back'));
}
const normalizedName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
/** Both printed sides, alternate editions and matching custom labels share a type. */
export function conditionConflict(records: readonly ConditionRecord[], condition: ConditionRecord, catalogue?: CatalogueRepository): ConditionRecord | undefined {
  const names = (record: ConditionRecord) => {
    const card = record.reference && catalogue?.get(record.reference.definitionId);
    const aliases = card ? [card] : catalogue?.byName(record.name).filter(card => card.faces.some(supportsCondition)) ?? [];
    return (aliases.length ? aliases.flatMap(card => card.faces.filter(supportsCondition).map(face => face.name)) : [record.name]).map(normalizedName);
  };
  const candidateNames = names(condition);
  return records.find(record => record.id !== condition.id &&
    (Boolean(record.reference && condition.reference && record.reference.definitionId === condition.reference.definitionId)
      || names(record).some(name => candidateNames.includes(name))));
}
export function validConditionRecords(value: unknown): value is ConditionRecord[] {
  if (!Array.isArray(value) || !value.every(validCondition)) return false;
  const records: ConditionRecord[] = value;
  return new Set(records.map(record => record.id)).size === records.length
    && records.every(record => !conditionConflict(records, record));
}
export function setCondition(argonaut: Argonaut, condition: ConditionRecord, catalogue?: CatalogueRepository): Argonaut {
  if (!validCondition(condition) || conditionConflict(conditionRecords(argonaut), condition, catalogue)) return argonaut;
  const records = argonaut.conditions ?? [], exists = records.some(record => record.id === condition.id);
  return { ...argonaut, localConditions: argonaut.localConditions.filter((name, index) => `legacy:${index}:${name}` !== condition.id),
    conditions: exists ? records.map(record => record.id === condition.id ? condition : record) : [...records, condition] };
}
export function removeCondition(argonaut: Argonaut, id: string): Argonaut {
  const records = conditionRecords(argonaut);
  return records.some(record => record.id === id) ? { ...argonaut,
    localConditions: argonaut.localConditions.filter((name, index) => `legacy:${index}:${name}` !== id),
    conditions: (argonaut.conditions ?? []).filter(record => record.id !== id) } : argonaut;
}
