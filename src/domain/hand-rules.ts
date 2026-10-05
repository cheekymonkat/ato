import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { Argonaut } from './party.ts';
import { deriveTitanWeaponRules } from './titan-loadout-rules.ts';
import { DEFAULT_BASELINE } from './slots.ts';
import type { SlotBaseline } from './slots.ts';

export function titanLoadoutRules(argonaut: Argonaut, catalogue: CatalogueRepository) {
  const titan = argonaut.titan;
  if (!titan || titan.discarded) return null;
  const face = catalogue.getFace(titan.definitionId, titan.faceId);
  if (face?.kind !== 'titan') return null;
  return face.weaponRules ?? deriveTitanWeaponRules(face.data.abilities);
}

/** Compatibility accessor for rule explanations. Equipment uses the complete rules below. */
export function titanHandRule(argonaut: Argonaut, catalogue: CatalogueRepository): string | null {
  return titanLoadoutRules(argonaut, catalogue)?.conversions[0]?.ability ?? null;
}

export function titanSlotBaseline(argonaut: Argonaut, catalogue: CatalogueRepository): SlotBaseline {
  const rules = titanLoadoutRules(argonaut, catalogue);
  const selected = rules?.alternative && argonaut.titan?.loadoutMode === rules.alternative.mode ? rules.alternative : rules;
  return { ...DEFAULT_BASELINE, hand: selected?.handSlots ?? DEFAULT_BASELINE.hand, support: selected?.supportSlots ?? DEFAULT_BASELINE.support };
}
