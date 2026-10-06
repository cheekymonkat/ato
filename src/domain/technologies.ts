import type { CatalogueRepository } from '../catalogue/repository.ts';
import { CAMPAIGN_CYCLES, campaignCycle, isFaceAvailableInCycle } from './campaign.ts';
import { displayValue, objects, strings } from './card-presentation.ts';
import type { CardDefinition } from './cards.ts';
import type { Party } from './party.ts';

export const TECHNOLOGY_TYPES = ['Structural', 'Argo Ability', 'Production Facility', 'Core'] as const;
export type TechnologyType = typeof TECHNOLOGY_TYPES[number];
export type TechnologySide = 'project' | 'technology';

/** Technology fields live on the source/front face, including researched-side benefits. */
export function technologyData(card: CardDefinition) { return card.faces[0].data; }
export function technologyType(card: CardDefinition): TechnologyType | null {
  if (card.family !== 'Technology') return null;
  const data = technologyData(card);
  if (data.cardType === 'Core' || data.techSubType === 'Core') return 'Core';
  if (data.cardType === 'Production Facility' || data.techSubType === 'Production Facility') return 'Production Facility';
  // Nietzschean Sighting is printed as Combat without a subtype; its benefits are abilities, not recipes.
  if (data.cardType === 'Argo Ability' || data.techType === 'Combat') return 'Argo Ability';
  return data.techType === 'Structural' ? 'Structural' : null;
}
export function technologyName(card: CardDefinition, side: TechnologySide): string {
  return side === 'technology' && card.faces[1]?.name || card.faces[0].name;
}
export function researchedTechnologyIds(party: Party): readonly string[] { return party.technologies?.researched ?? []; }
export function technologyCycle(card: CardDefinition): number {
  return CAMPAIGN_CYCLES.find(value => isFaceAvailableInCycle(card.faces[0], value)) ?? 0;
}
const coreCache = new WeakMap<CatalogueRepository, Map<number, CardDefinition[]>>();
/** Core facilities are supplied automatically by the selected campaign cycle. */
export function currentCoreTechnologies(party: Party, catalogue: CatalogueRepository): CardDefinition[] {
  let cycles = coreCache.get(catalogue);
  if (!cycles) { cycles = new Map(); coreCache.set(catalogue, cycles); }
  const cycle = campaignCycle(party);
  let cards = cycles.get(cycle);
  if (!cards) {
    cards = catalogue.search({ family: 'Technology' }).filter(card => technologyType(card) === 'Core' &&
      technologyCycle(card) === cycle);
    cycles.set(cycle, cards);
  }
  return [...cards];
}
/** Keep historical recorded IDs intact; automatic Core cards never need save entries. */
export function activeTechnologyIds(party: Party, catalogue: CatalogueRepository): string[] {
  return [...new Set([...researchedTechnologyIds(party), ...currentCoreTechnologies(party, catalogue).map(card => card.id)])];
}
export function technologyAvailable(card: CardDefinition, party: Party) {
  return technologyType(card) !== null && isFaceAvailableInCycle(card.faces[0], campaignCycle(party));
}
function normalise(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").trim().toLowerCase().replace(/\s+/g, ' ');
}
/** Explicit source spelling corrections; original printed text remains visible and lossless. */
const aliases: Record<string, string> = {
  'theseus methods': 'Theseus Method', 'grassroots projects': 'Grassroot Projects',
  'grassroots support': 'Grassroot Support', 'sanstorm sailling': 'Sandstorm Sailing',
  'demidjinn autospy': 'Demidjinn Autopsy', 'midascore autospy': 'Midascore Autopsy',
  'forved kratos reaction': 'Forced Kratos Reaction', 'counterintelligen': 'Counterintelligence',
  'babelain lunacy sighting': 'Babelian Lunacy Sighting', 'merchants of the wast': 'Merchants of the Waste',
};
const indexes = new WeakMap<CatalogueRepository, { projects: Map<string, CardDefinition[]>; sides: Map<string, CardDefinition[]> }>();
const requirementCache = new WeakMap<CardDefinition, WeakMap<CatalogueRepository, TechnologyRequirement>>();
export function resolveTechnologyName(name: string, source: CardDefinition, catalogue: CatalogueRepository): CardDefinition[] {
  const key = normalise(aliases[normalise(name)] ?? name);
  let index = indexes.get(catalogue);
  if (!index) {
    index = { projects: new Map(), sides: new Map() };
    for (const card of catalogue.search({ family: 'Technology' })) {
      for (const [map, names] of [[index.projects, [card.faces[0].name]], [index.sides, card.faces.map(face => face.name)]] as const) {
        for (const label of new Set(names)) {
          const id = `${card.faces[0].game}\0${normalise(label)}`;
          map.set(id, [...(map.get(id) ?? []), card]);
        }
      }
    }
    indexes.set(catalogue, index);
  }
  const id = `${source.faces[0].game}\0${key}`;
  return index.projects.get(id) ?? index.sides.get(id) ?? [];
}

