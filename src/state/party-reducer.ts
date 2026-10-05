import { allocatedGear, inventoryFor, inventoryAllowsEquipment, inventoryAllowsTitan, physicalGearLimit } from '../domain/inventory.ts';
import type { Argonaut, CardInstance, CardReference, ConditionRecord, MemoryProgress, Party, SkillName } from '../domain/party.ts';
import { assignMemory, changeMemoryNodes, memoryConflict, removeMemory, updateMemory } from '../domain/memories.ts';
import type { MemoryKind, MemoryRequest } from '../domain/memories.ts';
import { overrideKey, supportsPattern } from '../domain/references.ts';
import type { PatternKind } from '../domain/pattern-table.ts';
import { isColour } from '../domain/party.ts';
import type { CatalogueRepository } from '../catalogue/repository.ts';
import { changeEquipmentFace, unlinkRemovedHost, planEquipment, removeEquipment } from '../domain/loadout.ts';
import type { EquipRequest } from '../domain/loadout.ts';
import { argonautSkills, argonautSkillModifiers, SKILL_MAX, SKILL_MIN } from '../domain/argonaut-stats.ts';
import { changeArgonautIdentity } from '../domain/argonaut-identity.ts';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign.ts';
import { canDiscardCard, canExhaustCard } from '../domain/ability-costs.ts';
import { changeToken, isCampaignCycle } from '../domain/tokens.ts';
import type { CampaignCycle, TokenName } from '../domain/tokens.ts';
import { conditionRecords, conditionReverse, removeCondition, setCondition, supportsCondition, validCondition } from '../domain/conditions.ts';
import { clearAllArgonauts, refreshArgonautCards } from '../domain/battle-reset.ts';
import { AFFLICTIONS } from '../domain/afflictions.ts';
import type { AfflictionId } from '../domain/afflictions.ts';
import { setAbilityExhausted } from '../domain/ability-state.ts';

export type CounterName = keyof Argonaut['counters'];
export type PartyAction =
  | { type: 'inventory-mode'; argonautId: string; partyId: string; enabled: boolean }
  | { type: 'inventory-quantity'; argonautId: string; partyId: string; definitionId: string; delta: -1 | 1; confirmed?: boolean }
  | { type: 'inventory-titan'; argonautId: string; partyId: string; definitionId: string; acquired: boolean; confirmed?: boolean }
  | { type: 'campaign-notes'; argonautId: string; partyId: string; text: string }
  | { type: 'select'; argonautId: string }
  | { type: 'campaign-cycle'; argonautId: string; cycle: CampaignCycle }
  | { type: 'rules-assistance'; argonautId: string; partyId: string; enabled: boolean }
  | { type: 'token'; argonautId: string; token: TokenName; delta: -1 | 1 }
  | { type: 'combat-modifier'; argonautId: string; modifier: 'precision' | 'speed'; delta: -1 | 1 }
  | { type: 'reset-tokens'; argonautId: string }
  | { type: 'condition'; argonautId: string; condition: ConditionRecord }
  | { type: 'condition-flip'; argonautId: string; id: string; reference: CardReference }
  | { type: 'remove-condition'; argonautId: string; id: string }
  | { type: 'reset-conditions'; argonautId: string }
  | { type: 'clear-all'; argonautId: string; partyId: string; confirmed: boolean }
  | { type: 'refresh-gear'; argonautId: string }
  | { type: 'resource'; argonautId: string; name: string; delta: -1 | 1 }
  | { type: 'remove-resource'; argonautId: string; name: string }
  | { type: 'reset-resources'; argonautId: string }
  | { type: 'argonaut-change'; argonautId: string; name: string; definitionId: string | null; confirmed: boolean; partyId: string; expectedName: string; expectedDefinitionId: string | null }
  | { type: 'argonaut-rename'; argonautId: string; name: string; partyId: string; expectedName: string; expectedDefinitionId: string | null }
  | { type: 'colour'; argonautId: string; colour: string }
  | { type: 'notes'; argonautId: string; partyId: string; text: string }
  | { type: 'add-affliction'; argonautId: string; partyId: string; id: AfflictionId }
  | { type: 'remove-affliction'; argonautId: string; partyId: string; id: AfflictionId; confirmed: boolean }
  | { type: 'skill'; argonautId: string; skill: SkillName; delta: -1 | 1 }
  | { type: 'counter'; argonautId: string; counter: CounterName; value: number; confirmOverflow?: boolean }
  | { type: 'titan'; argonautId: string; titan: CardInstance | null }
  | { type: 'titan-face'; argonautId: string; faceId: 'front' | 'back' }
  | { type: 'titan-exhausted'; argonautId: string; exhausted: boolean }
  | { type: 'ability-exhausted'; argonautId: string; instanceId: string; definitionId: string; faceId: 'front' | 'back'; abilityId: string; exhausted: boolean }
  | { type: 'titan-discarded'; argonautId: string; instanceId: string; discarded: boolean }
  | { type: 'memory'; argonautId: string; request: MemoryRequest }
  | { type: 'remove-memory'; argonautId: string; kind: MemoryKind; index: number }
  | { type: 'memory-state'; argonautId: string; instanceId: string; faceId?: 'front' | 'back'; exhausted?: boolean; discarded?: boolean; progress?: Partial<MemoryProgress> }
  | { type: 'memory-node'; argonautId: string; instanceId: string; delta: -1 | 1 }
  | { type: 'table-override'; argonautId: string; kind: PatternKind; reference: CardReference | null }
  | { type: 'equip'; argonautId: string; request: EquipRequest }
  | { type: 'remove-equipment'; argonautId: string; instanceId: string }
  | { type: 'equipment-face'; argonautId: string; instanceId: string; faceId: 'front' | 'back' }
  | { type: 'equipment-exhausted'; argonautId: string; instanceId: string; exhausted: boolean }
  | { type: 'equipment-discarded'; argonautId: string; instanceId: string; discarded: boolean }
  | { type: 'equipment-effect'; argonautId: string; instanceId: string; effectId: string; enabled: boolean; condition?: boolean }
  | { type: 'preview-loadout'; argonautId: string; instances: CardInstance[]; equipment: Argonaut['equipment'] };

