import type { Argonaut, CardInstance, Party, SkillName } from '../domain/party.ts';
import { isColour } from '../domain/party.ts';
import type { CatalogueRepository } from '../catalogue/repository.ts';
import { changeEquipmentFace, unlinkRemovedHost, planEquipment, removeEquipment } from '../domain/loadout.ts';
import type { EquipRequest } from '../domain/loadout.ts';

export type CounterName = keyof Argonaut['counters'];
export type PartyAction =
  | { type: 'select'; argonautId: string }
  | { type: 'name'; argonautId: string; name: string }
  | { type: 'colour'; argonautId: string; colour: string }
  | { type: 'skill'; argonautId: string; skill: SkillName; delta: -1 | 1 }
  | { type: 'counter'; argonautId: string; counter: CounterName; value: number; confirmOverflow?: boolean }
  | { type: 'titan'; argonautId: string; titan: CardInstance | null }
  | { type: 'equip'; argonautId: string; request: EquipRequest }
  | { type: 'remove-equipment'; argonautId: string; instanceId: string }
  | { type: 'equipment-face'; argonautId: string; instanceId: string; faceId: 'front' | 'back' }
  | { type: 'equipment-exhausted'; argonautId: string; instanceId: string; exhausted: boolean }
  | { type: 'equipment-effect'; argonautId: string; instanceId: string; effectId: string; enabled: boolean; condition?: boolean }
  | { type: 'preview-loadout'; argonautId: string; instances: CardInstance[]; equipment: Argonaut['equipment'] };

/** Every edit names its owner explicitly, including callbacks opened before navigation. */
export function partyReducer(party: Party, action: PartyAction, catalogue?: CatalogueRepository): Party {
  if (!party.order.includes(action.argonautId)) return party;
  if (action.type === 'select') return party.activeArgonautId === action.argonautId ? party : { ...party, activeArgonautId: action.argonautId };
  const current = party.argonauts.find(argonaut => argonaut.id === action.argonautId)!;
  let updated = current;
  switch (action.type) {
    case 'name': updated = { ...current, name: action.name.slice(0, 60) }; break;
    case 'colour':
      if (isColour(action.colour)) updated = { ...current, colour: action.colour.toUpperCase() };
      break;
    case 'skill': {
      const value = current.skills[action.skill] + action.delta;
      if (Number.isSafeInteger(value) && value >= 0) updated = { ...current, skills: { ...current.skills, [action.skill]: value } };
      break;
    }
    case 'counter':
      if (Number.isSafeInteger(action.value) && action.value >= 0 && (action.value <= 9 || action.confirmOverflow || action.value < current.counters[action.counter])) {
        updated = { ...current, counters: { ...current.counters, [action.counter]: action.value } };
      }
      break;
    case 'titan': {
      const detached = current.titan && (current.titan.definitionId !== action.titan?.definitionId || current.titan.id !== action.titan?.id) ? unlinkRemovedHost(current, current.titan.id) : current;
      updated = { ...detached, titan: action.titan }; break;
    }
    case 'equip': {
      if (!catalogue) break;
      const usedElsewhere = party.argonauts.some(member => member.id !== current.id && (member.titan?.id === action.request.instanceId || member.instances.some(item => item.id === action.request.instanceId))) || party.argonauts.some(member => member.id === action.request.instanceId);
      if (usedElsewhere) break;
      updated = planEquipment(current, action.request, catalogue).next || current; break;
    }
    case 'remove-equipment': updated = removeEquipment(current, action.instanceId); break;
    case 'equipment-face':
      if (catalogue) updated = changeEquipmentFace(current, action.instanceId, action.faceId, catalogue);
      break;
    case 'equipment-exhausted':
      if (current.equipment.some(entry => entry.instanceId === action.instanceId)) updated = { ...current, instances: current.instances.map(item => item.id === action.instanceId ? { ...item, exhausted: action.exhausted } : item) };
      break;
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
