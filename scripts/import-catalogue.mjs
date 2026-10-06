import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSourcePage } from '../src/domain/cards.ts';
import { normalizeCatalogue } from '../src/catalogue/normalize.ts';
import { parseCatalogue } from '../src/catalogue/validate.ts';
import { createIdentityResolver } from './identity-registry.mjs';
import { gearArtwork } from '../src/catalogue/gear-art.ts';
import { catalogueReviewFiles } from './catalogue-review-files.mjs';
import { TITAN_LOADOUT_RULES_VERSION } from '../src/domain/titan-loadout-rules.ts';
import { SLOT_EFFECTS_VERSION } from '../src/catalogue/effects.ts';
import { TECHNOLOGY_RULES_VERSION, TECHNOLOGY_CYCLE_POLICY } from '../src/domain/technology-rules.ts';
import { MILESTONE_RULES_VERSION, MILESTONE_POLICY } from '../src/domain/milestone-rules.ts';
import { INWARD_ODYSSEY_RULES_VERSION } from '../src/domain/inward-odyssey.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowed = new Set(['source', 'out', 'registry', 'check']);
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const name = process.argv[i].slice(2);
  if (!process.argv[i].startsWith('--') || !allowed.has(name)) throw new Error(`Unknown option ${process.argv[i]}`);
  if (name === 'check') options.check = true;
  else {
    if (!process.argv[i + 1] || process.argv[i + 1].startsWith('--')) throw new Error(`Missing --${name} value`);
    options[name] = process.argv[++i];
  }
}
const sourceDirectory = resolve(root, options.source || 'data/source');
const outDirectory = resolve(root, options.out || 'data/generated');
const registryPath = resolve(root, options.registry || 'data/identity-registry.json');
const files = (await readdir(sourceDirectory)).filter(file => /^atcc-cards-page-\d+\.json$/.test(file)).sort();
if (!files.length) throw new Error('No catalogue export files found');
const inputs = [];
for (const file of files) {
  const bytes = await readFile(resolve(sourceDirectory, file));
  inputs.push({ file, sha256: createHash('sha256').update(bytes).digest('hex'), page: parseSourcePage(JSON.parse(bytes.toString('utf8')), file) });
}
const first = inputs[0].page, pages = new Set(inputs.map(input => input.page.currentPage));
if (pages.size !== inputs.length || first.totalPages !== inputs.length || [...pages].some(page => page > first.totalPages) || inputs.some(input => input.page.totalCards !== first.totalCards || input.page.totalPages !== first.totalPages || input.page.perPageLimit !== first.perPageLimit) || inputs.reduce((sum, input) => sum + input.page.cards.length, 0) !== first.totalCards) throw new Error('Incomplete or inconsistent export pagination');
let registry;
try { registry = JSON.parse(await readFile(registryPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const identity = createIdentityResolver(registry);
const result = normalizeCatalogue(inputs, card => identity.resolve(card), 'pending');
const digest = createHash('sha256').update(JSON.stringify({ importerVersion: 2,
  files: inputs.map(input => [input.file, input.sha256]), registry: identity.snapshot(), artwork: gearArtwork,
  titanLoadoutRulesVersion: TITAN_LOADOUT_RULES_VERSION, slotEffectsVersion: SLOT_EFFECTS_VERSION,
  technologyRulesVersion: TECHNOLOGY_RULES_VERSION, technologyCyclePolicy: TECHNOLOGY_CYCLE_POLICY,
  milestoneRulesVersion: MILESTONE_RULES_VERSION, milestonePolicy: MILESTONE_POLICY,
  inwardOdysseyRulesVersion: INWARD_ODYSSEY_RULES_VERSION })).digest('hex');
const version = `atcc-v2-${digest.slice(0, 16)}`;
result.catalogue.catalogueVersion = version;
parseCatalogue(result.catalogue);
const artifacts = [
  [resolve(outDirectory, 'catalogue.json'), JSON.stringify(result.catalogue, null, 2) + '\n'],
  [resolve(outDirectory, 'quality-report.json'), JSON.stringify({ catalogueVersion: version, ...result.report }, null, 2) + '\n'],
  [resolve(outDirectory, 'source-map.json'), JSON.stringify(result.sourceMap, null, 2) + '\n'],
  [registryPath, JSON.stringify(identity.snapshot(), null, 2) + '\n'],
  ...catalogueReviewFiles(result.catalogue).map(({ path, content }) => [resolve(outDirectory, 'by-family', path), content]),
];
// All validation completes before any output is written. --check is read-only.
for (const [path, content] of artifacts) {
  if (options.check) {
    if (await readFile(path, 'utf8') !== content) throw new Error(`Generated file is stale: ${path}`);
  } else { await mkdir(dirname(path), { recursive: true }); await writeFile(path, content); }
}
const counts = {};
for (const issue of result.report.issues) counts[issue.category] = (counts[issue.category] || 0) + 1;
console.log(JSON.stringify({ catalogueVersion: version, records: result.report.sourceRecords, definitions: result.report.definitions, faces: result.report.faces, repeatedAliases: result.report.repeatedAliases.length, slotEffects: result.catalogue.cards.reduce((sum, card) => sum + card.faces.reduce((n, face) => n + face.slotEffects.length, 0), 0), issues: counts, checked: !!options.check }, null, 2));
