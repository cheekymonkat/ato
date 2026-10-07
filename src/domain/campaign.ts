import type { CardFace } from './cards.ts';
import type { Party } from './party.ts';

export const CAMPAIGN_CYCLES = [1, 2, 3, 4, 5] as const;
export type CampaignCycle = typeof CAMPAIGN_CYCLES[number];
export function isCampaignCycle(value: unknown): value is CampaignCycle {
  return CAMPAIGN_CYCLES.some(cycle => cycle === value);
}
/** Older saves retain their data and use Cycle 1 until advanced on the campaign page. */
export function campaignCycle(party: Party): CampaignCycle { return party.campaignCycle ?? 1; }
export const argoKnowledgeLimit = (cycle: CampaignCycle): number => cycle * 20;
export const startingArgoKnowledge = (cycle: CampaignCycle): number => (cycle - 1) * 20;
/** Creation/advancement initializes Knowledge; loading an existing cycle never changes it. */
export function startCampaignCycle(party: Party, cycle: CampaignCycle): Party {
  const resources = Object.fromEntries(Object.entries(party.resources).filter(([name]) =>
    name.trim().toLowerCase().replace(/^@/, '').replace(/\s/g, '') !== 'argoknowledge'));
  if (cycle > 1) resources['Argo Knowledge'] = startingArgoKnowledge(cycle);
  const argo = party.argo && { ...party.argo, records: { ...party.argo.records } };
  if (argo) {
    delete argo.diplomacy;
    delete argo.records.diplomacy;
  }
  return { ...party, campaignCycle: cycle, resources, ...(argo ? { argo } : {}) };
}
export function nextCampaignCycle(cycle: CampaignCycle): CampaignCycle | null {
  return isCampaignCycle(cycle) ? CAMPAIGN_CYCLES[CAMPAIGN_CYCLES.indexOf(cycle) + 1] ?? null : null;
}

const romanCycles: Record<string, CampaignCycle> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
/** Tutorial and Mnestis Theatre are not numbered campaign cycles. */
export function isFaceAvailableInCycle(face: Pick<CardFace, 'cycle'> | null | undefined, cycle: CampaignCycle): boolean {
  if (!face) return false;
  const label = face.cycle.trim();
  const match = /^Cycle\s+(.+)$/i.exec(label);
  if (!match) return true;
  const printedCycle = romanCycles[match[1].toUpperCase()] ?? Number(match[1]);
  return Number.isSafeInteger(printedCycle) && printedCycle >= 1 && printedCycle <= cycle;
}
