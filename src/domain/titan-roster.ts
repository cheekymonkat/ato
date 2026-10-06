import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { CardDefinition, CardFace } from './cards.ts';
import { campaignCycle, isFaceAvailableInCycle } from './campaign.ts';
import type { CampaignCycle } from './campaign.ts';
import type { CardReference, Party, TitanRecord, TitanStatus } from './party.ts';
import { TITAN_NAME_LIMIT } from './party.ts';
import { supportsPattern } from './references.ts';
import { isDreamwalker, titanVariantDisplayName, dreamwalkerVariants } from './titan-selection.ts';
import { technologyLimit } from './technologies.ts';

export const TITAN_STATUSES = ['alive', 'crippled', 'dead'] as const;
export const TITAN_STARTS: Record<CampaignCycle, { dreamwalkers: number; bred: string[] }> = {
  1: { dreamwalkers: 10, bred: [] },
  2: { dreamwalkers: 7, bred: ['Mazerunner', 'Earthshaker', 'Logicbreaker'] },
  3: { dreamwalkers: 4, bred: ['Abysswatcher', 'Earthshaker', 'Firestarter', 'Mazerunner', 'Warkeeper'] },
  4: { dreamwalkers: 1, bred: ['Warkeeper', 'Returner', 'Mazerunner', 'Logicbreaker', 'Firestarter', 'Earthshaker', 'Dawnburner', 'Ascender', 'Abysswatcher'] },
  5: { dreamwalkers: 0, bred: ['Abysswatcher', 'Ascender', 'Cloudsoarer', 'Dawnburner', 'Earthshaker', 'Firestarter', 'Logicbreaker', 'Lunarlander', 'Mazerunner', 'Returner', 'Warkeeper', 'Wishender'] },
};
export const emptyTitanPatterns = (): TitanRecord['patterns'] => ({ trauma: null, kratos: null });
export const sameReference = (a: CardReference | null, b: CardReference | null) => a?.definitionId === b?.definitionId && a?.faceId === b?.faceId;
export const titanCapacity = (party: Party, catalogue: CatalogueRepository) => technologyLimit(party, catalogue, 'titans') ?? 10;
export const livingTitanCount = (records: readonly TitanRecord[]) => records.filter(titan => titan.status !== 'dead').length;
export const titanStatusLabel = (status: TitanStatus) => status === 'crippled' ? 'Crippled' : status === 'alive' ? 'Alive' : 'Dead';
export function cycleDreamwalker(cycle: CampaignCycle, catalogue: CatalogueRepository): CardDefinition | undefined {
  const cards = catalogue.search({ family: 'Titan' });
  // Prefer Solon, whose artwork represents the shared Dreamwalker type.
  const copy = cards.find(card => isDreamwalker(card.faces[0]) && card.faces[0].name === 'Solon'
    && isFaceAvailableInCycle(card.faces[0], cycle) && (cycle === 1 || !isFaceAvailableInCycle(card.faces[0], (cycle - 1) as CampaignCycle)));
  return copy ?? dreamwalkerVariants(cards, cycle).at(-1);
}
export function rosterTitanType(titan: CardReference, catalogue: CatalogueRepository): string {
  const face = catalogue.getFace(titan.definitionId, titan.faceId);
  return face ? titanVariantDisplayName(face) : 'Unavailable Titan';
}
export function rosterTitanName(titan: CardReference & { name?: string }, catalogue: CatalogueRepository): string {
  return titan.name?.trim() || rosterTitanType(titan, catalogue);
}
/** Default names follow subtype changes rather than becoming fixed custom names. */
function normalizeTitanName(titan: TitanRecord, catalogue: CatalogueRepository): TitanRecord {
  const { name, ...record } = titan, custom = name?.trim();
  return custom && custom !== rosterTitanType(titan, catalogue) ? { ...record, name: custom } : record;
}
export function sortRoster(records: readonly TitanRecord[], catalogue: CatalogueRepository): TitanRecord[] {
  return [...records].sort((a, b) => Number(isDreamwalker(catalogue.getFace(a.definitionId, a.faceId))) - Number(isDreamwalker(catalogue.getFace(b.definitionId, b.faceId)))
    || rosterTitanType(a, catalogue).localeCompare(rosterTitanType(b, catalogue))
    || rosterTitanName(a, catalogue).localeCompare(rosterTitanName(b, catalogue)) || a.id.localeCompare(b.id, undefined, { numeric: true }));
}
const record = (id: string, card: CardDefinition): TitanRecord => ({ id, definitionId: card.id, faceId: card.faces[0].id, status: 'alive', patterns: emptyTitanPatterns() });
/** New campaigns use explicit starting rosters; printed Titan cards define types, not headcounts. */
export function initializeTitanRoster(party: Party, catalogue: CatalogueRepository): Party {
  const cycle = campaignCycle(party), start = TITAN_STARTS[cycle], titans: TitanRecord[] = [];
  for (const name of start.bred) {
    const card = catalogue.byName(name).find(card => card.family === 'Titan' && isFaceAvailableInCycle(card.faces[0], cycle));
    if (card) titans.push(record(`start:${cycle}:${name.toLowerCase()}`, card));
  }
  const dreamwalker = cycleDreamwalker(cycle, catalogue);
  if (dreamwalker) for (let i = 0; i < start.dreamwalkers; i++) titans.push(record(`start:${cycle}:dreamwalker:${i + 1}`, dreamwalker));
  return { ...party, titanRoster: { version: 1, titans } };
}
/** Old saves are converted without replacing selected Titans or their overrides. */
export function legacyTitanRoster(party: Party, catalogue: CatalogueRepository): TitanRecord[] {
  if (party.titanRoster) return party.titanRoster.titans;
  const titans: TitanRecord[] = party.argonauts.flatMap(member => member.titan ? [{ id: `legacy:${member.id}`, definitionId: member.titan.definitionId,
    faceId: member.titan.faceId, status: 'alive' as const, patterns: member.tableOverrides }] : []);
  for (const id of party.inventory?.titans ?? []) {
    const card = catalogue.get(id);
    if (card?.family === 'Titan' && !titans.some(titan => titan.definitionId === id)) titans.push(record(`legacy:${id}`, card));
  }
  return titans;
}
export function materializeTitanRoster(party: Party, catalogue: CatalogueRepository): Party {
  if (party.titanRoster) return party;
  const titans = legacyTitanRoster(party, catalogue);
  const argonauts = party.argonauts.map(member => member.titan
    ? { ...member, titan: { ...member.titan, rosterId: `legacy:${member.id}` } } : member);
  return { ...party, titanRoster: { version: 1, titans }, argonauts: argonauts.every((member, i) => member === party.argonauts[i]) ? party.argonauts : argonauts };
}
/** One Alive/Crippled individual per printed Argo-bred type, including named catalogue copies. */
export function rosterTypeIssue(party: Party, titanId: string, reference: CardReference, catalogue: CatalogueRepository): string | undefined {
  const face = catalogue.getFace(reference.definitionId, reference.faceId);
  if (face?.kind !== 'titan' || isDreamwalker(face)) return undefined;
  const type = (face: CardFace) => face.name.trim().replace(/\s+/g, ' ').normalize('NFKC').toLowerCase();
  const duplicate = legacyTitanRoster(party, catalogue).some(titan => {
    if (titan.id === titanId || titan.status === 'dead') return false;
    const other = catalogue.getFace(titan.definitionId, titan.faceId);
    return other?.kind === 'titan' && !isDreamwalker(other) && type(other) === type(face);
  });
  return duplicate ? `An Alive or Crippled ${face.name} is already in the roster.` : undefined;
}
/** Dead records remain in the history and retain their physical Pattern allocations. */
export function patternCopies(card: CardDefinition): number { return Math.max(1, new Set(card.printedIds).size); }
export function patternIssue(party: Party, titanId: string, patterns: TitanRecord['patterns'], catalogue: CatalogueRepository): string | undefined {
  const cycle = campaignCycle(party);
  for (const key of ['trauma', 'kratos'] as const) {
    const ref = patterns[key];
    if (!ref) continue;
    const face = catalogue.getFace(ref.definitionId, ref.faceId), kind = key === 'trauma' ? 'Trauma' : 'Kratos';
    if (!supportsPattern(face, kind) || !isFaceAvailableInCycle(face, cycle)) return `Choose an available ${kind} Pattern.`;
  }
  for (const id of new Set(Object.values(patterns).flatMap(ref => ref ? [ref.definitionId] : []))) {
    const card = catalogue.get(id)!;
    const used = legacyTitanRoster(party, catalogue).filter(titan => titan.id !== titanId && Object.values(titan.patterns).some(ref => ref?.definitionId === id)).length;
    if (used >= patternCopies(card)) return `All ${patternCopies(card)} printed ${card.faces[0].name} Pattern copies are assigned to other Titans.`;
  }
  return undefined;
}
export function availableRosterTitans(party: Party, catalogue: CatalogueRepository, argonautId: string): TitanRecord[] {
  return sortRoster(legacyTitanRoster(party, catalogue).filter(titan => titan.status === 'alive'
    && !party.argonauts.some(member => member.id !== argonautId && member.titan?.rosterId === titan.id)), catalogue);
}
export type RosterEdit =
  | { operation: 'initialize' }
  | { operation: 'add'; record: TitanRecord }
  | { operation: 'patterns'; id: string; patterns: TitanRecord['patterns']; expected: TitanRecord }
  | { operation: 'update'; id: string; name: string; patterns: TitanRecord['patterns']; expected: TitanRecord }
  | { operation: 'status'; id: string; status: TitanStatus; expected: TitanRecord }
  | { operation: 'delete'; id: string; confirmed: boolean; expected: TitanRecord };