/** Every edit names its owner explicitly, including callbacks opened before navigation. */
export function partyReducer(party: Party, action: PartyAction, catalogue?: CatalogueRepository): Party {
  if (!party.order.includes(action.argonautId)) return party;
  if (action.type === 'campaign-notes') return action.partyId === party.id && typeof action.text === 'string' && action.text !== (party.campaignNotes ?? '') ? { ...party, campaignNotes: action.text } : party;
  if (action.type === 'inventory-mode') return catalogue && action.partyId === party.id && typeof action.enabled === 'boolean'
    ? { ...party, inventory: { ...inventoryFor(party, catalogue), enforce: action.enabled } } : party;
  if (action.type === 'inventory-quantity') {
    if (!catalogue || action.partyId !== party.id || ![-1, 1].includes(action.delta)) return party;
    const inventory = inventoryFor(party, catalogue), card = catalogue.get(action.definitionId);
    const old = Object.hasOwn(inventory.gear, action.definitionId) ? inventory.gear[action.definitionId] : 0, count = old + action.delta;
    const limit = card ? physicalGearLimit(card, catalogue) : null;
    if (!Number.isSafeInteger(count) || count < 0 || count < (allocatedGear(party, catalogue)[action.definitionId] ?? 0)
      || action.delta > 0 && (!card || card.family !== 'Gear' || !card.faces.some(face => isFaceAvailableInCycle(face, campaignCycle(party))) || limit !== null && count > limit)
      || count === 0 && action.confirmed !== true) return party;
    const gear = { ...inventory.gear };
    if (count === 0) delete gear[action.definitionId]; else gear[action.definitionId] = count;
    return { ...party, inventory: { ...inventory, gear } };
  }
  if (action.type === 'inventory-titan') {
    if (!catalogue || action.partyId !== party.id || typeof action.acquired !== 'boolean') return party;
    const inventory = inventoryFor(party, catalogue), card = catalogue.get(action.definitionId);
    if (action.acquired && (!card || card.family !== 'Titan' || !card.faces.some(face => isFaceAvailableInCycle(face, campaignCycle(party))))
      || !action.acquired && (action.confirmed !== true || party.argonauts.some(member => member.titan?.definitionId === action.definitionId))) return party;
    const titans = new Set(inventory.titans);
    if (action.acquired) titans.add(action.definitionId); else titans.delete(action.definitionId);
    return { ...party, inventory: { ...inventory, titans: [...titans] } };
  }
  if (action.type === 'rules-assistance') return action.partyId === party.id && typeof action.enabled === 'boolean' && Boolean(party.rulesAssistance) !== action.enabled
    ? { ...party, rulesAssistance: action.enabled } : party;
  if (action.type === 'clear-all') return action.confirmed === true && action.partyId === party.id ? clearAllArgonauts(party) : party;
  if (action.type === 'select') return party.activeArgonautId === action.argonautId ? party : { ...party, activeArgonautId: action.argonautId };
  if (action.type === 'campaign-cycle') return isCampaignCycle(action.cycle) && party.campaignCycle !== action.cycle ? { ...party, campaignCycle: action.cycle } : party;
  if (action.type === 'resource') {
    const name = action.name.trim(), value = (Object.hasOwn(party.resources, name) ? party.resources[name] : 0) + action.delta;
    return name && name.length <= 80 && [-1, 1].includes(action.delta) && Number.isSafeInteger(value) && value >= 0
      ? { ...party, resources: { ...party.resources, [name]: value } } : party;
  }
  if (action.type === 'remove-resource') {
    if (!Object.hasOwn(party.resources, action.name)) return party;
    const resources = { ...party.resources }; delete resources[action.name];
    return { ...party, resources };
  }
  if (action.type === 'reset-resources') return Object.values(party.resources).some(value => value !== 0)
    ? { ...party, resources: Object.fromEntries(Object.keys(party.resources).map(name => [name, 0])) } : party;
  const current = party.argonauts.find(argonaut => argonaut.id === action.argonautId)!;
  let updated = current;
  switch (action.type) {
    case 'add-affliction': {
      const definition = AFFLICTIONS.find(affliction => affliction.id === action.id);
      if (action.partyId === party.id && definition && definition.cycle <= campaignCycle(party) && !current.afflictions?.includes(action.id)) updated = { ...current, afflictions: [...(current.afflictions ?? []), action.id] };
      break;
    }
    case 'remove-affliction':
      if (action.partyId === party.id && action.confirmed === true && current.afflictions?.includes(action.id)) updated = { ...current, afflictions: current.afflictions.filter(id => id !== action.id) };
      break;
    case 'notes':
      if (action.partyId === party.id && typeof action.text === 'string' && action.text !== (current.notes ?? '')) updated = { ...current, notes: action.text };
      break;
    case 'refresh-gear': updated = refreshArgonautCards(current); break;
    case 'ability-exhausted': {
      const item = current.titan?.id === action.instanceId ? current.titan : current.instances.find(item => item.id === action.instanceId
        && [...current.mnemosIds, ...current.fatedMnemosIds].includes(item.id));
      if (!item || item.definitionId !== action.definitionId || item.faceId !== action.faceId) break;
      const face = catalogue?.getFace(item.definitionId, item.faceId);
      const next = setAbilityExhausted(item, face, action.abilityId, action.exhausted);
      if (next !== item) updated = current.titan === item ? { ...current, titan: next }
        : { ...current, instances: current.instances.map(entry => entry === item ? next : entry) };
      break;
    }
    case 'combat-modifier': {
      if (!['precision', 'speed'].includes(action.modifier) || ![-1, 1].includes(action.delta)) break;
      const modifiers = current.combatModifiers ?? { precision: 0, speed: 0 };
      const value = modifiers[action.modifier] + action.delta;
      if (Number.isSafeInteger(value)) updated = { ...current, combatModifiers: { ...modifiers, [action.modifier]: value } };
      break;
    }
    case 'token': updated = changeToken(current, action.token, action.delta); break;
    case 'reset-tokens':
      if (Object.values(current.tokens).some(value => value !== 0)) updated = { ...current, tokens: Object.fromEntries(Object.keys(current.tokens).map(name => [name, 0])) };
      break;
    case 'condition': {
      if (!validCondition(action.condition)) break;
      const ref = action.condition.reference;
      if (!ref || supportsCondition(catalogue?.getFace(ref.definitionId, ref.faceId))) updated = setCondition(current, action.condition, catalogue);
      break;
    }
    case 'condition-flip': {
      const condition = conditionRecords(current).find(record => record.id === action.id);
      if (!catalogue || !condition?.reference || condition.reference.definitionId !== action.reference.definitionId || condition.reference.faceId !== action.reference.faceId) break;
      const nextFace = conditionReverse(condition.reference, catalogue);
      if (nextFace) updated = setCondition(current, { ...condition, name: nextFace.name, reference: { ...condition.reference, faceId: nextFace.id } }, catalogue);
      break;
    }
    case 'remove-condition': updated = removeCondition(current, action.id); break;
    case 'reset-conditions':
      if (current.localConditions.length || current.conditions?.length) updated = { ...current, localConditions: [], conditions: [] };
      break;
    case 'memory': {
      if (!catalogue || party.argonauts.some(member => member.id === action.request.instanceId || member.id !== current.id && (member.titan?.id === action.request.instanceId || member.instances.some(instance => instance.id === action.request.instanceId)))) break;
      if (memoryConflict(party, action.request.definitionId, { argonautId: current.id, kind: action.request.kind, index: action.request.index })) break;
      updated = assignMemory(current, action.request, catalogue); break;
    }
    case 'remove-memory': updated = removeMemory(current, action.kind, action.index); break;
    case 'memory-state': if (catalogue) updated = updateMemory(current, action.instanceId, action, catalogue); break;
    case 'memory-node': if (catalogue) updated = changeMemoryNodes(current, action.instanceId, action.delta, catalogue); break;
    case 'table-override':
      if (['Trauma', 'Kratos'].includes(action.kind) && (action.reference === null || catalogue && supportsPattern(catalogue.getFace(action.reference.definitionId, action.reference.faceId), action.kind))) updated = { ...current, tableOverrides: { ...current.tableOverrides, [overrideKey(action.kind)]: action.reference } };
      break;
    case 'titan-face':
      if (current.titan && catalogue?.getFace(current.titan.definitionId, action.faceId)?.kind === 'titan') updated = { ...current, titan: { ...current.titan, faceId: action.faceId } };
      break;
    case 'titan-exhausted':
      if (current.titan && (action.exhausted === false || action.exhausted === true && !current.titan.discarded && canExhaustCard(catalogue?.getFace(current.titan.definitionId, current.titan.faceId)))) updated = { ...current, titan: { ...current.titan, exhausted: action.exhausted,
        ...(action.exhausted === false && current.titan.exhaustedAbilityIds ? { exhaustedAbilityIds: [] } : {}) } };
      break;
    case 'titan-discarded':
      if (current.titan?.id === action.instanceId && (action.discarded === false || action.discarded === true && canDiscardCard(catalogue?.getFace(current.titan.definitionId, current.titan.faceId)))) updated = { ...current, titan: { ...current.titan, discarded: action.discarded, ...(action.discarded ? { exhausted: false,
        ...(current.titan.exhaustedAbilityIds ? { exhaustedAbilityIds: [] } : {}) } : {}) } };
      break;
    case 'argonaut-change':
      if (catalogue && action.confirmed === true && action.partyId === party.id && action.expectedName === current.name && action.expectedDefinitionId === current.argonautDefinitionId) {
        updated = changeArgonautIdentity(current, action, campaignCycle(party), catalogue);
      }
      break;
    case 'argonaut-rename': {
      const name = typeof action.name === 'string' ? action.name.trim() : '';
      if (name && name.length <= 60 && name !== current.name && action.partyId === party.id && action.expectedName === current.name && action.expectedDefinitionId === current.argonautDefinitionId) updated = { ...current, name };
      break;
    }
    case 'colour':
      if (isColour(action.colour)) updated = { ...current, colour: action.colour.toUpperCase() };
      break;
    case 'skill': {
      if (![-1, 1].includes(action.delta)) break;
      const bonus = catalogue ? argonautSkillModifiers(current, catalogue)[action.skill] : 0;
      const displayed = catalogue ? argonautSkills(current, catalogue)[action.skill] : Math.max(SKILL_MIN, Math.min(SKILL_MAX, current.skills[action.skill]));
      const value = displayed + action.delta;
      if (Number.isSafeInteger(value) && value >= SKILL_MIN && value <= SKILL_MAX) updated = { ...current, skills: { ...current.skills, [action.skill]: value - bonus } };
      break;
    }
    case 'counter':
      if (Number.isSafeInteger(action.value) && action.value >= 0 && (action.value <= 9 || action.confirmOverflow || action.value < current.counters[action.counter])) {
        updated = { ...current, counters: { ...current.counters, [action.counter]: action.value } };
      }
      break;
    case 'titan': {
      if (party.inventory?.enforce && action.titan && action.titan.definitionId !== current.titan?.definitionId && (!catalogue || !inventoryAllowsTitan(party, action.titan.definitionId, action.titan.faceId, catalogue))) break;
      const detached = current.titan && (current.titan.definitionId !== action.titan?.definitionId || current.titan.id !== action.titan?.id) ? unlinkRemovedHost(current, current.titan.id) : current;
      updated = { ...detached, titan: action.titan }; break;
    }
    case 'equip': {
      if (!catalogue) break;
      const usedElsewhere = party.argonauts.some(member => member.id !== current.id && (member.titan?.id === action.request.instanceId || member.instances.some(item => item.id === action.request.instanceId))) || party.argonauts.some(member => member.id === action.request.instanceId);
      if (usedElsewhere) break;
      const next = planEquipment(current, action.request, catalogue).next;
      if (next && inventoryAllowsEquipment(party, current, next, catalogue)) updated = next;
      break;
    }
    case 'remove-equipment': updated = removeEquipment(current, action.instanceId); break;
    case 'equipment-face':
      if (catalogue) updated = changeEquipmentFace(current, action.instanceId, action.faceId, catalogue);
      break;
    case 'equipment-exhausted': {
      const item = current.instances.find(item => item.id === action.instanceId);
      if (item && current.equipment.some(entry => entry.instanceId === item.id) && (action.exhausted === false || action.exhausted === true && !item.discarded && catalogue?.getFace(item.definitionId, item.faceId)?.kind === 'gear')) updated = { ...current, instances: current.instances.map(item => item.id === action.instanceId ? { ...item, exhausted: action.exhausted } : item) };
      break;
    }
    case 'equipment-discarded': {
      const item = current.instances.find(item => item.id === action.instanceId);
      if (item && current.equipment.some(entry => entry.instanceId === item.id) && (action.discarded === false || action.discarded === true && catalogue?.getFace(item.definitionId, item.faceId)?.kind === 'gear')) updated = { ...current, instances: current.instances.map(entry => entry.id === item.id ? { ...entry, discarded: action.discarded, ...(action.discarded ? { exhausted: false } : {}) } : entry) };
      break;
    }
    case 'equipment-effect': {
      const item = current.instances.find(item => item.id === action.instanceId), face = item && catalogue?.getFace(item.definitionId, item.faceId);
      const effect = face?.slotEffects.find(effect => effect.id === action.effectId);
      if (!item || !effect || !current.equipment.some(entry => entry.instanceId === item.id) || (action.condition ? effect.conditions.length === 0 : effect.activation !== 'optional-loadout')) break;
      const key = action.condition ? 'satisfiedEffectIds' : 'enabledEffectIds';
      const values = new Set(item[key] || []);
      if (action.enabled) values.add(effect.id); else values.delete(effect.id);
      updated = { ...current, instances: current.instances.map(entry => entry.id === item.id ? { ...entry, [key]: [...values] } : entry) }; break;
    }
    case 'preview-loadout': updated = { ...current, instances: action.instances, equipment: action.equipment }; break;
  }
  return updated === current ? party : { ...party, argonauts: party.argonauts.map(argonaut => argonaut.id === updated.id ? updated : argonaut) };
}

export function adjacentArgonautId(order: readonly string[], currentId: string, direction: -1 | 1): string | undefined {
  const index = order.indexOf(currentId);
  return index < 0 ? undefined : order[index + direction];
}
