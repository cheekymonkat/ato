import type { CardFace } from './cards.ts';
import { isRecord, visitJson } from './json.ts';
import { flattenAbilities } from './references.ts';
import type { createKeywordRepository } from './keywords.ts';
import { cardAbilities } from './ability-state.ts';

/** Keep headline costs/gates intact and associate each hover definition with its own ability. */
export function titanAbilityRows(face: Extract<CardFace, { kind: 'titan' }>, keywords: ReturnType<typeof createKeywordRepository>) {
  return cardAbilities(face).map(({ id, heading }) => {
    const names = new Set<string>();
    visitJson(heading, token => { if (token.type === 'keyword' && typeof token.value === 'string') names.add(token.value); });
    return { id, heading, details: [...names].map(name => ({ name, definition: keywords.resolve(name) })) };
  });
}

/** Only standalone passive keywords move to the dice/limit rows; paid and gated effects stay in the list. */
export function titanSymbolAbility(heading: unknown): { name: string; symbol: string; value: number; kind: 'dice' | 'limit' } | null {
  if (!isRecord(heading) || heading.gate || Array.isArray(heading.costs) && heading.costs.length || !Array.isArray(heading.abilityText) || heading.abilityText.length !== 1) return null;
  const token = heading.abilityText[0];
  if (!isRecord(token) || token.type !== 'keyword' || typeof token.value !== 'string') return null;
  const dice = /^(Auto-(black|break|hope)|Power Re-roll)\s+(\d+)$/i.exec(token.value);
  if (dice) return { name: token.value, symbol: dice[2] ? dice[2][0].toUpperCase() + dice[2].slice(1).toLowerCase() : 'PowerReroll', value: Number(dice[3]), kind: 'dice' };
  const limit = /^(Ambrosia|Bleeding|Despair) Limit\s+([+−-]?\d+)$/i.exec(token.value);
  return limit ? { name: token.value, symbol: limit[1], value: Number(limit[2].replace('−', '-')), kind: 'limit' } : null;
}
export function titanDiceModifiers(face: Extract<CardFace, { kind: 'titan' }>, rage = 0) {
  const dice = flattenAbilities(face.data.abilities).map(titanSymbolAbility).filter(symbol => symbol?.kind === 'dice');
  const truth = flattenAbilities(face.data.abilities).some(heading => isRecord(heading) && Array.isArray(heading.abilityText)
    && heading.abilityText.some(token => isRecord(token) && token.type === 'keyword' && token.value === 'The Truth'));
  if (truth && rage >= 7) dice.push({ name: 'Auto-hope 1', symbol: 'Hope', value: 1, kind: 'dice' });
  return dice;
}
