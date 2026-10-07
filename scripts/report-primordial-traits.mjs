import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { EVOLUTION_RULES } from '../src/domain/evolution-rules.ts';
import { primordialLevels } from '../src/domain/evolution.ts';
import { createKeywordRepository } from '../src/domain/keywords.ts';
import { resolvePrimordialTrait } from '../src/domain/primordial-traits.ts';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await fs.readFile(new URL(path, root), 'utf8'));
const catalogue = createCatalogueRepository(await read('data/generated/catalogue.json'));
const overrides = await read('data/reference/primordial-trait-overrides.json');
const keywords = createKeywordRepository(Object.assign({}, ...await Promise.all(['titanAbilityData', 'keywords', 'primordialAbilityData', 'keyword-overrides']
  .map(name => read(`data/reference/${name}.json`)))));
const tracks = [...new Map(Object.values(EVOLUTION_RULES).flatMap(rules => [...rules.regular, rules.boss, ...rules.adversaries]).map(track => [track.printedId, track])).values()];
const primordials = tracks.map(track => ({
  primordialId: track.printedId, name: track.name,
  traits: [...new Set(primordialLevels(track, catalogue).flatMap(level => level.activeTraits))].map(name => {
    const definition = resolvePrimordialTrait(track, name, catalogue, keywords, overrides);
    return { name, source: definition.source, ...(definition.printedIds ? { printedIds: definition.printedIds } : {}),
      ...(definition.provenance ? { provenance: definition.provenance } : {}), ...(definition.note ? { note: definition.note } : {}) };
  }),
}));
const total = primordials.reduce((sum, primordial) => sum + primordial.traits.length, 0);
const missing = primordials.reduce((sum, primordial) => sum + primordial.traits.filter(trait => trait.source === 'missing').length, 0);
const out = new URL('docs/reports/primordial-traits.json', root);
await fs.writeFile(out, JSON.stringify({ catalogueVersion: catalogue.version, total, missing, primordials }, null, 2) + '\n');
console.log(`${total} monster/trait combinations checked; ${missing} descriptions absent from source data.\n${fileURLToPath(out)}`);
