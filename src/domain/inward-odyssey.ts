import type { CatalogueRepository } from '../catalogue/repository.ts';
import { campaignCycle, isFaceAvailableInCycle } from './campaign.ts';
import type { CampaignCycle } from './campaign.ts';
import type { CardDefinition, FaceId } from './cards.ts';
import { isRecord } from './json.ts';
import { flattenAbilities } from './references.ts';
import type { Party } from './party.ts';
import { technologyResourceValue } from './technologies.ts';

export const INWARD_ODYSSEY_RULES_VERSION = 1;
export interface InwardAdventure { knowledge: number; title: string }
export interface InwardOdysseyRules {
  version: 1;
  progressPerKnowledge: 2;
  knowledgePerCompletion: 1;
  faces: Partial<Record<FaceId, { adventures: InwardAdventure[] }>>;
}
/** Extract numbered adventures from printed rules, retaining the source text unchanged. */
export function deriveInwardOdysseyRules(card: CardDefinition): InwardOdysseyRules | undefined {
  if (card.family !== 'Story' || card.faces[0].data.cardNumber !== 'IO') return undefined;
  const faces: InwardOdysseyRules['faces'] = {}, levels = new Set<number>();
  for (const face of card.faces) {
    const text = flattenAbilities(face.data.rules ?? []).flatMap(rule => isRecord(rule) && Array.isArray(rule.abilityText) ? rule.abilityText : [])
      .map(token => !isRecord(token) ? '' : token.type === 'newline' ? '\n' : token.type === 'icon' ? `[${token.value}]` : typeof token.value === 'string' ? token.value : '').join('');
    if (!/When there are 2 \[Progress\] tokens on this card, discard them and gain \+1 \[ArgoKnowledge\]/.test(text))
      throw new Error(`Unaudited Inward Odyssey conversion: ${card.id}/${face.id}`);
    const adventures = text.split('\n').flatMap(line => {
      const match = /^\s*(\d+):\s*(.+?)\s*$/.exec(line);
      if (!match) return [];
      const knowledge = Number(match[1]);
      if (!Number.isSafeInteger(knowledge) || knowledge < 1 || levels.has(knowledge)) throw new Error(`Invalid Inward Odyssey adventure: ${card.id}/${face.id}`);
      levels.add(knowledge); return [{ knowledge, title: match[2] }];
    });
    if (!adventures.length) throw new Error(`Missing Inward Odyssey adventures: ${card.id}/${face.id}`);
    faces[face.id] = { adventures };
  }
  return { version: 1, progressPerKnowledge: 2, knowledgePerCompletion: 1, faces };
}
export function inwardOdysseyRules(card: CardDefinition): InwardOdysseyRules | undefined {
  return card.inwardOdysseyRules ?? deriveInwardOdysseyRules(card);
}
export function currentInwardOdyssey(party: Party, catalogue: CatalogueRepository) {
  const cycle = campaignCycle(party), knowledge = technologyResourceValue(party, 'Argo Knowledge');
  const card = catalogue.search({ family: 'Story' }).find(card => inwardOdysseyRules(card) &&
    isFaceAvailableInCycle(card.faces[0], cycle) && (cycle === 1 || !isFaceAvailableInCycle(card.faces[0], (cycle - 1) as CampaignCycle))) ?? null;
  const rules = card && inwardOdysseyRules(card);
  const matchingFace = card?.faces.find(face => rules?.faces[face.id]?.adventures.some(entry => entry.knowledge === knowledge));
  const back = card?.faces.find(face => face.id === 'back'), firstBack = back && rules?.faces.back?.adventures[0]?.knowledge;
  const face = matchingFace ?? (firstBack !== undefined && knowledge >= firstBack ? back : card?.faces[0]) ?? null;
  const adventure = face && rules?.faces[face.id]?.adventures.find(entry => entry.knowledge === knowledge) || null;
  return { card, face, knowledge, adventure, rules };
}
