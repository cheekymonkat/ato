import type { Argonaut } from './party.ts';

import type { CampaignCycle } from './campaign.ts';
export { CAMPAIGN_CYCLES, campaignCycle, isCampaignCycle } from './campaign.ts';
export type { CampaignCycle } from './campaign.ts';
export const TOKEN_TYPES = [
  { name: 'Ambrosia', firstCycle: 1 },
  { name: 'Despair', firstCycle: 1 },
  { name: 'Bleeding', firstCycle: 3 },
  { name: 'Midas', firstCycle: 4 },
  { name: 'Pain', firstCycle: 4 },
  { name: 'Oxygen', firstCycle: 5 },
  { name: 'Aether', firstCycle: 5 },
] as const;
export type TokenName = typeof TOKEN_TYPES[number]['name'];

export function isTokenName(value: unknown): value is TokenName {
  return TOKEN_TYPES.some(token => token.name === value);
}
export function tokenTypesForCycle(cycle: CampaignCycle) {
  return TOKEN_TYPES.filter(token => cycle >= token.firstCycle);
}
export function tokenCount(argonaut: Argonaut, token: TokenName): number {
  return argonaut.tokens[token] ?? 0;
}
/** Counts are manual. Limits and card effects must not silently clamp or resolve them. */
export function changeToken(argonaut: Argonaut, token: TokenName, delta: -1 | 1): Argonaut {
  if (!isTokenName(token) || ![-1, 1].includes(delta)) return argonaut;
  const value = tokenCount(argonaut, token) + delta;
  if (!Number.isSafeInteger(value) || value < 0) return argonaut;
  return { ...argonaut, tokens: { ...argonaut.tokens, [token]: value } };
}
