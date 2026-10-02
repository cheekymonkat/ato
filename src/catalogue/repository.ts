import type { Catalogue, CardDefinition, CardFace } from '../domain/cards.ts';
import { parseCatalogue } from './validate.ts';

function freezeDefinitionData(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.values(value).forEach(freezeDefinitionData);
  Object.freeze(value);
}

export interface CatalogueSearch { query?: string; family?: string; cycle?: string; slot?: string }
export type ReferenceResolution = { status: 'resolved'; card: CardDefinition } | { status: 'ambiguous'; cards: CardDefinition[] } | { status: 'missing'; printedId: string };

/** No network or platform imports. Instances and player state never modify this data. */
export function createCatalogueRepository(input: unknown) {
  const catalogue: Catalogue = parseCatalogue(input);
  freezeDefinitionData(catalogue);
  const byId = new Map(catalogue.cards.map(card => [card.id, card]));
  const aliases = new Map<string, CardDefinition[]>();
  for (const card of catalogue.cards) for (const alias of card.printedIds) {
    const key = alias.toUpperCase();
    if (!aliases.has(key)) aliases.set(key, []);
    if (!aliases.get(key)!.includes(card)) aliases.get(key)!.push(card);
  }
  const names = new Map(Object.entries(catalogue.indexes.name));
  const searchText = new Map(catalogue.cards.map(card => [card.id, [...card.faces.map(face => face.name), ...card.printedIds].join(' ').toLowerCase()]));
  function byPrintedId(printedId: string): CardDefinition[] { return [...(aliases.get(printedId.trim().toUpperCase()) || [])]; }
  return {
    version: catalogue.catalogueVersion,
    count: catalogue.cards.length,
    get: (id: string): CardDefinition | undefined => byId.get(id),
    getFace: (id: string, faceId: string): CardFace | undefined => byId.get(id)?.faces.find(face => face.id === faceId),
    byPrintedId,
    byName: (name: string): CardDefinition[] => (names.get(name.trim().toLowerCase()) || []).map(id => byId.get(id)!),
    resolveReference: (printedId: string): ReferenceResolution => {
      const cards = byPrintedId(printedId);
      return cards.length === 1 ? { status: 'resolved', card: cards[0] } : cards.length ? { status: 'ambiguous', cards } : { status: 'missing', printedId };
    },
    search: ({ query = '', family, cycle, slot }: CatalogueSearch = {}): CardDefinition[] => {
      const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      return catalogue.cards.filter(card => terms.every(term => searchText.get(card.id)!.includes(term)) &&
        card.faces.some(face => (!family || face.family === family) && (!cycle || face.cycle === cycle) && (!slot || (face.kind === 'gear' && face.data.slot === slot))))
        .sort((a, b) => a.faces[0].name.localeCompare(b.faces[0].name) || a.id.localeCompare(b.id));
    },
  };
}
export type CatalogueRepository = ReturnType<typeof createCatalogueRepository>;