export type TechnologyRequirement =
  | { kind: 'and' | 'or'; children: TechnologyRequirement[] }
  | { kind: 'technology'; text: string; definitionIds: string[] }
  | { kind: 'threshold'; text: string; resource: 'Argo Knowledge' | 'Argo Fate'; minimum: number }
  | { kind: 'manual'; text: string };

export function parseTechnologyRequirement(text: string, source: CardDefinition, catalogue: CatalogueRepository): TechnologyRequirement {
  const clean = text.trim().replace(/^and\s+either\s*:?\s*/i, '');
  const references = resolveTechnologyName(clean, source, catalogue);
  if (references.length) return { kind: 'technology', text, definitionIds: references.map(card => card.id) };
  // Project name / researched name is one card, rather than two independent prerequisites.
  const pair = clean.split(/\s+\/\s+/);
  if (pair.length === 2) {
    const first = resolveTechnologyName(pair[0], source, catalogue);
    if (first.length) return { kind: 'technology', text, definitionIds: first.map(card => card.id) };
  }
  const choice = /^(.+?)\s+and\s+either\s*:?\s+(.+)$/i.exec(clean);
  if (choice) return { kind: 'and', children: [parseTechnologyRequirement(choice[1], source, catalogue), parseTechnologyRequirement(choice[2], source, catalogue)] };
  const alternatives = clean.split(/\s+OR\s+/i);
  if (alternatives.length > 1) return { kind: 'or', children: alternatives.map(value => parseTechnologyRequirement(value, source, catalogue)) };
  const conjuncts = clean.split(/\s+AND\s+/i);
  if (conjuncts.length > 1) return { kind: 'and', children: conjuncts.map(value => parseTechnologyRequirement(value, source, catalogue)) };
  const threshold = /^@?Argo\s*(Knowledge|Fate)\s+(\d+)\+$/i.exec(clean);
  if (threshold) return { kind: 'threshold', text, resource: threshold[1].toLowerCase() === 'knowledge' ? 'Argo Knowledge' : 'Argo Fate', minimum: Number(threshold[2]) };
  return { kind: 'manual', text };
}
export function technologyRequirements(card: CardDefinition, catalogue: CatalogueRepository): TechnologyRequirement {
  let cache = requirementCache.get(card);
  if (!cache) { cache = new WeakMap(); requirementCache.set(card, cache); }
  let requirements = cache.get(catalogue);
  if (!requirements) {
    requirements = { kind: 'and', children: strings(technologyData(card).requirements).filter(value => value.trim() && !/^[-—–]+$/.test(value.trim()))
      .map(value => parseTechnologyRequirement(value, card, catalogue)) };
    cache.set(catalogue, requirements);
  }
  return requirements;
}
export function technologyResourceValue(party: Party, resource: string): number {
  const key = normalise(resource).replace(/\s/g, '');
  // Shared resources are already editable on Argo. Support both printed and spaced labels.
  return Math.max(0, ...Object.entries(party.resources).filter(([name]) => normalise(name).replace(/^@/, '').replace(/\s/g, '') === key).map(([, count]) => count));
}
export interface RequirementStatus { met: boolean; tracked: boolean; text: string; operator?: 'and' | 'or'; children?: RequirementStatus[] }
export function technologyRequirementStatus(requirement: TechnologyRequirement, party: Party, catalogue: CatalogueRepository): RequirementStatus {
  if (requirement.kind === 'technology') return { text: requirement.text, tracked: true,
    met: requirement.definitionIds.some(id => activeTechnologyIds(party, catalogue).includes(id)) };
  if (requirement.kind === 'threshold') return { text: requirement.text, tracked: true,
    met: technologyResourceValue(party, requirement.resource) >= requirement.minimum };
  if (requirement.kind === 'manual') return { text: requirement.text, tracked: false, met: true };
  const children = requirement.children.map(child => technologyRequirementStatus(child, party, catalogue));
  // Untracked conditions are omitted from the logic, so a manual OR branch cannot bypass a tracked branch.
  const tracked = children.filter(child => child.tracked);
  return { text: '', operator: requirement.kind, children, tracked: tracked.length > 0,
    met: requirement.kind === 'and' ? tracked.every(child => child.met) : !tracked.length || tracked.some(child => child.met) };
}
export function technologyResearchStatus(card: CardDefinition, party: Party, catalogue: CatalogueRepository) {
  const requirements = technologyRequirementStatus(technologyRequirements(card, catalogue), party, catalogue);
  const researched = researchedTechnologyIds(party).includes(card.id), core = technologyType(card) === 'Core';
  return { requirements, researched, core, available: technologyAvailable(card, party),
    canResearch: !researched && !core && technologyAvailable(card, party) && requirements.met };
}
export function projectList(party: Party, catalogue: CatalogueRepository): CardDefinition[] {
  return catalogue.search({ family: 'Technology', campaignCycle: campaignCycle(party) }).filter(card => technologyResearchStatus(card, party, catalogue).canResearch);
}
export function technologyLeadsTo(card: CardDefinition, catalogue: CatalogueRepository): CardDefinition[] {
  return [...new Map(strings(technologyData(card).leadsTo).flatMap(name => resolveTechnologyName(name, card, catalogue)).map(next => [next.id, next])).values()];
}
export function argoAbilityLimit(party: Party, catalogue: CatalogueRepository): number | null {
  const limits = activeTechnologyIds(party, catalogue).flatMap(id => {
    const card = catalogue.get(id); if (!card || technologyType(card) === null) return [];
    const text = objects(technologyData(card).abilities).flatMap(ability => objects(ability.effects))
      .flatMap(effect => objects(effect.abilityText).map(token => displayValue(token.value))).join(' ');
    return [...text.matchAll(/Argo Ability(?:\s*\(AA\))?\s+Limit:\s*(\d+)/gi)].map(match => Number(match[1]));
  });
  return limits.length ? Math.max(...limits) : null;
}

export function changeTechnology(party: Party, id: string, operation: 'research' | 'remove', catalogue: CatalogueRepository): Party {
  const ids = researchedTechnologyIds(party), card = catalogue.get(id);
  if (card && technologyType(card) === 'Core') return party;
  if (operation === 'remove') return ids.includes(id) ? { ...party, technologies: { version: 1, researched: ids.filter(value => value !== id) } } : party;
  if (!card || ids.includes(id) || !technologyAvailable(card, party)) return party;
  if (!technologyResearchStatus(card, party, catalogue).canResearch) return party;
  return { ...party, technologies: { version: 1, researched: [...ids, id] } };
}
