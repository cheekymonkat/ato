import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { CampaignCycle } from './campaign.ts';
import { campaignCycle } from './campaign.ts';
import type { CardFace } from './cards.ts';
import { EVOLUTION_RULES, canMarkEvolutionNode, connectedEvolutionMarks, campaignPrimordialMaximum, primordialPath } from './evolution-rules.ts';
import type { EvolutionRules, PrimordialTrack } from './evolution-rules.ts';
import { isRecord } from './json.ts';
import type { Party } from './party.ts';

export interface CycleEvolution {
  marked: string[];
  bossBattles: number;
  adversaryId: string | null;
  adversaryBattles: number;
}
export interface EvolutionState {
  version: 1;
  cycles: Partial<Record<CampaignCycle, CycleEvolution>>;
  disabledTraits?: Record<string, string[]>;
}
export type EvolutionEdit =
  | { kind: 'node'; nodeId: string; marked: boolean }
  | { kind: 'trait'; primordialId: string; trait: string; disabled: boolean }
  | { kind: 'battle'; track: 'boss' | 'adversary'; value: number }
  | { kind: 'adversary'; primordialId: string | null; expectedId: string | null; confirmed: boolean };

export function evolutionValues(party: Party, cycle = campaignCycle(party)): CycleEvolution {
  const saved = party.argo?.evolution?.cycles[cycle];
  if (saved) return saved;
  const rules = EVOLUTION_RULES[cycle];
  // A surviving adversary retains its Battle Track when the next sheet offers the same adversary.
  let adversaryId = rules.defaultAdversary, adversaryBattles = 0;
  for (let previous = cycle - 1; previous >= 1; previous--) {
    const prior = party.argo?.evolution?.cycles[previous as CampaignCycle];
    if (!prior) continue;
    if (rules.adversaries.some(track => track.printedId === prior.adversaryId)) {
      adversaryId = prior.adversaryId; adversaryBattles = prior.adversaryBattles;
    }
    break;
  }
  return { marked: [], bossBattles: 0, adversaryId, adversaryBattles };
}
export function validEvolution(value: unknown): value is EvolutionState {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.cycles)) return false;
  if (value.disabledTraits !== undefined) {
    const ids = Object.values(EVOLUTION_RULES).flatMap(rules => [...rules.regular, rules.boss, ...rules.adversaries]).map(track => track.printedId);
    if (!isRecord(value.disabledTraits) || !Object.entries(value.disabledTraits).every(([id, traits]) => ids.includes(id)
      && Array.isArray(traits) && traits.length <= 100
      && traits.every(trait => typeof trait === 'string' && trait.trim() === trait && trait.length > 0 && trait.length <= 200)
      && new Set(traits).size === traits.length)) return false;
  }
  return Object.entries(value.cycles).every(([key, state]) => {
    if (!/^[1-5]$/.test(key) || !isRecord(state)) return false;
    const rules = EVOLUTION_RULES[Number(key) as CampaignCycle];
    return Array.isArray(state.marked) && state.marked.every(id => typeof id === 'string' && rules.nodes.some(node => node.id === id))
      && new Set(state.marked).size === state.marked.length
      && Number.isSafeInteger(state.bossBattles) && (state.bossBattles as number) >= 0
      && (state.adversaryId === null || rules.adversaries.some(track => track.printedId === state.adversaryId))
      && Number.isSafeInteger(state.adversaryBattles) && (state.adversaryBattles as number) >= 0
      && (state.adversaryId !== null || state.adversaryBattles === 0);
  });
}
export function trackedLevel(party: Party, primordialId: string): number {
  const rules = EVOLUTION_RULES[campaignCycle(party)], state = evolutionValues(party), path = primordialPath(rules, primordialId);
  // An unmarked track previews its first encounter. Battle count is never a level.
  return path.findLast(node => state.marked.includes(node.id))?.level ?? path[0]?.level ?? 1;
}
export function disabledPrimordialTraits(party: Party, primordialId: string): readonly string[] {
  return party.argo?.evolution?.disabledTraits?.[primordialId] ?? [];
}
export function changeEvolution(party: Party, edit: EvolutionEdit, catalogue?: CatalogueRepository): Party {
  const cycle = campaignCycle(party), rules = EVOLUTION_RULES[cycle], current = evolutionValues(party);
  const argo = party.argo ?? { version: 1 as const, tracks: {}, limits: {}, records: {} };
  if (edit.kind === 'trait') {
    const track = [...rules.regular, rules.boss, ...rules.adversaries.filter(track => track.printedId === current.adversaryId)].find(track => track.printedId === edit.primordialId);
    if (!catalogue || !track || typeof edit.disabled !== 'boolean' || !primordialLevels(track, catalogue).some(level => level.activeTraits.includes(edit.trait))) return party;
    const disabled = disabledPrimordialTraits(party, track.printedId);
    if (disabled.includes(edit.trait) === edit.disabled) return party;
    const disabledTraits = { ...argo.evolution?.disabledTraits, [track.printedId]: edit.disabled ? [...disabled, edit.trait] : disabled.filter(trait => trait !== edit.trait) };
    if (!disabledTraits[track.printedId].length) delete disabledTraits[track.printedId];
    return { ...party, argo: { ...argo, evolution: { version: 1, cycles: { ...argo.evolution?.cycles }, disabledTraits } } };
  }
  let next: CycleEvolution;
  if (edit.kind === 'node') {
    const { nodeId: id, marked } = edit;
    if (!id || !rules.nodes.some(node => node.id === id) || typeof marked !== 'boolean' || current.marked.includes(id) === marked) return party;
    if (marked && !canMarkEvolutionNode(rules, current.marked, id)) return party;
    next = { ...current, marked: marked ? [...current.marked, id] : connectedEvolutionMarks(rules, current.marked.filter(node => node !== id)) };
  } else if (edit.kind === 'battle') {
    if (edit.track !== 'boss' && edit.track !== 'adversary' || edit.track === 'adversary' && !current.adversaryId) return party;
    const field = edit.track === 'boss' ? 'bossBattles' : 'adversaryBattles';
    if (!Number.isSafeInteger(edit.value) || edit.value < 0 || edit.value === current[field]) return party;
    next = { ...current, [field]: edit.value };
  } else if (edit.kind === 'adversary') {
    if (edit.expectedId !== current.adversaryId || edit.primordialId === current.adversaryId
      || edit.primordialId !== null && !rules.adversaries.some(track => track.printedId === edit.primordialId)
      || current.adversaryBattles > 0 && edit.confirmed !== true) return party;
    next = { ...current, adversaryId: edit.primordialId, adversaryBattles: 0 };
  } else return party;
  return { ...party, argo: { ...argo, evolution: { ...argo.evolution, version: 1, cycles: { ...argo.evolution?.cycles, [cycle]: next } } } };
}

