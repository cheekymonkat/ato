import type { CardDefinition, FaceId } from './cards.ts';

export const MILESTONE_RULES_VERSION = 2;
export const MILESTONE_TOKENS = ['Progress', 'Doom'] as const;
export type MilestoneToken = typeof MILESTONE_TOKENS[number];
export interface MilestoneTokenRule {
  token: MilestoneToken;
  target: number;
  checkpoints: number[];
  direction: 'increase' | 'decrease';
  initial: number;
  /** Printed storage maximum, distinct from a threshold that allows more tokens. */
  maximum?: number;
  /** App counter cap for an open-ended printed minimum; does not replace the requirement. */
  counterMaximum?: number;
  comparison?: 'at-least';
  carryToNext?: 'all' | 'excess';
}
export interface MilestoneRules { version: 1; cardNumber: number; faces: Partial<Record<FaceId, { tokens: MilestoneTokenRule[] }>> }
function progress(points: number[], maximum?: number, carry = true): MilestoneTokenRule {
  return { token: 'Progress', target: Math.max(...points), checkpoints: points, direction: 'increase', initial: 0,
    ...(maximum === undefined ? {} : { maximum }), ...(carry ? { carryToNext: 'all' as const } : {}) };
}
function doom(points: number[], carry = true): MilestoneTokenRule {
  return { token: 'Doom', target: Math.max(...points), checkpoints: points, direction: 'increase', initial: 0,
    ...(carry ? { carryToNext: 'excess' as const } : {}) };
}
function countdown(initial: number): MilestoneTokenRule {
  return { token: 'Progress', target: 0, checkpoints: [0], direction: 'decrease', initial, maximum: initial };
}
function atLeastProgress(points: number[], carry = true): MilestoneTokenRule {
  return { ...progress(points, undefined, carry), target: points[0], comparison: 'at-least', counterMaximum: 50 };
}
export function milestoneTokenMaximum(rule: MilestoneTokenRule): number {
  return rule.maximum ?? rule.counterMaximum ?? rule.target;
}
/** Audited against each printed side. Gains, costs and references to another card are not targets. */
export const MILESTONE_POLICY: Record<string, [MilestoneTokenRule[], MilestoneTokenRule[]]> = {
  AD0120: [[progress([6])], []], AD0121: [[progress([2], 9)], []],
  AD0122: [[progress([2, 5, 9])], []], AD0123: [[progress([5, 12])], [progress([5], undefined, false)]],
  BD0631: [[progress([7])], []], BD0632: [[progress([6])], [atLeastProgress([10, 15, 20], false)]],
  BD0633: [[], []], BD0634: [[atLeastProgress([10])], []],
  CD1257: [[progress([6])], [progress([2, 5], undefined, false)]],
  CD1258: [[progress([1, 3, 5])], [progress([9], undefined, false)]],
  CD1259: [[progress([2, 5, 9])], [progress([2, 5, 9], undefined, false)]], CD1850: [[], []],
  DD2079: [[progress([5])], [progress([2, 5, 7], undefined, false)]],
  DD2080: [[progress([2, 4, 7])], []], DD2081: [[progress([5])], []], DD2082: [[progress([9])], []],
  ED2657: [[countdown(4)], [countdown(3)]], ED2658: [[progress([4])], []],
  ED2659: [[progress([3, 5])], []], ED2660: [[], []],
  ED2661: [[{ ...doom([5], false), carryToNext: 'all' }], [doom([5], false)]],
  AE0117: [[doom([5])], [doom([6])]], AE0118: [[doom([5])], [doom([6])]], AE0119: [[doom([5])], [doom([6])]],
  BE0628: [[doom([5])], [doom([5])]], BE0629: [[doom([5])], [doom([6])]], BE0630: [[doom([1, 5])], [doom([6], false)]],
  CE1254: [[doom([7])], [doom([7])]], CE1255: [[doom([7])], [doom([7])]], CE1256: [[doom([7])], [doom([7])]],
  // Progress spent on Doomed Investment does not carry when the Doom card flips.
  DE2083: [[doom([5]), progress([3], undefined, false)], [doom([6]), progress([4], undefined, false)]],
  DE2084: [[doom([7]), progress([5], undefined, false)], [doom([7]), progress([6], undefined, false)]],
  DE2085: [[doom([6]), progress([7], undefined, false)], [doom([5]), progress([8], undefined, false)]],
  EE2663: [[doom([5])], [doom([5])]], EE2664: [[doom([5])], [doom([4])]], EE2665: [[doom([4])], [doom([6])]],
};
export function deriveMilestoneRules(card: CardDefinition): MilestoneRules | undefined {
  if (card.family !== 'Story' && card.family !== 'Doom') return undefined;
  const number = String(card.faces[0].data.cardNumber ?? '');
  if (!/^\d+$/.test(number)) return undefined; // Inward Odyssey is its own track.
  const policy = card.printedIds.map(id => MILESTONE_POLICY[id]).find(Boolean);
  if (!policy) throw new Error(`Unaudited ${card.family} milestone rules: ${card.printedIds.join(', ')}`);
  const faces: MilestoneRules['faces'] = {};
  for (const face of card.faces) faces[face.id] = { tokens: policy[face.id === 'front' ? 0 : 1].map(rule => ({ ...rule, checkpoints: [...rule.checkpoints] })) };
  return { version: 1, cardNumber: Number(number), faces };
}
export function milestoneRules(card: CardDefinition): MilestoneRules | undefined { return card.milestoneRules ?? deriveMilestoneRules(card); }
