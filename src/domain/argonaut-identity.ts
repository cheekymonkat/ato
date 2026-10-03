import type { CatalogueRepository } from '../catalogue/repository.ts';
import { isFaceAvailableInCycle } from './campaign.ts';
import type { CampaignCycle } from './campaign.ts';
import type { CardFace } from './cards.ts';
import { unlinkRemovedHost } from './loadout.ts';
import { SKILL_NAMES } from './party.ts';
import type { Argonaut, SkillName } from './party.ts';

export interface ArgonautPortrait { definitionId: string; name: string; cycle: string; skill: SkillName }
/** Generic portraits marked “Choose” have no predetermined bonus; custom names stay manual. */
export function portraitSkill(face: CardFace | undefined): SkillName | null {
  return face?.family === 'Argonaut' ? SKILL_NAMES.find(skill => skill === face.data.stat) ?? null : null;
}
const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export function argonautSuggestions(catalogue: CatalogueRepository, query: string, cycle: CampaignCycle): ArgonautPortrait[] {
  const term = searchable(query);
  if (!term) return [];
  return catalogue.search({ family: 'Argonaut', campaignCycle: cycle }).flatMap(card => {
    const face = card.faces.find(face => isFaceAvailableInCycle(face, cycle) && portraitSkill(face) && searchable(face.name).includes(term));
    const skill = portraitSkill(face);
    return face && skill ? [{ definitionId: card.id, name: face.name, cycle: face.cycle, skill }] : [];
  }).sort((a, b) => Number(searchable(b.name).startsWith(term)) - Number(searchable(a.name).startsWith(term)) || a.name.localeCompare(b.name) || a.definitionId.localeCompare(b.definitionId));
}
export interface ArgonautChange { name: string; definitionId: string | null }
/** Resolve a candidate before any destructive reset. */
export function resolveArgonautChange(change: ArgonautChange, cycle: CampaignCycle, catalogue: CatalogueRepository): ArgonautChange | null {
  if (change.definitionId === null) {
    const name = change.name.trim();
    return name && name.length <= 60 ? { name, definitionId: null } : null;
  }
  const face = catalogue.getFace(change.definitionId, 'front');
  return face && portraitSkill(face) && isFaceAvailableInCycle(face, cycle) ? { name: face.name, definitionId: change.definitionId } : null;
}
export function sameArgonautIdentity(argonaut: Argonaut, change: ArgonautChange): boolean {
  return argonaut.name === change.name && argonaut.argonautDefinitionId === change.definitionId;
}
/** A replacement starts with zero manual skills and no memories, conditions or tokens. */
export function changeArgonautIdentity(argonaut: Argonaut, change: ArgonautChange, cycle: CampaignCycle, catalogue: CatalogueRepository): Argonaut {
  const next = resolveArgonautChange(change, cycle, catalogue);
  if (!next || sameArgonautIdentity(argonaut, next)) return argonaut;
  const memoryIds = new Set([...argonaut.mnemosIds, ...argonaut.fatedMnemosIds].filter((id): id is string => id !== null));
  for (const instance of argonaut.instances) {
    const definition = catalogue.get(instance.definitionId);
    if (definition?.faces.some(face => face.family === 'Mnemos' || face.family === 'Fated Mnemos')) memoryIds.add(instance.id);
  }
  const detached = [...memoryIds].reduce((member, id) => unlinkRemovedHost(member, id), argonaut);
  return { ...detached, name: next.name, argonautDefinitionId: next.definitionId,
    skills: Object.fromEntries(SKILL_NAMES.map(skill => [skill, 0])) as Record<SkillName, number>,
    tokens: {}, localConditions: [], conditions: [],
    ...(argonaut.combatModifiers ? { combatModifiers: { precision: 0, speed: 0 } } : {}),
    instances: detached.instances.filter(instance => !memoryIds.has(instance.id)),
    equipment: detached.equipment.filter(assignment => !memoryIds.has(assignment.instanceId)),
    mnemosIds: argonaut.mnemosIds.map(() => null), fatedMnemosIds: argonaut.fatedMnemosIds.map(() => null) };
}
