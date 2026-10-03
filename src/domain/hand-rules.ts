import type { CatalogueRepository } from '../catalogue/repository.ts';
import type { Argonaut } from './party.ts';
import { objects } from './card-presentation.ts';

/** Verified bundled Titan keywords: three-handed Weapons may occupy two hands. */
export function titanHandRule(argonaut: Argonaut, catalogue: CatalogueRepository): 'Cyclopean Might' | 'Elder Might' | null {
  const titan = argonaut.titan;
  if (!titan || titan.discarded) return null;
  const face = catalogue.getFace(titan.definitionId, titan.faceId);
  if (face?.kind !== 'titan') return null;
  for (const ability of objects(face.data.abilities)) for (const token of objects(ability.abilityText)) {
    if (token.type === 'keyword' && (token.value === 'Cyclopean Might' || token.value === 'Elder Might')) return token.value;
  }
  // Unknown Might also changes Support capacity; it stays a manual exception until that trade-off is supported.
  return null;
}
