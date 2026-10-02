import bundledCatalogue from '../../data/generated/catalogue.json';
import { createCatalogueRepository } from './repository.ts';
import type { CatalogueRepository } from './repository.ts';

let repository: CatalogueRepository | undefined;
/** Bundled once and indexed on first use; suitable for web, iOS and Android. */
export function getCatalogue(): CatalogueRepository {
  return repository ??= createCatalogueRepository(bundledCatalogue);
}
