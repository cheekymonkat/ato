import type { CardDefinition, CardFace } from './cards.ts';
import type { CampaignCycle } from './campaign.ts';
import { CAMPAIGN_CYCLES, isFaceAvailableInCycle } from './campaign.ts';
import type { CardReference, Party } from './party.ts';
import type { CatalogueRepository } from '../catalogue/repository.ts';

export function isDreamwalker(face: CardFace | undefined): boolean {
  return face?.kind === 'titan' && /\bDreamwalker\b/i.test(String(face.data.subtitle ?? face.name));
}
/** Count assigned Titans across the party, including exhausted/discarded selections. */
export function argoBredArgonauts(party: Pick<Party, 'argonauts'>, catalogue: Pick<CatalogueRepository, 'getFace'>) {
  return party.argonauts.filter(argonaut => {
    const face = argonaut.titan && catalogue.getFace(argonaut.titan.definitionId, argonaut.titan.faceId);
    return face?.kind === 'titan' && !isDreamwalker(face);
  });
}
/** One of each printed Argo-bred type across the party; Dreamwalker variants never conflict.
 * Full names distinguish e.g. Truthbearer from Immortal Truthbearer. Catalogue copies
 * of the same named type share the limit even if their definition IDs differ.
 */
export function argoBredConflicts(party: Pick<Party, 'argonauts'>, catalogue: Pick<CatalogueRepository, 'getFace'>) {
  const groups = new Map<string, { name: string; argonauts: Party['argonauts'] }>();
  for (const argonaut of argoBredArgonauts(party, catalogue)) {
    const face = catalogue.getFace(argonaut.titan!.definitionId, argonaut.titan!.faceId)!;
    const name = face.name.trim().replace(/\s+/g, ' ');
    const key = name.normalize('NFKC').toLowerCase() || argonaut.titan!.definitionId;
    const group = groups.get(key);
    if (group) group.argonauts.push(argonaut);
    else groups.set(key, { name: name || argonaut.titan!.definitionId, argonauts: [argonaut] });
  }
  return [...groups.values()].filter(group => group.argonauts.length > 1);
}
export function titanDisplayName(face: CardFace): string {
  return isDreamwalker(face) ? 'Dreamwalker' : face.name;
}
/** Dashboard selection exposes the printed cycle subtype, while named copies still share one choice. */
export function titanVariantDisplayName(face: CardFace): string {
  return isDreamwalker(face) ? String(face.data.subtitle || 'Dreamwalker') : face.name;
}
const titanFace = (card: CardDefinition) => card.faces.find(face => face.kind === 'titan');

/** Named copies share rules within a cycle; keep real references for saved data and tables. */
export function dreamwalkerVariants(cards: CardDefinition[], cycle: CampaignCycle, preferred?: CardReference | null): CardDefinition[] {
  const eligible = cards.filter(card => {
    const face = titanFace(card);
    return isDreamwalker(face) && isFaceAvailableInCycle(face, cycle);
  }).sort((a, b) => a.id.localeCompare(b.id));
  return CAMPAIGN_CYCLES.flatMap(printedCycle => {
    if (printedCycle > cycle) return [];
    const copies = eligible.filter(card => {
      const face = titanFace(card);
      return isFaceAvailableInCycle(face, printedCycle) && (printedCycle === 1 || !isFaceAvailableInCycle(face, (printedCycle - 1) as CampaignCycle));
    });
    const copy = copies.find(card => card.id === preferred?.definitionId) ?? copies[0];
    return copy ? [copy] : [];
  });
}

/** One Dreamwalker result, searchable by its common name, original names and printed IDs. */
export function titanSelectionCards(cards: CardDefinition[], cycle: CampaignCycle, query = '', preferred?: CardReference | null): CardDefinition[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = cards.filter(card => card.faces.some(face => face.kind === 'titan' && isFaceAvailableInCycle(face, cycle)) &&
    terms.every(term => [...card.faces.flatMap(face => [face.name, titanDisplayName(face), String(face.data.subtitle ?? '')]), ...card.printedIds].join(' ').toLowerCase().includes(term)));
  const variants = dreamwalkerVariants(matches, cycle, preferred);
  const dreamwalker = variants.find(card => card.id === preferred?.definitionId) ?? variants.at(-1);
  return [...matches.filter(card => !isDreamwalker(titanFace(card))), ...(dreamwalker ? [dreamwalker] : [])]
    .sort((a, b) => titanDisplayName(titanFace(a)!).localeCompare(titanDisplayName(titanFace(b)!)) || a.id.localeCompare(b.id));
}

export function titanOptionCards(cards: CardDefinition[], cycle: CampaignCycle, preferred?: CardReference | null): CardDefinition[] {
  return [...titanSelectionCards(cards, cycle, '', preferred).filter(card => !isDreamwalker(titanFace(card))), ...dreamwalkerVariants(cards, cycle, preferred)]
    .sort((a, b) => titanVariantDisplayName(titanFace(a)!).localeCompare(titanVariantDisplayName(titanFace(b)!)) || a.id.localeCompare(b.id));
}