export interface LevelStatBlock {
  level: number; toHit: string; speed: string; wounds: string;
  attributes: { name: string; count: number }[];
  traitsChanges: string[]; activeTraits: string[];
}
export interface BattleSetup {
  primordial: PrimordialTrack; level: number; stats: LevelStatBlock;
  activeTraits: string[];
  suppressedTraits: Record<string, string[]>;
  atBonus: number; dangerBonus: number; dangerFateBonus: number; evasionDiceBonus: number;
  initialAiDeckLevel: 1; initialBpDeckLevel: 1; preBattleEscalationCount: number;
}
/** Printed IDs can be shared with another monster in the source; match the name as well. */
export function primordialFace(track: PrimordialTrack, catalogue: CatalogueRepository): CardFace | undefined {
  return catalogue.byPrintedId(track.printedId).flatMap(card => card.faces).find(face => face.family === 'Primordial' && face.name === track.name);
}
export function primordialLevels(track: PrimordialTrack, catalogue: CatalogueRepository): LevelStatBlock[] {
  const face = primordialFace(track, catalogue), raw = face?.data.levels;
  if (!Array.isArray(raw)) return [];
  const active = new Set<string>();
  return (raw as unknown[]).filter(isRecord).sort((a, b) => Number(a.level) - Number(b.level)).flatMap(block => {
    const level = Number(block.level);
    if (!Number.isInteger(level) || level < 0 || level > 9 || !['toHit', 'speed', 'wounds'].every(key => typeof block[key] === 'string')) return [];
    const changes = Array.isArray(block.traitsChanges) ? block.traitsChanges.filter((value): value is string => typeof value === 'string') : [];
    for (const trait of changes) if (trait.startsWith('-')) active.delete(trait.slice(1).trim()); else active.add(trait);
    const activeTraits = Array.isArray(block.traitsFullList) && block.traitsFullList.every(value => typeof value === 'string') ? [...block.traitsFullList] as string[] : [...active];
    const attributes = Array.isArray(block.attributes) ? block.attributes.filter(isRecord).flatMap(attribute => {
      const count = Number(attribute.count);
      return typeof attribute.name === 'string' && Number.isSafeInteger(count) ? [{ name: attribute.name, count }] : [];
    }) : [];
    return [{ level, toHit: block.toHit as string, speed: block.speed as string, wounds: block.wounds as string, attributes, traitsChanges: changes, activeTraits }];
  });
}
export function mnestisPrimordialLevels(track: PrimordialTrack, rules: EvolutionRules, catalogue: CatalogueRepository): LevelStatBlock[] {
  return primordialLevels(track, catalogue).filter(block => block.level > campaignPrimordialMaximum(rules, track.printedId));
}
export function resolveBattleSetup(track: PrimordialTrack, level: number, catalogue: CatalogueRepository, disabledTraits: readonly string[] = []): BattleSetup | null {
  const stats = primordialLevels(track, catalogue).find(block => block.level === level);
  if (!stats) return null;
  const availableTraits = stats.activeTraits.filter(trait => !disabledTraits.includes(trait));
  const suppressedTraits: Record<string, string[]> = {};
  for (const source of availableTraits) for (const trait of track.traitDisables?.[source] ?? []) {
    if (stats.activeTraits.includes(trait)) suppressedTraits[trait] = [...(suppressedTraits[trait] ?? []), source];
  }
  const bonus = (...names: string[]) => stats.attributes.filter(attribute => names.includes(attribute.name)).reduce((sum, attribute) => sum + attribute.count, 0);
  return { primordial: track, level, stats, activeTraits: availableTraits.filter(trait => !suppressedTraits[trait]), suppressedTraits, atBonus: bonus('AT'), dangerBonus: bonus('Danger', 'Danger per hit'), dangerFateBonus: bonus('Danger/Fate', 'Danger/Fate per hit'),
    evasionDiceBonus: bonus('d10'), preBattleEscalationCount: bonus('Escalation'), initialAiDeckLevel: 1, initialBpDeckLevel: 1 };
}
