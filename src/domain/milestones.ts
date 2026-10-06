import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { CardDefinition, CardFace } from './cards.ts';
import { campaignCycle, isFaceAvailableInCycle } from './campaign.ts';
import type { CampaignCycle } from './campaign.ts';
import { isRecord } from './json.ts';
import { MILESTONE_TOKENS, milestoneRules, milestoneTokenMaximum } from './milestone-rules.ts';
import type { MilestoneToken, MilestoneTokenRule } from './milestone-rules.ts';
import type { CardReference, Party } from './party.ts';

export type MilestoneKind = 'story' | 'doom';
export interface MilestoneState extends CardReference { tokens: Partial<Record<MilestoneToken, number>> }
export interface MilestoneSide {
  card: CardDefinition; face: CardFace; reference: CardReference; label: string;
  tokens: MilestoneTokenRule[];
}
const family = (kind: MilestoneKind) => kind === 'story' ? 'Story' : 'Doom';
export const milestoneKey = (cycle: CampaignCycle, kind: MilestoneKind) => `${cycle}:${kind}`;
export function milestoneSequence(kind: MilestoneKind, cycle: CampaignCycle, catalogue: CatalogueRepository): MilestoneSide[] {
  return catalogue.search({ family: family(kind) }).filter(card => milestoneRules(card) &&
    isFaceAvailableInCycle(card.faces[0], cycle) && (cycle === 1 || !isFaceAvailableInCycle(card.faces[0], (cycle - 1) as CampaignCycle)))
    .sort((a, b) => milestoneRules(a)!.cardNumber - milestoneRules(b)!.cardNumber || a.id.localeCompare(b.id))
    .flatMap(card => [...card.faces].sort((a, b) => a.id === b.id ? 0 : a.id === 'front' ? -1 : 1).map(face => ({
      card, face, reference: { definitionId: card.id, faceId: face.id },
      label: `${milestoneRules(card)!.cardNumber}${face.id === 'front' ? 'A' : 'B'}`,
      tokens: milestoneRules(card)!.faces[face.id]?.tokens ?? [],
    })));
}
export function sameMilestone(a: CardReference | null, b: CardReference | null): boolean {
  return !a || !b ? a === b : a.definitionId === b.definitionId && a.faceId === b.faceId;
}
const initialTokens = (side: MilestoneSide) => Object.fromEntries(side.tokens.map(rule => [rule.token, rule.initial])) as MilestoneState['tokens'];
/** Legacy free-text references are resolved without altering the existing save. */
export function currentMilestone(party: Party, kind: MilestoneKind, catalogue: CatalogueRepository) {
  const cycle = campaignCycle(party), sequence = milestoneSequence(kind, cycle, catalogue);
  const stored = party.argo?.milestones?.[milestoneKey(cycle, kind)];
  const legacy = party.argo?.tracks[milestoneKey(cycle, kind)];
  const side = stored ? sequence.find(side => sameMilestone(side.reference, stored))
    : sequence.find(side => side.label.toLowerCase() === legacy?.reference?.trim().toLowerCase()) ?? sequence[0];
  if (!side) return { sequence, side: null, tokens: {} as MilestoneState['tokens'], reference: null, index: -1 };
  const tokens = stored ? { ...initialTokens(side), ...stored.tokens } : initialTokens(side);
  if (!stored && legacy && side.tokens.length) tokens[side.tokens[0].token] = legacy.value;
  return { sequence, side, tokens, reference: side.reference, index: sequence.indexOf(side) };
}
export function validMilestones(value: unknown): value is Record<string, MilestoneState> {
  return isRecord(value) && Object.entries(value).every(([key, state]) => /^[1-5]:(story|doom)$/.test(key) &&
    isRecord(state) && typeof state.definitionId === 'string' && state.definitionId.trim() &&
    (state.faceId === 'front' || state.faceId === 'back') && isRecord(state.tokens) &&
    Object.entries(state.tokens).every(([token, count]) => MILESTONE_TOKENS.includes(token as MilestoneToken) && Number.isSafeInteger(count) && (count as number) >= 0));
}
function saveMilestone(party: Party, kind: MilestoneKind, state: MilestoneState): Party {
  const argo = party.argo ?? { version: 1 as const, tracks: {}, limits: {}, records: {} };
  return { ...party, argo: { ...argo, milestones: { ...argo.milestones, [milestoneKey(campaignCycle(party), kind)]: state } } };
}
export function selectMilestone(party: Party, kind: MilestoneKind, reference: CardReference, expected: CardReference | null, catalogue: CatalogueRepository): Party {
  const current = currentMilestone(party, kind, catalogue), next = current.sequence.find(side => sameMilestone(side.reference, reference));
  if (!next || !sameMilestone(current.reference, expected) || sameMilestone(current.reference, reference)) return party;
  const tokens = initialTokens(next);
  if (current.side && current.sequence[current.index + 1] === next) {
    for (const rule of current.side.tokens) {
      if (rule.carryToNext === 'all' && current.side.card.id === next.card.id) tokens[rule.token] = current.tokens[rule.token] ?? 0;
      if (rule.carryToNext === 'excess') tokens[rule.token] = Math.max(0, (current.tokens[rule.token] ?? 0) - rule.target);
    }
  }
  for (const rule of next.tokens) {
    const maximum = milestoneTokenMaximum(rule);
    if (maximum !== undefined) tokens[rule.token] = Math.min(tokens[rule.token] ?? rule.initial, maximum);
  }
  return saveMilestone(party, kind, { ...reference, tokens });
}
export function changeMilestoneToken(party: Party, kind: MilestoneKind, token: MilestoneToken, value: number, expected: CardReference | null, catalogue: CatalogueRepository): Party {
  const current = currentMilestone(party, kind, catalogue), rule = current.side?.tokens.find(rule => rule.token === token);
  const maximum = rule && milestoneTokenMaximum(rule);
  if (!current.reference || !rule || !sameMilestone(current.reference, expected) || !Number.isSafeInteger(value) || value < 0 ||
    maximum !== undefined && value > maximum || value === current.tokens[token]) return party;
  return saveMilestone(party, kind, { ...current.reference, tokens: { ...current.tokens, [token]: value } });
}
