import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { CardFace } from './cards.ts';
import { displayGate, objects } from './card-presentation.ts';
import { loadoutState } from './loadout.ts';
import type { Argonaut } from './party.ts';
import { checkGate, gateValues } from './rules-assistance.ts';
import type { GateValues } from './rules-assistance.ts';
import { assignedPatternSources } from './references.ts';

export type CombatModifier = 'precision' | 'speed';
export interface StatContribution { source: string; amount: number }
export interface StatAdjustment { delta: number; contributions: StatContribution[] }
export const MODIFIED_STAT_COLOUR = '#B3261E';
const adjustment = (contributions: StatContribution[]): StatAdjustment => ({ delta: contributions.reduce((sum, item) => sum + item.amount, 0), contributions });

/** Only complete, cost-free numerical passive statements. Timing, token gains and prose remain manual. */
export function passiveGearModifiers(face: Extract<CardFace, { kind: 'gear' }>, values: GateValues): { precision: number; speed: number } {
  const totals = { precision: 0, speed: 0 };
  const groups = [{ abilities: face.data.abilities }, ...objects(face.data.gatedAbilities)];
  for (const group of groups) {
    const gate = displayGate(group);
    if (gate && checkGate(gate, values).status !== 'met') continue;
    for (const ability of objects(group.abilities)) {
      if ((ability.costs != null && (!Array.isArray(ability.costs) || ability.costs.length > 0)) || displayGate(ability)) continue;
      const tokens = objects(ability.abilityText);
      if (!tokens.length || tokens.some(token => !['plainText', 'whitespace', 'icon'].includes(String(token.type)))) continue;
      const text = tokens.map(token => String(token.value ?? '')).join('').replace(/\s+/g, ' ').trim();
      const leading = /^(?:Gain )?([+-]\d+) (Precision|Speed)$/.exec(text);
      const trailing = /^(Precision|Speed) ([+-]\d+)$/.exec(text);
      if (!leading && !trailing) continue;
      const amount = Number(leading?.[1] ?? trailing?.[2]);
      const name = (leading?.[2] ?? trailing?.[1])?.toLowerCase() as CombatModifier;
      if (Number.isSafeInteger(amount)) totals[name] += amount;
    }
  }
  return totals;
}

/** Pattern gates may sit directly on an ability (Chronian Strain), unlike Gear's grouped gates. */
export function passivePatternModifiers(face: CardFace, values: GateValues): { precision: number; speed: number } {
  const totals = { precision: 0, speed: 0 };
  if (face.family !== 'Pattern') return totals;
  for (const ability of objects(face.data.abilities)) {
    if (ability.costs != null && (!Array.isArray(ability.costs) || ability.costs.length > 0)) continue;
    const gate = displayGate(ability);
    if (gate && checkGate(gate, values).status !== 'met') continue;
    const tokens = objects(ability.abilityText);
    if (!tokens.length || tokens.some(token => !['plainText', 'whitespace', 'icon'].includes(String(token.type)))) continue;
    const text = tokens.map(token => String(token.value ?? '')).join('').replace(/\s+/g, ' ').trim();
    const leading = /^(?:Gain )?([+-]\d+) (Precision|Speed)$/.exec(text);
    const trailing = /^(Precision|Speed) ([+-]\d+)$/.exec(text);
    if (!leading && !trailing) continue;
    const amount = Number(leading?.[1] ?? trailing?.[2]);
    const name = (leading?.[2] ?? trailing?.[1])?.toLowerCase() as CombatModifier;
    if (Number.isSafeInteger(amount)) totals[name] += amount;
  }
  return totals;
}

/** Printed definitions stay immutable. Each equipped instance contributes once, even with multiple hands. */
export function combatAdjustments(argonaut: Argonaut, catalogue: CatalogueRepository): Map<CardFace, Partial<Record<CombatModifier, StatAdjustment>>> {
  const result = new Map<CardFace, Partial<Record<CombatModifier, StatAdjustment>>>();
  const active = loadoutState(argonaut, catalogue).activeInstanceIds, values = gateValues(argonaut, catalogue);
  const gear = argonaut.instances.flatMap(instance => {
    const face = catalogue.getFace(instance.definitionId, instance.faceId);
    return active.has(instance.id) && !instance.discarded && face?.kind === 'gear'
      ? [{ face, modifiers: passiveGearModifiers(face, values) }] : [];
  });
  const manual = (name: CombatModifier): StatContribution[] => argonaut.combatModifiers?.[name]
    ? [{ source: `${name === 'precision' ? 'Precision' : 'Speed'} modifier tokens`, amount: argonaut.combatModifiers[name] }] : [];
  const patterns = assignedPatternSources(argonaut, catalogue).flatMap(source => {
    const face = catalogue.getFace(source.definition.id, source.instance.faceId);
    return face ? [{ face, modifiers: passivePatternModifiers(face, values) }] : [];
  });
  const patternContributions = (name: CombatModifier) => patterns.filter(item => item.modifiers[name])
    .map(({ face, modifiers }) => ({ source: face.name, amount: modifiers[name] }));
  const localPrecision = (face: Extract<CardFace, { kind: 'gear' }>) => /Hands?/.test(face.data.slot) || Boolean(face.data.offensiveStatistics.precision);
  const globalPrecision = gear.filter(({ face }) => !localPrecision(face))
    .filter(({ modifiers }) => modifiers.precision).map(({ face, modifiers }) => ({ source: face.name, amount: modifiers.precision }));
  for (const { face, modifiers } of gear) {
    result.set(face, { precision: adjustment([...manual('precision'), ...globalPrecision, ...patternContributions('precision'),
      ...(modifiers.precision && localPrecision(face) ? [{ source: face.name, amount: modifiers.precision }] : [])]) });
  }
  const titan = argonaut.titan && catalogue.getFace(argonaut.titan.definitionId, argonaut.titan.faceId);
  if (titan?.kind === 'titan') result.set(titan, { speed: adjustment([...manual('speed'), ...patternContributions('speed'), ...gear.filter(item => item.modifiers.speed)
    .map(({ face, modifiers }) => ({ source: face.name, amount: modifiers.speed }))]) });
  return result;
}

/** Symbolic/conditional values keep their exact printed form; only plain integer values are calculated. */
export function adjustedStat(printed: string, modifier?: StatAdjustment): { text: string; changed: boolean; label: string } {
  const delta = modifier?.delta ?? 0;
  if (!printed || !delta) return { text: printed, changed: false, label: printed };
  const base = /^[+-]?\d+$/.test(printed) ? Number(printed) : NaN, total = base + delta;
  const signed = delta > 0 ? `+${delta}` : String(delta);
  const text = Number.isSafeInteger(base) && Number.isSafeInteger(total)
    ? `${printed.startsWith('+') && total >= 0 ? '+' : ''}${total}` : `${printed} (${signed})`;
  return { text, changed: true, label: `${text}; printed ${printed}; ${modifier?.contributions.map(item => `${item.source}: ${item.amount > 0 ? '+' : ''}${item.amount}`).join(', ')}` };
}
