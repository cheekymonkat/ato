import { campaignCycle, isCampaignCycle } from './campaign.ts';
import type { CampaignCycle } from './campaign.ts';
import { isRecord } from './json.ts';
import type { Party } from './party.ts';

export const DIPLOMACY_MAX = 20;
export const FACTIONS = [
  { id: 'minoan', name: 'Minoans', icon: 'Minoans', cycle: 1 },
  { id: 'labyrinthians', name: 'Labyrinthians', icon: 'Labyrinthians', cycle: 1 },
  { id: 'hornsworn', name: 'Hornsworn', icon: 'Hornsworn', cycle: 1 },
  { id: 'helots', name: 'Helots', icon: 'Helots', cycle: 2, alliedReference: '0289' },
  { id: 'cyclopes', name: 'Cyclopes', icon: 'Cyclopes', cycle: 2, alliedReference: '0373' },
  { id: 'symmachy', name: 'Symmachy', icon: 'Symmachy', cycle: 2, alliedReference: '0290' },
  { id: 'sunheirs', name: 'Sunheirs', icon: 'Sunheirs', cycle: 3, alliedReference: '0288' },
  { id: 'delphians', name: 'Delphians', icon: 'Delphians', cycle: 3, alliedReference: '0287' },
  { id: 'twilight-watch', name: 'Twilight Watch', icon: 'TwilightWatch', cycle: 3, alliedReference: '0286' },
  { id: 'aristotelians', name: 'Aristotelians', icon: 'Aristotelians', cycle: 4, alliedReference: '0007' },
  { id: 'wasters', name: 'Wasters', icon: 'Wasters', cycle: 4, alliedReference: '0006' },
  { id: 'cloud-thieves', name: 'Cloud Thieves', icon: 'CloudThieves', cycle: 4, alliedReference: '0008' },
  { id: 'outcast-vanguard', name: 'Outcast Vanguard', icon: 'OutcastVanguard', cycle: 5, alliedReference: '8381' },
  { id: 'followers-of-arete', name: 'Followers of Arete', icon: 'FollowersofArete', cycle: 5, alliedReference: '8382' },
  { id: 'cycladean-protectorate', name: 'Cycladean Protectorate', icon: 'CycladeanProtectorate', cycle: 5, alliedReference: '8383' },
] as const;
export type Faction = typeof FACTIONS[number];
export type FactionId = Faction['id'];
export interface DiplomacyState { cycle: CampaignCycle; values: Partial<Record<FactionId, number>> }
export interface Relationship { name: string; minimum: number; maximum: number; modifier: number }

const standardRelationships: readonly Relationship[] = [
  { name: 'At War', minimum: -20, maximum: -10, modifier: -3 },
  { name: 'Denounced', minimum: -9, maximum: -5, modifier: -2 },
  { name: 'Unfriendly', minimum: -4, maximum: -1, modifier: -1 },
  { name: 'Neutral', minimum: 0, maximum: 3, modifier: 0 },
  { name: 'Friendly', minimum: 4, maximum: 7, modifier: 1 },
  { name: 'Allied', minimum: 8, maximum: 20, modifier: 2 },
];
const cycleTwoRelationships: readonly Relationship[] = [
  { name: 'Hidden', minimum: 0, maximum: 2, modifier: -1 },
  { name: 'Distrustful', minimum: 3, maximum: 6, modifier: 0 },
  { name: 'Friendly', minimum: 7, maximum: 11, modifier: 1 },
  { name: 'Allied', minimum: 12, maximum: 20, modifier: 2 },
];
export const diplomacyMinimum = (cycle: CampaignCycle): number => cycle === 2 ? 0 : -20;
export const cycleFactions = (cycle: CampaignCycle): readonly Faction[] => FACTIONS.filter(faction => faction.cycle === cycle);
export const relationships = (cycle: CampaignCycle): readonly Relationship[] => cycle === 2 ? cycleTwoRelationships : standardRelationships;
export const diplomacyRelationship = (cycle: CampaignCycle, value: number): Relationship | undefined =>
  relationships(cycle).find(band => value >= band.minimum && value <= band.maximum);
export const signedDiplomacy = (value: number): string => value > 0 ? `+${value}` : String(value);
export const relationshipRange = (band: Relationship): string => `${signedDiplomacy(band.minimum)} to ${signedDiplomacy(band.maximum)}`;

/** Only the current cycle's factions exist in state; older notebooks remain readable until advancement. */
export function diplomacyValues(party: Party): Record<string, number> {
  const cycle = campaignCycle(party), saved = party.argo?.diplomacy;
  return Object.fromEntries(cycleFactions(cycle).map(faction => [faction.id, saved?.cycle === cycle ? saved.values[faction.id] ?? 0 : 0]));
}
export function validDiplomacy(value: unknown): value is DiplomacyState {
  if (!isRecord(value) || !isCampaignCycle(value.cycle) || !isRecord(value.values)) return false;
  const ids = new Set<string>(cycleFactions(value.cycle).map(faction => faction.id)), minimum = diplomacyMinimum(value.cycle);
  return Object.entries(value.values).every(([id, amount]) => ids.has(id) && Number.isSafeInteger(amount)
    && (amount as number) >= minimum && (amount as number) <= DIPLOMACY_MAX);
}
export function changeDiplomacy(party: Party, factionId: FactionId, value: number): Party {
  const cycle = campaignCycle(party), values = diplomacyValues(party);
  if (!Object.hasOwn(values, factionId) || !Number.isSafeInteger(value) || value < diplomacyMinimum(cycle)
    || value > DIPLOMACY_MAX || values[factionId] === value) return party;
  const argo = party.argo ?? { version: 1 as const, tracks: {}, limits: {}, records: {} };
  return { ...party, argo: { ...argo, diplomacy: { cycle, values: { ...values, [factionId]: value } } } };
}
