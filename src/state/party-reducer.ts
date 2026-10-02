import type { Argonaut, CardInstance, Party, SkillName } from '../domain/party.ts';
import { isColour } from '../domain/party.ts';

export type CounterName = keyof Argonaut['counters'];
export type PartyAction =
  | { type: 'select'; argonautId: string }
  | { type: 'name'; argonautId: string; name: string }
  | { type: 'colour'; argonautId: string; colour: string }
  | { type: 'skill'; argonautId: string; skill: SkillName; delta: -1 | 1 }
  | { type: 'counter'; argonautId: string; counter: CounterName; value: number; confirmOverflow?: boolean }
  | { type: 'titan'; argonautId: string; titan: CardInstance | null }
  | { type: 'preview-loadout'; argonautId: string; instances: CardInstance[]; equipment: Argonaut['equipment'] };

/** Every edit names its owner explicitly, including callbacks opened before navigation. */
export function partyReducer(party: Party, action: PartyAction): Party {
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
    case 'titan': updated = { ...current, titan: action.titan }; break;
    case 'preview-loadout': updated = { ...current, instances: action.instances, equipment: action.equipment }; break;
  }
  return updated === current ? party : { ...party, argonauts: party.argonauts.map(argonaut => argonaut.id === updated.id ? updated : argonaut) };
}

export function adjacentArgonautId(order: readonly string[], currentId: string, direction: -1 | 1): string | undefined {
  const index = order.indexOf(currentId);
  return index < 0 ? undefined : order[index + direction];
}
