import type { CatalogueRepository } from '../catalogue/repository.ts';
import { argonautSkills, memorySkillModifiers } from './argonaut-stats.ts';
import { portraitSkill } from './argonaut-identity.ts';
import { displayGate, gateLabel, objects } from './card-presentation.ts';
import type { DisplayGate } from './card-presentation.ts';
import type { CardFace, SlotKind } from './cards.ts';
import { isRecord } from './json.ts';
import { loadoutState } from './loadout.ts';
import { SKILL_NAMES } from './party.ts';
import type { Argonaut, MemoryProgress } from './party.ts';
import { DEFAULT_BASELINE } from './slots.ts';
import { titanHandRule } from './hand-rules.ts';
import { TOKEN_TYPES } from './tokens.ts';
import { fatedMemorySide, memoryAbilityPanels } from './memory-presentation.ts';
import { memoryProgress } from './memories.ts';

export type GateStatus = 'met' | 'unmet' | 'review';
export interface GateCheck { status: GateStatus; explanation: string }
export const GATE_STATUS_LABELS: Record<GateStatus, string> = { met: 'Threshold met', unmet: 'Threshold unmet', review: 'Manual check' };

export interface GateValues {
  counters: Argonaut['counters'];
  tokens?: Record<string, number>;
  /** Known printed Gear traits include zero entries so absent traits are unmet, not unknown. */
  traits?: Record<string, number>;
}
const printedTraits = new WeakMap<CatalogueRepository, string[]>();

/** Equipped instances count once regardless of hand/attachment positions. Exhaustion retains traits. */
export function gateValues(argonaut: Argonaut, catalogue: CatalogueRepository): GateValues {
  let names = printedTraits.get(catalogue);
  if (!names) {
    names = [...new Set(catalogue.search({ family: 'Gear' }).flatMap(card => card.faces.flatMap(face => face.kind === 'gear' ? face.data.traits : [])))];
    printedTraits.set(catalogue, names);
  }
  const traits = Object.fromEntries(names.map(name => [name, 0]));
  const active = loadoutState(argonaut, catalogue).activeInstanceIds;
  for (const instance of argonaut.instances) {
    if (!active.has(instance.id) || instance.discarded) continue;
    const face = catalogue.getFace(instance.definitionId, instance.faceId);
    if (face?.kind === 'gear') for (const trait of new Set(face.data.traits)) traits[trait] += 1;
  }
  return { counters: argonaut.counters, tokens: Object.fromEntries(TOKEN_TYPES.map(({ name }) => [name, argonaut.tokens[name] ?? 0])), traits };
}

function threshold(type: string, value: string, context: GateValues): GateCheck {
  const key = ({ Rage: 'rage', Fate: 'fate', Danger: 'danger' } as const)[type as 'Rage' | 'Fate' | 'Danger'];
  // Explicit N+ syntax only: bare numbers and card-specific quantities are not guessed.
  const match = /^(\d+)\+$/.exec(value.trim()), minimum = match ? Number(match[1]) : NaN;
  const token = TOKEN_TYPES.some(item => item.name === type);
  const trait = !key && !token && context.traits && Object.hasOwn(context.traits, type);
  const current = key ? context.counters[key] : token ? context.tokens?.[type] : trait ? context.traits?.[type] : undefined;
  if (!Number.isSafeInteger(minimum) || minimum < 0 || typeof current !== 'number' || !Number.isSafeInteger(current) || current < 0) {
    return { status: 'review', explanation: `${type} ${value}: check the printed requirement manually.`.trim() };
  }
  const description = token ? `${type} tokens` : trait ? `equipped Gear with ${type}` : type;
  return { status: current >= minimum ? 'met' : 'unmet', explanation: `${description}: ${current}; requires ${minimum} or more.` };
}

/** Checks thresholds only, never costs, timing, card readiness or complete ability legality. */
export function checkGate(gate: DisplayGate, values: GateValues | Argonaut['counters']): GateCheck {
  const context: GateValues = 'counters' in values ? values : { counters: values };
  const first = threshold(gate.type, gate.value, context);
  if (!gate.type2 && !gate.combo) return first;
  if (!gate.type2 || !['OR', 'AND', '&'].includes(gate.combo || '') || !gate.value2) {
    return { status: 'review', explanation: `${gateLabel(gate)}: the combined requirement needs a manual check.` };
  }
  const second = threshold(gate.type2, gate.value2, context);
  const status = gate.combo === 'OR'
    ? first.status === 'met' || second.status === 'met' ? 'met' : first.status === 'unmet' && second.status === 'unmet' ? 'unmet' : 'review'
    : first.status === 'unmet' || second.status === 'unmet' ? 'unmet' : first.status === 'met' && second.status === 'met' ? 'met' : 'review';
  return { status, explanation: `${first.explanation} ${gate.combo === 'OR' ? 'Either requirement is enough.' : 'Both requirements are needed.'} ${second.explanation}` };
}

