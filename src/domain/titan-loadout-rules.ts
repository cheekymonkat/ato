import { visitJson } from './json.ts';
import type { JsonValue } from './json.ts';

export interface TitanWeaponRules {
  /** Equipment capacity, not an anatomical arm count. */
  handSlots: number;
  supportSlots: number;
  allowedWeaponHands: number[];
  conversions: { printedHands: number; occupiedHands: number; supportPenalty: number; ability: string }[];
  alternative: { mode: 'support'; handSlots: number; supportSlots: number } | null;
  sourceAbilities: string[];
}

/** Audited against data/reference/titanAbilityData.json. Keep source tokens unchanged. */
export const TITAN_LOADOUT_RULES_VERSION = 1;
export function deriveTitanWeaponRules(abilities: JsonValue[]): TitanWeaponRules {
  const rules: TitanWeaponRules = { handSlots: 2, supportSlots: 2, allowedWeaponHands: [1, 2, 3],
    conversions: [], alternative: null, sourceAbilities: [] };
  const keywords = new Set<string>();
  visitJson(abilities, token => { if (token.type === 'keyword' && typeof token.value === 'string') keywords.add(token.value); });
  for (const keyword of keywords) {
    switch (keyword) {
      case 'Cyclopean Might': case 'Elder Might': case 'Unknown Might': case 'Lightweight Curse':
        rules.conversions.push({ printedHands: 3, occupiedHands: 2, supportPenalty: keyword === 'Unknown Might' ? 1 : 0, ability: keyword });
        if (keyword === 'Lightweight Curse') rules.allowedWeaponHands = [2, 3];
        break;
      case 'Four-Armed Centimanes': rules.handSlots = 4; rules.allowedWeaponHands = [1]; break;
      case 'Nimble Feet': rules.handSlots = 3; rules.allowedWeaponHands = [1, 2]; break;
      case 'Six-Armed': rules.handSlots = 3; rules.alternative = { mode: 'support', handSlots: 2, supportSlots: 3 }; break;
      case 'Stout': rules.supportSlots = 3; break;
      default: continue;
    }
    rules.sourceAbilities.push(keyword);
  }
  return rules;
}
