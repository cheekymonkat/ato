import type { CatalogueRepository } from '../catalogue/repository.ts';
import { campaignCycle, argoKnowledgeLimit } from './campaign.ts';
import type { CampaignCycle } from './campaign.ts';
import { isRecord } from './json.ts';
import type { Party } from './party.ts';
import { technologyLimit, technologyResourceValue } from './technologies.ts';
import type { TechnologyLimit } from './technology-rules.ts';
import { currentMilestone, validMilestones } from './milestones.ts';
import type { MilestoneState } from './milestones.ts';
import { currentInwardOdyssey } from './inward-odyssey.ts';
import { validDiplomacy } from './diplomacy.ts';
import type { DiplomacyState } from './diplomacy.ts';
import { validEvolution } from './evolution.ts';
import type { EvolutionState } from './evolution.ts';
import { validAdventureState } from './adventures.ts';
import type { AdventureState } from './adventures.ts';

export interface ArgoTrack { value: number; limit?: number | null; reference?: string }
export interface ArgoState {
  version: 1;
  /** Ship totals carry forward; cycle-specific tracks and milestones have cycle-prefixed keys. */
  tracks: Record<string, ArgoTrack>;
  /** Capacity overrides are cycle-specific even when the associated total carries forward. */
  limits: Record<string, number | null>;
  records: Record<string, string>;
  milestones?: Record<string, MilestoneState>;
  diplomacy?: DiplomacyState;
  evolution?: EvolutionState;
  adventures?: AdventureState;
}
export interface ArgoTrackDefinition {
  id: string; name: string; icon?: string; cycles?: readonly CampaignCycle[];
  limit?: number; signed?: boolean; milestone?: boolean;
  limitSource?: 'fixed' | 'cycle' | 'technology' | 'card';
  readOnly?: boolean;
}
export const SHIP_TRACKS: readonly ArgoTrackDefinition[] = [
  { id: 'hull', name: 'Hull', icon: 'Hull', limit: 5 },
  { id: 'crew', name: 'Crew', icon: 'Crew', limit: 6 },
  { id: 'fate', name: 'Argo Fate', icon: 'ArgoFate', limit: 9, limitSource: 'fixed' },
  { id: 'knowledge', name: 'Argo Knowledge', icon: 'ArgoKnowledge', limit: 20, limitSource: 'cycle' },
  { id: 'titans', name: 'Titan Limit', icon: 'Titan', limit: 10, limitSource: 'technology', readOnly: true },
];
export const VOYAGE_TRACKS: readonly ArgoTrackDefinition[] = [
  { id: 'strangers', name: 'Strangers', icon: 'Strangers', cycles: [1] },
  { id: 'refugees', name: 'Refugees', cycles: [2] },
  { id: 'captives', name: 'Captives', cycles: [2] },
  { id: 'humanity', name: 'Humanity', signed: true, cycles: [2] },
  { id: 'defectors', name: 'Defectors', cycles: [2] },
  { id: 'paradox', name: 'Paradox', icon: 'Paradox', cycles: [3] },
  { id: 'frozen-time', name: 'Frozen Time', limit: 0, cycles: [3] },
  { id: 'time-silo', name: 'Time Silo', limit: 6, cycles: [3] },
  { id: 'loop-length', name: 'Loop Length', cycles: [3] },
  { id: 'babelian-debt', name: 'Babelian Debt', cycles: [4] },
  { id: 'reap-marks', name: 'Reap Marks', cycles: [4] },
  { id: 'sow-marks', name: 'Sow Marks', cycles: [4] },
  { id: 'paranoia', name: 'Paranoia', cycles: [5] },
  { id: 'argo-oxygen', name: 'Argo Oxygen', icon: 'Oxygen', limit: 1, cycles: [5] },
  { id: 'titan-x', name: 'Titan X Track', icon: 'Titan', limit: 7, cycles: [5] },
];
export const MILESTONE_TRACKS: readonly ArgoTrackDefinition[] = [
  { id: 'story', name: 'Story', icon: 'Progress', milestone: true, readOnly: true, limitSource: 'card' },
  { id: 'doom', name: 'Doom', icon: 'Doom', milestone: true, readOnly: true, limitSource: 'card' },
  { id: 'inwards', name: 'Inwards Odyssey', icon: 'Progress', limit: 2, milestone: true, limitSource: 'fixed' },
];
export const ARGO_RECORD_IDS = ['adventures', 'titans', 'glyphs', 'evolution', 'diplomacy', 'choice-matrix', 'fated-events', 'godforms', 'decks', 'mnestis'] as const;
export type ArgoRecordId = typeof ARGO_RECORD_IDS[number];
const definitions = [...SHIP_TRACKS, ...VOYAGE_TRACKS, ...MILESTONE_TRACKS];
export function argoTrackDefinition(id: string, cycle: CampaignCycle) {
  return definitions.find(track => track.id === id && (!track.cycles || track.cycles.includes(cycle)));
}
export function argoLimitEditable(track: ArgoTrackDefinition): boolean { return track.limitSource === undefined; }
function key(track: ArgoTrackDefinition, cycle: CampaignCycle) { return track.cycles || track.milestone ? `${cycle}:${track.id}` : track.id; }
const resourceName = (id: string) => id === 'fate' ? 'Argo Fate' : id === 'knowledge' ? 'Argo Knowledge' : null;
export function argoResourceDefinition(name: string): ArgoTrackDefinition | undefined {
  const normalised = name.trim().toLowerCase().replace(/^@/, '').replace(/\s/g, '');
  return SHIP_TRACKS.find(track => resourceName(track.id)?.toLowerCase().replace(/\s/g, '') === normalised);
}
const limitKeys: Partial<Record<string, TechnologyLimit>> = { hull: 'hull', crew: 'crew', titans: 'titans', 'argo-oxygen': 'argoOxygen', 'time-silo': 'timeSilo' };
/** Applicable Core, inherited and researched upgrades combine using the highest printed capacity. */
export function argoDefaultLimit(track: ArgoTrackDefinition, party: Party, catalogue: CatalogueRepository): number | undefined {
  const cycle = campaignCycle(party);
  if (track.id === 'inwards') return currentInwardOdyssey(party, catalogue).rules?.progressPerKnowledge ?? track.limit;
  const limitKey = limitKeys[track.id];
  if (limitKey) {
    const value = technologyLimit(party, catalogue, limitKey);
    if (value !== null) return Math.max(value, track.limit ?? 0);
  }
  return track.id === 'knowledge' ? argoKnowledgeLimit(cycle) : track.limit;
}
export function argoTrack(party: Party, track: ArgoTrackDefinition, catalogue: CatalogueRepository): ArgoTrack {
  if (track.id === 'story' || track.id === 'doom') {
    const current = currentMilestone(party, track.id, catalogue), rule = current.side?.tokens[0];
    return { value: rule ? current.tokens[rule.token] ?? rule.initial : 0, limit: rule?.target, reference: current.side?.label ?? '' };
  }
  const cycle = campaignCycle(party), stored = party.argo?.tracks[key(track, cycle)], resource = resourceName(track.id);
  const overrideKey = `${cycle}:${track.id}`;
  const limit = argoLimitEditable(track) && party.argo && Object.hasOwn(party.argo.limits, overrideKey) ? party.argo.limits[overrideKey] : argoDefaultLimit(track, party, catalogue);
  return { value: track.id === 'titans' && party.titanRoster ? party.titanRoster.titans.filter(titan => titan.status !== 'dead').length : track.readOnly ? limit ?? 0 : resource ? technologyResourceValue(party, resource) : stored?.value ?? 0,
    limit,
    reference: stored?.reference ?? '' };
}
export function validArgoState(value: unknown): value is ArgoState {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.tracks) || !isRecord(value.limits) || !isRecord(value.records)) return false;
  if (value.milestones !== undefined && !validMilestones(value.milestones)) return false;
  if (value.diplomacy !== undefined && !validDiplomacy(value.diplomacy)) return false;
  if (value.evolution !== undefined && !validEvolution(value.evolution)) return false;
  if (value.adventures !== undefined && !validAdventureState(value.adventures)) return false;
  const validKey = (entry: string) => definitions.some(track => track.cycles || track.milestone
    ? [1, 2, 3, 4, 5].some(cycle => key(track, cycle as CampaignCycle) === entry && (!track.cycles || track.cycles.includes(cycle as CampaignCycle))) : track.id === entry);
  return Object.entries(value.tracks).every(([id, track]) => validKey(id) && isRecord(track) && Number.isSafeInteger(track.value)
    && ((track.value as number) >= 0 || id === '2:humanity') && (track.reference === undefined || typeof track.reference === 'string' && track.reference.length <= 40))
    && Object.entries(value.limits).every(([id, limit]) => /^[1-5]:/.test(id) && definitions.some(track => `${id[0]}:${track.id}` === id && (!track.cycles || track.cycles.includes(Number(id[0]) as CampaignCycle))) && (limit === null || Number.isSafeInteger(limit) && (limit as number) >= 0))
    && Object.entries(value.records).every(([id, text]) => ARGO_RECORD_IDS.includes(id as ArgoRecordId) && typeof text === 'string');
}
export function changeArgoTrack(party: Party, id: string, value: number, cycle: CampaignCycle, catalogue: CatalogueRepository, options?: { limit: number | null; reference: string }): Party {
  const track = argoTrackDefinition(id, cycle);
  if (cycle !== campaignCycle(party) || !track || track.readOnly || !Number.isSafeInteger(value) || !track.signed && value < 0) return party;
  if (options && (options.limit !== null && (!Number.isSafeInteger(options.limit) || options.limit < 0) || typeof options.reference !== 'string' || options.reference.length > 40)) return party;
  const currentLimit = argoTrack(party, track, catalogue).limit;
  if (options && !argoLimitEditable(track) && options.limit !== currentLimit) return party;
  const limit = options && argoLimitEditable(track) ? options.limit : currentLimit;
  if (limit != null && value > limit) return party;
  if (id === 'inwards' && value === limit) {
    const rules = currentInwardOdyssey(party, catalogue).rules;
    const knowledgeTrack = SHIP_TRACKS.find(track => track.id === 'knowledge')!;
    const knowledge = argoTrack(party, knowledgeTrack, catalogue);
    const gained = knowledge.value < knowledge.limit!
      ? changeArgoTrack(party, 'knowledge', Math.min(knowledge.value + (rules?.knowledgePerCompletion ?? 1), knowledge.limit!), cycle, catalogue) : party;
    return changeArgoTrack(gained, id, 0, cycle, catalogue, options);
  }
  const argo: ArgoState = party.argo ?? { version: 1, tracks: {}, limits: {}, records: {} };
  const resource = resourceName(id), resources = { ...party.resources }, tracks = { ...argo.tracks };
  if (resource) delete tracks[key(track, cycle)];
  else tracks[key(track, cycle)] = { value, reference: options?.reference.trim() ?? argo.tracks[key(track, cycle)]?.reference ?? '' };
  const next = { ...argo, tracks,
    limits: options && argoLimitEditable(track) ? { ...argo.limits, [`${cycle}:${id}`]: options.limit } : argo.limits };
  if (resource) {
    // Consolidate legacy aliases so the Argo overview, shared resources and research gates never disagree.
    const normalise = (text: string) => text.toLowerCase().replace(/^@/, '').replace(/\s/g, '');
    for (const name of Object.keys(resources)) if (normalise(name) === normalise(resource)) delete resources[name];
    resources[resource] = value;
  }
  return { ...party, argo: next, ...(resource ? { resources } : {}) };
}
