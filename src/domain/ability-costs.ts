import type { CardFace } from './cards.ts';
import { visitJson } from './json.ts';
import type { JsonValue } from './json.ts';

/** Only explicit costs qualify; icons or mentions in effect/reward text do not. */
function hasCost(value: JsonValue | undefined, cost: 'Exhaust' | 'Discard'): boolean {
  let found = false;
  if (value !== undefined) visitJson(value, record => {
    if (Array.isArray(record.costs) && record.costs.includes(cost)) found = true;
  });
  return found;
}

export const hasExhaustCost = (value: JsonValue | undefined) => hasCost(value, 'Exhaust');
export const hasDiscardCost = (value: JsonValue | undefined) => hasCost(value, 'Discard');

function canPayCardCost(face: CardFace | undefined, cost: 'Exhaust' | 'Discard', fatedResolved: boolean): boolean {
  if (!face) return false;
  if (face.kind === 'fated-mnemos') return hasCost(fatedResolved ? face.data.growthAbility : face.data.effect, cost);
  return [face.data.abilities, face.data.gatedAbilities, face.data.asteriskEffect].some(value => hasCost(value, cost));
}
export const canExhaustCard = (face: CardFace | undefined, fatedResolved = false) => canPayCardCost(face, 'Exhaust', fatedResolved);
export const canDiscardCard = (face: CardFace | undefined, fatedResolved = false) => canPayCardCost(face, 'Discard', fatedResolved);
