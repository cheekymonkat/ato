import type { CardDefinition, Catalogue, CatalogueIndex, SourceCard, SourcePage } from '../domain/cards.ts';
import { CARD_FAMILIES, makeFace, parseSourceCard } from '../domain/cards.ts';
import { escapePointer, visitJson } from '../domain/json.ts';
import type { JsonObject } from '../domain/json.ts';
import { extractSlotEffects } from './effects.ts';
import { gearArtwork } from './gear-art.ts';

export interface SourceInput { file: string; sha256: string; page: SourcePage }
export interface QualityIssue { category: string; definitionId: string; file: string; pointer: string; message: string }
export interface ReferenceRecord { definitionId: string; file: string; pointer: string; printedId: string; targets: string[] }
export interface QualityReport {
  sourceRecords: number; definitions: number; faces: number; deduplicatedRecords: 0;
  familyCounts: Record<string, number>; issues: QualityIssue[];
  repeatedAliases: { printedId: string; definitionIds: string[] }[];
  references: ReferenceRecord[];
}
export function splitFaces(card: SourceCard): { data: SourceCard; id: 'front' | 'back'; inheritedFields: string[] }[] {
  // effects2 on a single-face Exploration card is not a reverse face.
  if (typeof card.name2 !== 'string' || !card.name2.trim()) return [{ data: card, id: 'front', inheritedFields: [] }];
  const front: JsonObject = {}, back: JsonObject = {};
  for (const [key, value] of Object.entries(card)) {
    if (key.endsWith('2')) back[key.slice(0, -1)] = value;
    else front[key] = value;
  }
  const inheritedFields: string[] = [];
  for (const field of ['cardIDs', 'renderType', 'cardType', 'game', 'cycle', 'cardSize']) {
    if (!Object.hasOwn(back, field)) { back[field] = front[field]; inheritedFields.push(field); }
  }
  return [{ data: parseSourceCard(front, `${card.name}/front`), id: 'front', inheritedFields: [] },
    { data: parseSourceCard(back, `${card.name}/back`), id: 'back', inheritedFields }];
}

export function aliasesFor(card: SourceCard): string[] {
  return [...new Set(splitFaces(card).flatMap(f => f.data.cardIDs).map(v => v.trim()).filter(Boolean))].sort();
}

function add(index: CatalogueIndex, key: string, id: string): void {
  // Prevent prototype keys such as __proto__ from becoming object mutations.
  if (!Object.hasOwn(index, key)) Object.defineProperty(index, key, { value: [], enumerable: true, writable: true });
  if (!index[key].includes(id)) index[key].push(id);
}

export function buildIndexes(cards: CardDefinition[]): Catalogue['indexes'] {
  const indexes: Catalogue['indexes'] = { name: {}, printedId: {}, family: {}, cycle: {}, slot: {} };
  for (const card of cards) {
    card.printedIds.forEach(alias => add(indexes.printedId, alias, card.id));
    for (const face of card.faces) {
      add(indexes.name, face.name.toLowerCase(), card.id); add(indexes.family, face.family, card.id);
      add(indexes.cycle, face.cycle, card.id);
      if (face.kind === 'gear') add(indexes.slot, face.data.slot, card.id);
    }
  }
  return indexes;
}

