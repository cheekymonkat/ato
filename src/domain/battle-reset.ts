import type { Argonaut, CardInstance, Party } from './party.ts';

function readyCard(instance: CardInstance): CardInstance {
  return instance.exhausted || instance.discarded ? { ...instance, exhausted: false, ...(instance.discarded ? { discarded: false } : {}) } : instance;
}
function resetArgonaut(member: Argonaut): Argonaut {
  const cards = [...member.instances, ...(member.titan ? [member.titan] : [])];
  const changed = member.localConditions.length || member.conditions?.length || Object.values(member.tokens).some(value => value !== 0)
    || member.combatModifiers && Object.values(member.combatModifiers).some(value => value !== 0)
    || member.counters.rage !== 0 || member.counters.fate !== 0 || member.counters.danger !== 0 || cards.some(card => card.exhausted || card.discarded);
  if (!changed) return member;
  return { ...member, localConditions: [], ...(member.conditions !== undefined ? { conditions: [] } : {}),
    tokens: Object.fromEntries(Object.keys(member.tokens).map(name => [name, 0])),
    ...(member.combatModifiers ? { combatModifiers: { precision: 0, speed: 0 } } : {}),
    counters: { ...member.counters, rage: 0, fate: 0, danger: 0 },
    instances: member.instances.map(readyCard), titan: member.titan ? readyCard(member.titan) : null };
}
/** One atomic reset for all four Argonauts; campaign data and card progress stay intact. */
export function clearAllArgonauts(party: Party): Party {
  const argonauts = party.argonauts.map(resetArgonaut);
  return argonauts.every((member, index) => member === party.argonauts[index]) ? party : { ...party, argonauts };
}
