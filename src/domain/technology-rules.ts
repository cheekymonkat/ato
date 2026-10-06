import type { CardDefinition } from './cards.ts';
import { CAMPAIGN_CYCLES, isFaceAvailableInCycle } from './campaign.ts';
import type { CampaignCycle } from './campaign.ts';

export const TECHNOLOGY_RULES_VERSION = 1;
export const TECHNOLOGY_LIMITS = ['hull', 'crew', 'titans', 'argoAbilities', 'argoOxygen', 'summons', 'timeSilo'] as const;
export type TechnologyLimit = typeof TECHNOLOGY_LIMITS[number];
export interface TechnologyRules {
  version: 1;
  availableCycles: CampaignCycle[];
  /** Absolute capacities; overlapping upgrades combine by taking the maximum. */
  limits: Partial<Record<TechnologyLimit, number>>;
}

/** Campaign retirement rules supplied by the user. Printed IDs disambiguate repeated names. */
export const TECHNOLOGY_CYCLE_POLICY = {
  cycleOnly: {
    1: {
      AA0049: 'Advanced Crew Expansion', AA0047: 'Advanced Trading Solutions', AA0050: 'Superior Trading Solutions',
      AA0036: 'Peace', AA0032: 'Shallows Navigation', AA0034: 'Diplomatic Relations', AA0040: 'Deeply Embedded Spies',
      AA0033: 'Rhetoric', AA0043: 'Minoan Investigations', AA0031: 'Intelligence Gathering', AA0048: 'Crew Expansion',
    },
    2: {
      BA1027: 'Spartan Investigations', BA1028: 'Theseus Method', BA1037: 'War Recruitment', BA1026: 'Refugee Integration',
      BA1025: 'Recruitment Programs', BA1034: 'Up-stream Navigation', BA1036: 'Argo Security', BA1045: 'Counterintelligence',
      BA1023: 'Political Protection', BA1024: 'Refugee Relief Effort', BA1029: 'Grassroot Support', BA1030: 'Mobile Trade Fleet Dock',
      BA1035: 'Sluice Gate System Integration', BA1047: 'Ambrosia Spill Solution', BA1040: 'Argo Maintenance',
    },
  },
  structuralCarryForward: {
    3: { CA1629: 'Titan Care', CA1621: 'Extinction Protocols', CA1633: 'Awakening Studies',
      CA1628: 'Advanced Titan Breeding', CA1632: 'Quantum Propylon' },
    4: { DA2219: 'Salvage Operations', DA2217: 'Superior Titan Breeding', DA2216: 'Argo Cloud Operations' },
  },
} as const;

// Match only explicit printed absolute capacities, never gain/loss effects or prose mentioning a limit.
const limitPatterns: Record<TechnologyLimit, RegExp> = {
  hull: /\bHull\s+Limit:\s*(\d+)/gi, crew: /\bCrew\s+Limit:\s*(\d+)/gi,
  titans: /\bTitan\s+Limit:\s*(\d+)/gi,
  argoAbilities: /\b(?:Argo Ability(?:\s*\(AA\))?|AA)\s+Limit:\s*(\d+)/gi,
  argoOxygen: /\bArgo Oxygen\s+Limit:\s*(\d+)/gi,
  summons: /\bSummon\s+Limit:\s*(\d+)/gi, timeSilo: /\bTime Silo(?:\s+Limit)?:\s*(\d+)/gi,
};
function abilityParagraphs(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(abilityParagraphs);
  const object = value as Record<string, unknown>;
  if (Array.isArray(object.abilityText)) return [object.abilityText.map(token => token && typeof token === 'object' &&
    'value' in token && typeof token.value === 'string' ? token.value : '').join('')];
  return Object.values(object).flatMap(abilityParagraphs);
}
export function deriveTechnologyRules(card: CardDefinition): TechnologyRules | undefined {
  if (card.family !== 'Technology') return undefined;
  const data = card.faces[0].data;
  const cycle = CAMPAIGN_CYCLES.find(value => isFaceAvailableInCycle(card.faces[0], value));
  if (!cycle) return { version: 1, availableCycles: [], limits: {} };
  const only = cycle === 1 || cycle === 2 ? TECHNOLOGY_CYCLE_POLICY.cycleOnly[cycle] : {};
  const structural = data.techType === 'Structural' && data.cardType !== 'Core' && data.techSubType !== 'Core';
  const exceptions = cycle === 3 || cycle === 4 ? TECHNOLOGY_CYCLE_POLICY.structuralCarryForward[cycle] : null;
  const cycleOnly = card.printedIds.some(id => Object.hasOwn(only, id)) ||
    structural && exceptions !== null && !card.printedIds.some(id => Object.hasOwn(exceptions, id));
  const limits: TechnologyRules['limits'] = {};
  for (const key of TECHNOLOGY_LIMITS) {
    const values = abilityParagraphs(data.abilities).flatMap(text => [...text.matchAll(limitPatterns[key])].map(match => Number(match[1])));
    if (values.length) limits[key] = Math.max(...values);
  }
  return { version: 1, availableCycles: cycleOnly ? [cycle] : CAMPAIGN_CYCLES.filter(value => value >= cycle), limits };
}
/** Older catalogue snapshots remain usable without a schema migration. */
export function technologyRules(card: CardDefinition): TechnologyRules | undefined {
  return card.technologyRules ?? deriveTechnologyRules(card);
}
export function technologyAvailableInCycle(card: CardDefinition, cycle: CampaignCycle): boolean {
  return technologyRules(card)?.availableCycles.includes(cycle) ?? false;
}
