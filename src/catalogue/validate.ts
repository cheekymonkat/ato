import type { Catalogue, CardDefinition, CardFace, SlotCapacityEffect } from '../domain/cards.ts';
import { makeFace, parseSourceCard } from '../domain/cards.ts';
import { assert, isRecord, isJsonValue } from '../domain/json.ts';
import { buildIndexes } from './normalize.ts';
import { deriveTechnologyRules } from '../domain/technology-rules.ts';
import { deriveMilestoneRules } from '../domain/milestone-rules.ts';
import { deriveInwardOdysseyRules } from '../domain/inward-odyssey.ts';

function validateEffect(value: unknown, card: CardDefinition, face: CardFace): asserts value is SlotCapacityEffect {
  assert(isRecord(value) && value.type === 'slot-capacity' && typeof value.id === 'string' && value.id.trim(), 'Invalid slot effect');
  assert(['support', 'hand', 'armor', 'attachment', 'mnemos', 'fated-mnemos'].includes(value.slot as string), 'Invalid effect slot');
  assert(Number.isSafeInteger(value.amount) && (value.amount as number) > 0, 'Invalid capacity amount');
  assert(value.activation === 'automatic' || value.activation === 'optional-loadout', 'Invalid capacity activation');
  assert(isRecord(value.source) && value.source.definitionId === card.id && value.source.faceId === face.id && typeof value.source.pointer === 'string' && value.source.pointer.startsWith(card.source.pointer + '/'), 'Invalid effect provenance');
  assert(Array.isArray(value.source.tokens) && value.source.tokens.every(t => isRecord(t) && typeof t.type === 'string'), 'Invalid effect tokens');
  assert(Array.isArray(value.conditions) && value.conditions.every(c => isRecord(c) && c.type === 'gate' && typeof c.gate === 'string' && (c.value === null || typeof c.value === 'string')), 'Invalid effect conditions');
  assert(Array.isArray(value.consequences) && value.consequences.every(c => typeof c === 'string'), 'Invalid effect consequences');
  assert(value.eligibility === null || (isRecord(value.eligibility) && value.eligibility.family === 'Gear' && Array.isArray(value.eligibility.requiredTraits) && value.eligibility.requiredTraits.every(v => typeof v === 'string' && v.trim())), 'Invalid slot eligibility');
  if (isRecord(value.eligibility) && value.eligibility.forbiddenWeaponHands !== undefined) assert(Array.isArray(value.eligibility.forbiddenWeaponHands) && value.eligibility.forbiddenWeaponHands.every(n => Number.isSafeInteger(n) && n > 0), 'Invalid weapon hand restriction');
}

