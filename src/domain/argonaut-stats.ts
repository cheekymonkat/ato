import type { CatalogueRepository } from '../catalogue/repository.ts';
import { SKILL_NAMES } from './party.ts';
import type { Argonaut, SkillName } from './party.ts';
import { portraitSkill } from './argonaut-identity.ts';
import { fatedGrowthAvailable, memoryProgress } from './memories.ts';

export const SKILL_MIN = -9;
export const SKILL_MAX = 9;

/** Standard memories grant +1; unresolved Fated fronts impose -1 until three nodes. */
export function memorySkillModifiers(argonaut: Argonaut, catalogue: CatalogueRepository): Record<SkillName, number> {
  const bonuses = Object.fromEntries(SKILL_NAMES.map(skill => [skill, 0])) as Record<SkillName, number>;
  const seen = new Set<string>();
  for (const [kind, ids] of [['mnemos', argonaut.mnemosIds], ['fated-mnemos', argonaut.fatedMnemosIds]] as const) {
    for (const id of ids) {
      const instance = argonaut.instances.find(item => item.id === id);
      if (!instance || seen.has(instance.definitionId)) continue;
      const face = catalogue.getFace(instance.definitionId, 'front');
      if (face?.kind !== kind) continue;
      seen.add(instance.definitionId);
      const modifier = kind === 'mnemos' ? 1 : fatedGrowthAvailable(memoryProgress(instance)) ? 0 : -1;
      for (const skill of SKILL_NAMES) if (face.data.stats.includes(skill)) bonuses[skill] += modifier;
    }
  }
  return bonuses;
}

/** Portraits add one printed skill bonus alongside memory modifiers, including on older-cycle saved portraits. */
export function argonautSkillModifiers(argonaut: Argonaut, catalogue: CatalogueRepository): Record<SkillName, number> {
  const bonuses = memorySkillModifiers(argonaut, catalogue);
  const skill = argonaut.argonautDefinitionId ? portraitSkill(catalogue.getFace(argonaut.argonautDefinitionId, 'front')) : null;
  if (skill) bonuses[skill] += 1;
  return bonuses;
}

/** Save manual contributions separately so removal and restore cannot accumulate card bonuses. */
export function argonautSkills(argonaut: Argonaut, catalogue: CatalogueRepository): Record<SkillName, number> {
  const bonuses = argonautSkillModifiers(argonaut, catalogue);
  return Object.fromEntries(SKILL_NAMES.map(skill => [skill, Math.max(SKILL_MIN, Math.min(SKILL_MAX, argonaut.skills[skill] + bonuses[skill]))])) as Record<SkillName, number>;
}
