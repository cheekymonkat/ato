import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { formatParagraph } from '../src/domain/card-presentation.ts';
import { EVOLUTION_RULES } from '../src/domain/evolution-rules.ts';
import { primordialLevels } from '../src/domain/evolution.ts';
import { createKeywordRepository } from '../src/domain/keywords.ts';
import { resolvePrimordialTrait } from '../src/domain/primordial-traits.ts';

const json = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const catalogue = createCatalogueRepository(json('../data/generated/catalogue.json'));
const overrides = json('../data/reference/primordial-trait-overrides.json');
const keywords = createKeywordRepository(Object.assign({}, ...['titanAbilityData', 'keywords', 'primordialAbilityData', 'keyword-overrides']
  .map(name => json(`../data/reference/${name}.json`))));
const tracks = [...new Map(Object.values(EVOLUTION_RULES).flatMap(rules => [...rules.regular, rules.boss, ...rules.adversaries]).map(track => [track.printedId, track])).values()];
const track = name => tracks.find(track => track.name === name);
const resolve = (name, trait) => resolvePrimordialTrait(track(name), trait, catalogue, keywords, overrides);

test('card-backed traits preserve their rich text and resolve casing, ownership and generic cards', () => {
  for (const [name, trait, printedId] of [
    ['Chimera Metastasios', 'Slime Trail', 'BX0764'], ['The Nietzschean', 'All For One', 'BX1059'],
    ['Alpha Temenos', 'Song of Hopelessness', 'AX0517'], ['The Burden', 'Burden Hardest to Bear', 'BX1158'],
    ['Icarian Harpy', 'Death by Fate', 'CT1329'], ['Titan X', 'Toying', 'EX3219'],
  ]) {
    const definition = resolve(name, trait);
    assert.equal(definition.source, 'card'); assert.ok(definition.printedIds.includes(printedId));
    const original = catalogue.byPrintedId(printedId).flatMap(card => card.faces).find(face => face.family === 'Trait');
    assert.deepEqual(definition.main, original.data.effects);
    assert.ok(formatParagraph(definition.main).label.length > 0);
    assert.deepEqual(formatParagraph(definition.main).diagnostics, []);
  }
});

test('Hermesian Toying uses its own data entry and leaves Titan X wording and physical card identity unchanged', () => {
  const toying = resolve('Hermesian Pursuer', 'Toying');
  assert.equal(toying.source, 'override'); assert.equal(toying.printedIds, undefined);
  assert.match(toying.provenance, /User confirmation/); assert.equal(toying.note, undefined);
  const label = formatParagraph(toying.main).label;
  assert.match(label, /Hermesian Pursuer Attacks: -1 \[d10\] and -1 \[Danger\] per hit \(minimum 1\)/);
  assert.match(label, /End of Hope Trait is disabled/); assert.doesNotMatch(label, /Titan X|Death of Hope/);
  assert.deepEqual(formatParagraph(toying.main).diagnostics, []);
  const original = catalogue.byPrintedId('EX3219').flatMap(card => card.faces).find(face => face.name === 'Toying');
  assert.deepEqual(resolve('Titan X', 'Toying').main, original.data.effects);
  assert.match(formatParagraph(original.data.effects).label, /Titan X Attacks/);
  assert.match(formatParagraph(original.data.effects).label, /Death of Hope Trait is disabled/);
  const unknown = resolvePrimordialTrait({ printedId: 'unknown', name: 'Unrelated monster' }, 'Toying', catalogue, keywords, overrides);
  assert.equal(unknown.source, 'missing'); assert.equal(unknown.main, undefined);
  assert.equal(resolvePrimordialTrait({ printedId: 'AU0622', name: 'Wrong monster' }, 'Toying', catalogue, keywords, overrides).source, 'missing');
});

test('all sourced level traits have meaningful descriptions; absent source text is explicit and limited to the audited monsters', () => {
  const missing = new Map(); let checked = 0;
  for (const monster of tracks) for (const trait of new Set(primordialLevels(monster, catalogue).flatMap(level => level.activeTraits))) {
    const definition = resolvePrimordialTrait(monster, trait, catalogue, keywords, overrides); checked++;
    if (definition.source === 'missing') {
      assert.match(definition.note, /no description/);
      missing.set(monster.name, [...(missing.get(monster.name) ?? []), trait]);
    } else assert.ok(formatParagraph(definition.main).label || definition.sections.some(section => formatParagraph(section.content).label), `${monster.name}: ${trait}`);
  }
  assert.equal(checked, 299);
  assert.deepEqual([...missing.keys()], ['Hermesian Pursuer', 'Ur-Fleece', 'Titan X']);
  assert.deepEqual(missing.get('Hermesian Pursuer'), ['Winged Doom', 'Killjoy', 'Flares']);
  assert.equal([...missing.values()].flat().length, 28);
  assert.match(formatParagraph(resolve('Hekaton', 'Clever Boy').main).label, /Board Edges gain Boundless/);
});

test('VP Modification uses the modified sheet section including climb and hold-on requirements', () => {
  for (const name of ['Labyrinthauros', 'Alpha Temenos']) {
    const definition = resolve(name, 'VP Modification');
    assert.equal(definition.source, 'sheet'); assert.equal(definition.sections.find(section => section.title === 'Climb').content, name === 'Labyrinthauros' ? 'Fury 9+' : 'Fury 8+');
    assert.match(formatParagraph(definition.main).label, /immediately perform a Hold On test/);
  }
});