/** Distinct printed requirements, including offensive/defensive statistics and nested abilities. */
export function cardGates(face: CardFace, progress?: MemoryProgress): DisplayGate[] {
  const found = new Map<string, DisplayGate>();
  function walk(value: unknown) {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!isRecord(value)) return;
    const raw = value.gate;
    const gate = isRecord(raw) ? displayGate(raw) : typeof raw === 'string' ? displayGate({ ...value, type: raw }) : null;
    if (gate) found.set(JSON.stringify(gate), gate);
    for (const [key, child] of Object.entries(value)) if (key !== 'gate') walk(child);
  }
  if (face.kind === 'mnemos') walk(memoryAbilityPanels(face, progress).map(panel => panel.group));
  else if (face.kind === 'fated-mnemos') walk(fatedMemorySide(face, progress).ability);
  else walk(face.data);
  return [...found.values()];
}

/** Same assigned faces and visible memory panels as the dashboard; no hidden future node abilities. */
export function assignedGateCards(argonaut: Argonaut, catalogue: CatalogueRepository) {
  const assignedIds = new Set([...argonaut.equipment.map(entry => entry.instanceId), ...argonaut.mnemosIds, ...argonaut.fatedMnemosIds].filter(id => id !== null));
  const instances = [...argonaut.instances.filter(instance => assignedIds.has(instance.id)), ...(argonaut.titan ? [argonaut.titan] : [])];
  return instances.flatMap(instance => {
    const card = catalogue.get(instance.definitionId), face = catalogue.getFace(instance.definitionId, instance.faceId);
    if (!card || !face) return [];
    const progress = face.kind === 'mnemos' || face.kind === 'fated-mnemos' ? memoryProgress(instance) : undefined;
    const gates = cardGates(face, progress);
    const name = face.kind === 'fated-mnemos' ? fatedMemorySide(face, progress).name : face.name;
    return gates.length ? [{ instance, card, face, name, gates }] : [];
  });
}

/** Match the same contributions as the displayed dashboard, including its -9..9 bounds. */
export function skillBreakdown(argonaut: Argonaut, catalogue: CatalogueRepository) {
  const memories = memorySkillModifiers(argonaut, catalogue), totals = argonautSkills(argonaut, catalogue);
  const portrait = argonaut.argonautDefinitionId ? portraitSkill(catalogue.getFace(argonaut.argonautDefinitionId, 'front')) : null;
  return SKILL_NAMES.map(skill => ({ skill, manual: argonaut.skills[skill], portrait: skill === portrait ? 1 : 0,
    memories: memories[skill], raw: argonaut.skills[skill] + (skill === portrait ? 1 : 0) + memories[skill], total: totals[skill] }));
}

export interface LoadoutNotice { instanceIds: string[]; message: string; code: string }
export function loadoutReview(argonaut: Argonaut, catalogue: CatalogueRepository) {
  const state = loadoutState(argonaut, catalogue), notices: LoadoutNotice[] = [];
  const occupied = new Set(argonaut.equipment.filter(entry => state.activeInstanceIds.has(entry.instanceId)).flatMap(entry => entry.positionIds));
  const capacity = (['hand', 'armor', 'support', 'attachment'] as SlotKind[]).map(kind => ({ kind, baseline: DEFAULT_BASELINE[kind],
    available: state.positions.filter(position => position.kind === kind).length,
    occupied: state.positions.filter(position => position.kind === kind && occupied.has(position.id)).length,
    grants: state.positions.filter(position => position.kind === kind && position.source) }));
  const supportCopies = new Map<string, string[]>();
  for (const assignment of argonaut.equipment) {
    const instance = argonaut.instances.find(item => item.id === assignment.instanceId);
    const face = instance && catalogue.getFace(instance.definitionId, instance.faceId);
    if (assignment.override) notices.push({ instanceIds: [assignment.instanceId], code: 'override', message: `Manual placement exception: ${assignment.override.reason}` });
    if (state.activeInstanceIds.has(assignment.instanceId) && face?.kind === 'gear' && face.data.slot.split(',').map(value => value.trim()).includes('Support')) {
      const copies = supportCopies.get(instance!.definitionId) || [];
      copies.push(assignment.instanceId); supportCopies.set(instance!.definitionId, copies);
    }
    if (face?.kind === 'gear' && /\*|\d+ 1 Hands/.test(face.data.slot)) notices.push({ instanceIds: [assignment.instanceId], code: 'hands', message: 'Check this card’s variable hand requirement against its ability text.' });
  }
  for (const ids of supportCopies.values()) if (ids.length > 1) notices.push({ instanceIds: ids, code: 'duplicate-support', message: 'The base loadout rule allows one copy of the same Support card per Titan. Check for an explicit exception.' });
  for (const entry of state.pending) notices.push({ instanceIds: [entry.assignment.instanceId], code: 'pending', message: entry.reasons.join(' ') || 'This card needs reassignment.' });
  const titanFace = argonaut.titan && catalogue.getFace(argonaut.titan.definitionId, argonaut.titan.faceId);
  const unknownMight = titanFace?.kind === 'titan' && !argonaut.titan?.discarded && objects(titanFace.data.abilities).some(ability =>
    objects(ability.abilityText).some(token => token.type === 'keyword' && token.value === 'Unknown Might'));
  return { capacity, notices, handRule: titanHandRule(argonaut, catalogue), unknownMight: Boolean(unknownMight) };
}