const equalRecord = (a: TitanRecord, b: TitanRecord) => a.id === b.id && sameReference(a, b) && a.status === b.status && a.name === b.name
  && sameReference(a.patterns.trauma, b.patterns.trauma) && sameReference(a.patterns.kratos, b.patterns.kratos);
export function editTitanRoster(party: Party, edit: RosterEdit, catalogue: CatalogueRepository): Party {
  const base = materializeTitanRoster(party, catalogue), titans = base.titanRoster!.titans;
  if (edit.operation === 'initialize') return base;
  let next: TitanRecord[];
  if (edit.operation === 'add') {
    const item = edit.record, face = catalogue.getFace(item.definitionId, item.faceId);
    if (!item.id?.trim() || titans.some(titan => titan.id === item.id) || item.status !== 'alive' || face?.kind !== 'titan'
      || item.name !== undefined && (typeof item.name !== 'string' || item.name.length > TITAN_NAME_LIMIT)
      || !isFaceAvailableInCycle(face, campaignCycle(party)) || livingTitanCount(titans) >= titanCapacity(party, catalogue)
      || rosterTypeIssue(base, item.id, item, catalogue) || patternIssue(base, item.id, item.patterns, catalogue)) return party;
    next = [...titans, normalizeTitanName(item, catalogue)];
  } else {
    const item = titans.find(titan => titan.id === edit.id);
    if (!item || !equalRecord(item, edit.expected)) return party;
    if (edit.operation === 'delete') {
      if (edit.confirmed !== true) return party;
      next = titans.filter(titan => titan.id !== item.id);
    } else if (edit.operation === 'status') {
      if (!TITAN_STATUSES.includes(edit.status) || edit.status === 'crippled' && campaignCycle(party) === 1
        || item.status === 'dead' && edit.status !== 'dead' && (livingTitanCount(titans) >= titanCapacity(party, catalogue)
          || rosterTypeIssue(base, item.id, item, catalogue))) return party;
      if (item.status === edit.status) return party;
      next = titans.map(titan => titan.id === item.id ? { ...titan, status: edit.status } : titan);
    } else {
      if (edit.operation === 'update' && (typeof edit.name !== 'string' || edit.name.length > TITAN_NAME_LIMIT)
        || patternIssue(base, item.id, edit.patterns, catalogue)) return party;
      next = titans.map(titan => titan.id === item.id ? edit.operation === 'update'
        ? normalizeTitanName({ ...titan, name: edit.name, patterns: edit.patterns }, catalogue) : { ...titan, patterns: edit.patterns } : titan);
    }
  }
  return syncRosterAssignments({ ...base, titanRoster: { version: 1, titans: next } });
}
/** Status/deletion frees its Argonaut; changing a Pattern updates every gameplay reference. */
export function syncRosterAssignments(party: Party): Party {
  const argonauts = party.argonauts.map(member => {
    if (!member.titan?.rosterId) return member;
    const titan = party.titanRoster?.titans.find(titan => titan.id === member.titan!.rosterId);
    if (!titan || titan.status !== 'alive') return { ...member, titan: null, tableOverrides: emptyTitanPatterns(),
      equipment: member.equipment.map(item => item.attachmentHostId === member.titan!.id ? { ...item, attachmentHostId: null } : item) };
    if (sameReference(member.titan, titan) && sameReference(member.tableOverrides.trauma, titan.patterns.trauma) && sameReference(member.tableOverrides.kratos, titan.patterns.kratos)) return member;
    return { ...member, titan: { ...member.titan, definitionId: titan.definitionId, faceId: titan.faceId }, tableOverrides: titan.patterns };
  });
  return argonauts.every((member, i) => member === party.argonauts[i]) ? party : { ...party, argonauts };
}
/** Advancement drops casualties, retains living Argo-bred Titans and replenishes to ten. */
export function advanceTitanRoster(party: Party, cycle: CampaignCycle, catalogue: CatalogueRepository): Party {
  const old = materializeTitanRoster(party, catalogue), dreamwalker = cycleDreamwalker(cycle, catalogue);
  const alive = old.titanRoster!.titans.filter(titan => titan.status === 'alive');
  const bred = alive.filter(titan => !isDreamwalker(catalogue.getFace(titan.definitionId, titan.faceId)));
  const walkers = alive.filter(titan => isDreamwalker(catalogue.getFace(titan.definitionId, titan.faceId)))
    .sort((a, b) => Number(old.argonauts.some(member => member.titan?.rosterId === b.id)) - Number(old.argonauts.some(member => member.titan?.rosterId === a.id)))
    .slice(0, Math.max(0, 10 - bred.length));
  const titans = [...bred, ...walkers.map(titan => dreamwalker
    ? { ...titan, definitionId: dreamwalker.id, faceId: dreamwalker.faces[0].id, patterns: emptyTitanPatterns() } : titan)];
  if (dreamwalker) for (let i = titans.length; i < 10; i++) {
    let id = `advance:${cycle}:dreamwalker:${i + 1}`;
    while (titans.some(titan => titan.id === id)) id += ':new';
    titans.push(record(id, dreamwalker));
  }
  return syncRosterAssignments({ ...old, titanRoster: { version: 1, titans } });
}
export function rosterPatternName(ref: CardReference | null, titanFace: CardFace | undefined, catalogue: CatalogueRepository): string {
  return ref ? catalogue.getFace(ref.definitionId, ref.faceId)?.name ?? 'Unavailable Pattern' : `${titanFace ? titanVariantDisplayName(titanFace) : 'Titan'} default`;
}