export function normalizeCatalogue(inputs: SourceInput[], resolveId: (card: SourceCard) => string, catalogueVersion: string): { catalogue: Catalogue; report: QualityReport; sourceMap: (CardDefinition['source'] & { definitionId: string })[] } {
  const cards: CardDefinition[] = [], ids = new Set<string>();
  const report: QualityReport = { sourceRecords: 0, definitions: 0, faces: 0, deduplicatedRecords: 0,
    familyCounts: {}, issues: [], repeatedAliases: [], references: [] };
  for (const input of inputs) for (const [recordIndex, source] of input.page.cards.entries()) {
    const id = resolveId(source);
    if (!id || ids.has(id)) throw new Error(`Identity collision at ${input.file}/cards/${recordIndex}: ${id}. Provide a distinct registry identity; records cannot be merged implicitly.`);
    ids.add(id);
    const card: CardDefinition = { id, family: source.renderType, printedIds: aliasesFor(source),
      source: { file: input.file, page: input.page.currentPage, recordIndex, pointer: `/cards/${recordIndex}` },
      faces: splitFaces(source).map(f => {
        const face = makeFace(f.data, f.id, `${input.file}/cards/${recordIndex}/${f.id}`, f.inheritedFields);
        const artwork = face.kind === 'gear' ? gearArtwork[id]?.[f.id] : undefined;
        return artwork ? { ...face, artwork } : face;
      }) };
    const issue = (category: string, pointer: string, message: string): void => { report.issues.push({ category, definitionId: id, file: input.file, pointer, message }); };
    if (card.printedIds.length === 0) issue('missing-printed-id', card.source.pointer, 'Kept with a registry-backed unprinted identity.');
    const rawAliases = splitFaces(source).flatMap(f => f.data.cardIDs);
    if (source.cardIDs.filter(Boolean).length !== new Set(source.cardIDs.filter(Boolean)).size) issue('repeated-alias-in-record', `${card.source.pointer}/cardIDs`, 'Repeated aliases indexed once; original export retained.');
    if (rawAliases.some(v => v !== v.trim())) issue('alias-whitespace', card.source.pointer, 'Trimmed lookup alias; original export retained.');
    for (const face of card.faces) {
      if (face.inheritedFields.length) issue('inherited-face-metadata', `${card.source.pointer}/name2`, `Back face shares missing metadata from front: ${face.inheritedFields.join(', ')}. Inheritance is recorded explicitly.`);
      const sourcePointer = (p: string): string => {
        const parts = p.split('/');
        if (face.id === 'back' && parts.length > 1) parts[1] += '2';
        return card.source.pointer + parts.join('/');
      };
      if (!(CARD_FAMILIES as readonly string[]).includes(face.family)) issue('unknown-family', sourcePointer('/renderType'), `Retained unsupported family ${face.family}.`);
      const extracted = extractSlotEffects(face, card.id);
      face.slotEffects = extracted.effects.map(effect => ({ ...effect, source: { ...effect.source, pointer: sourcePointer(effect.source.pointer) } }));
      extracted.diagnostics.forEach(d => issue('unsupported-slot-effect', sourcePointer(d.pointer), d.message));
    }
    visitJson(source, (object, pointer) => {
      if (Object.hasOwn(object, 'abilityText') && !Array.isArray(object.abilityText)) issue('unsupported-ability-shape', card.source.pointer + pointer, 'abilityText is not an array; retained without interpretation.');
      if (Array.isArray(object.abilityText)) object.abilityText.forEach((token, index) => {
        if (!token || typeof token !== 'object' || Array.isArray(token) || typeof token.type !== 'string') issue('unsupported-token-shape', `${card.source.pointer}${pointer}/abilityText/${index}`, 'Token has no string type; retained without interpretation.');
      });
      if (Object.hasOwn(object, 'refID')) {
        if (typeof object.refID === 'string' && object.refID.trim()) report.references.push({ definitionId: id, file: input.file,
          pointer: `${card.source.pointer}${pointer}/${escapePointer('refID')}`, printedId: object.refID.trim(), targets: [] });
        else issue('unsupported-reference-shape', `${card.source.pointer}${pointer}/refID`, 'Reference ID is blank or not a string.');
      }
    });
    report.familyCounts[card.family] = (report.familyCounts[card.family] || 0) + 1;
    cards.push(card);
  }
  // Output ordering also remains stable if acquisition page order changes.
  cards.sort((a, b) => a.id.localeCompare(b.id));
  const indexes = buildIndexes(cards);
  for (const reference of report.references) {
    reference.targets = Object.hasOwn(indexes.printedId, reference.printedId) ? indexes.printedId[reference.printedId] : [];
    if (reference.targets.length !== 1) report.issues.push({ category: reference.targets.length ? 'ambiguous-reference' : 'unresolved-reference',
      definitionId: reference.definitionId, file: reference.file, pointer: reference.pointer,
      message: `${reference.printedId}: ${reference.targets.length} matching definitions; do not choose one silently.` });
  }
  report.repeatedAliases = Object.entries(indexes.printedId).filter(([, values]) => values.length > 1).map(([printedId, definitionIds]) => ({ printedId, definitionIds }));
  report.sourceRecords = cards.length; report.definitions = cards.length; report.faces = cards.reduce((sum, c) => sum + c.faces.length, 0);
  const catalogue: Catalogue = { schemaVersion: 1, catalogueVersion, cards, indexes,
    provenance: { importerVersion: 2, sourceRecords: cards.length, files: inputs.map(input => ({ file: input.file, sha256: input.sha256, records: input.page.cards.length, page: input.page.currentPage })) } };
  return { catalogue, report, sourceMap: cards.map(card => ({ definitionId: card.id, ...card.source })) };
}