/** A shared validation boundary for generated files and future catalogue updates. */
export function parseCatalogue(value: unknown): Catalogue {
  assert(isRecord(value), 'Expected a single catalogue object; arrays of catalogue versions are not supported');
  assert(value.schemaVersion === 1, 'Unsupported catalogue schema');
  assert(isJsonValue(value), 'Catalogue contains non-JSON values');
  assert(typeof value.catalogueVersion === 'string' && value.catalogueVersion.trim(), 'Missing catalogue version');
  assert(Array.isArray(value.cards) && isRecord(value.indexes) && isRecord(value.provenance), 'Malformed catalogue');
  const ids = new Set<string>();
  for (const candidate of value.cards) {
    assert(isRecord(candidate) && typeof candidate.id === 'string' && candidate.id.trim() && !ids.has(candidate.id), 'Invalid or repeated definition ID');
    ids.add(candidate.id);
    assert(isRecord(candidate.source) && typeof candidate.source.file === 'string' && Number.isSafeInteger(candidate.source.recordIndex) && (candidate.source.recordIndex as number) >= 0 && Number.isSafeInteger(candidate.source.page) && (candidate.source.page as number) > 0 && candidate.source.pointer === `/cards/${candidate.source.recordIndex}`, 'Invalid source location');
    assert(typeof candidate.family === 'string' && Array.isArray(candidate.printedIds) && candidate.printedIds.every(v => typeof v === 'string' && v.trim()), 'Invalid card aliases/family');
    assert(Array.isArray(candidate.faces) && candidate.faces.length >= 1 && candidate.faces.length <= 2, 'Invalid card faces');
    const faceIds = new Set<string>(), aliases = new Set<string>();
    for (const faceValue of candidate.faces) {
      assert(isRecord(faceValue) && (faceValue.id === 'front' || faceValue.id === 'back') && !faceIds.has(faceValue.id), 'Invalid or repeated face');
      faceIds.add(faceValue.id);
      const validated = makeFace(parseSourceCard(faceValue.data, candidate.id), faceValue.id, candidate.id);
      // Older catalogue snapshots have no derived rules; current imports must agree with their printed abilities.
      if (faceValue.weaponRules !== undefined) assert(validated.kind === 'titan' && JSON.stringify(faceValue.weaponRules) === JSON.stringify(validated.weaponRules), 'Inconsistent Titan weapon rules');
      if (faceValue.artwork !== undefined) {
        const art = faceValue.artwork;
        assert(validated.kind === 'gear' && isRecord(art) && typeof art.image === 'string' && typeof art.grayscaleImage === 'string'
          && /^assets\/gear-art\/[a-z0-9/-]+\.png$/.test(art.image) && /^assets\/gear-art\/[a-z0-9/-]+\.png$/.test(art.grayscaleImage)
          && Number.isSafeInteger(art.width) && (art.width as number) > 0 && Number.isSafeInteger(art.height) && (art.height as number) > 0
          && Number.isSafeInteger(art.artBottom) && (art.artBottom as number) > 0 && (art.artBottom as number) <= (art.height as number), 'Invalid Gear artwork');
      }
      assert(Array.isArray(faceValue.inheritedFields) && faceValue.inheritedFields.every(k => typeof k === 'string' && ['cardIDs', 'renderType', 'cardType', 'game', 'cycle', 'cardSize'].includes(k)) && (faceValue.id === 'back' || faceValue.inheritedFields.length === 0), 'Invalid inherited metadata');
      for (const key of ['kind', 'name', 'family', 'cycle', 'game'] as const) assert(faceValue[key] === validated[key], `Inconsistent face ${key}`);
      assert(JSON.stringify(faceValue.printedIds) === JSON.stringify(validated.printedIds), 'Inconsistent face aliases');
      validated.printedIds.forEach(alias => aliases.add(alias));
      assert(Array.isArray(faceValue.slotEffects), 'Missing slot effects');
      const effectIds = new Set<string>();
      for (const effect of faceValue.slotEffects) {
        validateEffect(effect, candidate as unknown as CardDefinition, validated);
        assert(!effectIds.has(effect.id), 'Repeated effect ID'); effectIds.add(effect.id);
      }
    }
    assert(faceIds.has('front') && candidate.family === (candidate.faces[0] as Record<string, unknown>).family, 'Missing front or inconsistent family');
    assert(JSON.stringify(candidate.printedIds) === JSON.stringify([...aliases].sort()), 'Inconsistent definition aliases');
    if (candidate.technologyRules !== undefined) assert(candidate.family === 'Technology' &&
      JSON.stringify(candidate.technologyRules) === JSON.stringify(deriveTechnologyRules(candidate as unknown as CardDefinition)), 'Inconsistent technology rules');
    if (candidate.milestoneRules !== undefined) assert(['Story', 'Doom'].includes(candidate.family as string) &&
      JSON.stringify(candidate.milestoneRules) === JSON.stringify(deriveMilestoneRules(candidate as unknown as CardDefinition)), 'Inconsistent milestone rules');
    if (candidate.inwardOdysseyRules !== undefined) assert(candidate.family === 'Story' &&
      JSON.stringify(candidate.inwardOdysseyRules) === JSON.stringify(deriveInwardOdysseyRules(candidate as unknown as CardDefinition)), 'Inconsistent Inward Odyssey rules');
  }
  const catalogue = value as unknown as Catalogue;
  const expected = buildIndexes(catalogue.cards);
  for (const facet of ['name', 'printedId', 'family', 'cycle', 'slot'] as const) {
    const actual = catalogue.indexes[facet];
    assert(isRecord(actual) && Object.keys(actual).length === Object.keys(expected[facet]).length, `Invalid ${facet} index`);
    for (const [key, definitions] of Object.entries(expected[facet])) assert(Object.hasOwn(actual, key) && JSON.stringify(actual[key]) === JSON.stringify(definitions), `Inconsistent ${facet} index: ${key}`);
  }
  assert(catalogue.provenance.sourceRecords === catalogue.cards.length && [1, 2].includes(catalogue.provenance.importerVersion) && Array.isArray(catalogue.provenance.files), 'Invalid catalogue provenance');
  let sourceRecords = 0;
  const fileNames = new Set<string>();
  for (const file of catalogue.provenance.files) {
    assert(isRecord(file) && typeof file.file === 'string' && !fileNames.has(file.file) && typeof file.sha256 === 'string' && /^[0-9a-f]{64}$/.test(file.sha256) && Number.isSafeInteger(file.records) && file.records >= 0 && Number.isSafeInteger(file.page) && file.page > 0, 'Invalid source file provenance');
    fileNames.add(file.file); sourceRecords += file.records;
    assert(catalogue.cards.filter(c => c.source.file === file.file).length === file.records, 'Source record count mismatch');
  }
  assert(sourceRecords === catalogue.cards.length && catalogue.cards.every(c => fileNames.has(c.source.file)), 'Incomplete source provenance');
  return catalogue;
}
