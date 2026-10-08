import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { formatParagraph } from '../src/domain/card-presentation.ts';
import { conditionSections } from '../src/domain/conditions.ts';
import { catalogueCardSize } from '../src/components/cards/catalogue-layout.ts';

const require = createRequire(import.meta.url), React = require('react'), web = require('react-native-web'), ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const root = fileURLToPath(new URL('../src/', import.meta.url));
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const families = ['Clue', 'Condition', 'Doom', 'Exploration', 'Godform', 'Kratos', 'Moiros', 'Nymph', 'Story', 'Terrain', 'Trauma'];
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');

function withRenderers(check) {
  const load = Module._load, error = console.error, cache = new Map(), messages = [], interactions = [];
  globalThis.__DEV__ = true;
  function compile(filename) {
    const module = new Module(filename); module.filename = filename; module.paths = Module._nodeModulePaths(path.dirname(filename));
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return module.exports;
  }
  Module._load = function(request, parent, ...args) {
    if (request === 'react-native') return { ...web,
      Text: props => { if (props.onPress) interactions.push(props); return React.createElement(web.Text, props); },
      Pressable: props => { if (props.onPress) interactions.push(props); return React.createElement(web.Pressable, props); },
    };
    if (request === './elements' && parent?.filename.endsWith('/react-native-svg/lib/commonjs/xmlTags.js')) return require('react-native-svg/lib/commonjs/elements.web.js');
    if (request === 'react-native-svg') return { __esModule: true, ...require('react-native-svg/lib/commonjs/elements.web.js'), ...require('react-native-svg/lib/commonjs/xml.js') };
    if (request === './GateAssistance' && parent?.filename.endsWith('/GateBadge.tsx')) return { useGateCheck: () => null };
    if (request === './gear-art-assets' && parent?.filename.endsWith('/GearCard.tsx')) return { gearArtAssets: {} };
    if (request === './CombatStats' && parent?.filename.endsWith('/GearCard.tsx')) return { useCombatAdjustment: () => undefined };
    if (request.startsWith('.') && parent?.filename.startsWith(root)) {
      const base = path.resolve(path.dirname(parent.filename), request), filename = [base, `${base}.tsx`, `${base}.ts`].find(value => /\.tsx?$/.test(value) && fs.existsSync(value));
      if (filename) { if (!cache.has(filename)) cache.set(filename, compile(filename)); return cache.get(filename); }
    }
    return load.call(this, request, parent, ...args);
  };
  console.error = (...values) => messages.push(values);
  try {
    const { CatalogueCard } = compile(path.join(root, 'components/cards/CatalogueCard.tsx'));
    const render = (card, face = card.faces[0], actions = {}, availableWidth = 343) => {
      interactions.length = 0;
      return renderToStaticMarkup(React.createElement(CatalogueCard, { card, face, width: catalogueCardSize(face, availableWidth).width, ...actions }));
    };
    check({ render, interactions });
    assert.deepEqual(messages, [], 'Card previews must render without React or SVG errors');
  } finally { Module._load = load; console.error = error; delete globalThis.__DEV__; }
}

test('all reference card faces retain their printed rules, clue text, rallies and named abilities', () => withRenderers(({ render }) => {
  function paragraph(html, value, description) {
    const label = formatParagraph(value, true).label;
    if (label) assert.ok(html.includes(`aria-label="${escape(label)}"`), `${description}: ${label}`);
  }
  for (const family of families) for (const card of catalogue.search({ family })) for (const face of card.faces) {
    const html = render(card, face), data = face.data, description = `${family}: ${face.name} (${face.id})`;
    assert.ok(html.includes(escape(face.name.toUpperCase())), description);
    for (const id of face.printedIds) assert.ok(html.includes(id), description);
    assert.doesNotMatch(html, /\[object Object\]|Unrecognised ability shape|Unrecognised token|NaN/, description);
    switch (family) {
      case 'Clue':
        paragraph(html, data.text, description);
        if (data.flavor) assert.ok(html.includes(escape(data.flavor)), description);
        if (data.subtitle) assert.ok(html.includes(escape(data.subtitle.toUpperCase())), description);
        break;
      case 'Condition': {
        const sections = conditionSections(face);
        paragraph(html, sections.effect, description);
        for (const ability of sections.abilities) { assert.ok(html.includes(escape(ability.title)), description); paragraph(html, ability.effects, description); }
        if (sections.endOfBattle) paragraph(html, sections.aftermath, description);
        break;
      }
      case 'Story': case 'Doom':
        for (const text of data.flavor) assert.ok(html.includes(escape(text)), description);
        for (const rules of data.rules) paragraph(html, rules, description);
        if (data.rulesTitle) assert.ok(html.includes(escape(data.rulesTitle)), description);
        assert.ok(html.includes(`Card ${data.cardNumber === 'IO' || card.faces[0].data.cardNumber === 'IO' ? '1' : data.cardNumber ?? card.faces[0].data.cardNumber}${face.id === 'front' ? 'A' : 'B'}`), description);
        break;
      case 'Kratos':
        paragraph(html, data.effects, description);
        paragraph(html, data.rally, description);
        if (data.rally.length) { assert.match(html, /RALLY/); assert.match(html, /End of your turn:/); assert.match(html, /Discard this card\./); }
        break;
      case 'Moiros': case 'Trauma':
        paragraph(html, data.effects, description);
        if (data.flavor) assert.ok(html.includes(escape(data.flavor)), description);
        if (family === 'Trauma' && data.subtype !== 'Obol') assert.ok(html.includes(`${data.subtype} Trauma ${escape(data.sign)}`), description);
        break;
      case 'Exploration':
        paragraph(html, data.effects, description); paragraph(html, data.effects2, description);
        if (data.removeEffect) assert.ok(html.includes(escape(data.removeEffect)), description);
        if (data.acclimation) assert.ok(html.includes(`Acclimation: ${escape(data.acclimation)}`), description);
        assert.ok(html.includes(escape(data.stackType)), description);
        if (data.number != null) assert.ok(html.includes(`Exploration card ${data.number}`), description);
        if (data.adversaryTriggers) assert.ok(html.includes(`${data.adversaryTriggers} Adversary triggers`), description);
        break;
      case 'Terrain':
        paragraph(html, data.abilities, description);
        for (const tile of data.tiles ?? []) assert.ok(html.includes(escape(`${tile.count} × ${tile.type} tile`)), description);
        for (const keyword of data.keywords ?? []) assert.ok(html.includes(escape(keyword)), description);
        break;
      case 'Godform':
        for (const ability of data.abilities) { assert.ok(html.includes(escape(ability.name.toUpperCase())), description); paragraph(html, ability.effects, description); }
        paragraph(html, data.keywords, description);
        assert.ok(html.includes(`Power ${escape(data.power)}`), description);
        assert.ok(html.includes(`Speed ${escape(data.speed)}`), description);
        for (const stat of data.stats.split(/,\s*/).filter(Boolean)) assert.ok(html.includes(escape(stat)), description);
        break;
      case 'Nymph':
        paragraph(html, data.requirements, description); paragraph(html, data.effects, description);
        assert.match(html, /REQUIREMENTS/); assert.match(html, /SUMMONING/); assert.match(html, /EFFECT/);
        assert.ok(html.includes(escape(`Spend 1 [SummonCharge] to summon the ${face.name}. Then, [Adversary].`)), description);
        break;
    }
  }
}));

test('references and keyword definitions inside the new layouts retain their local overlay actions', () => withRenderers(({ render, interactions }) => {
  const references = [], keywords = [], actions = { onReference: (id, name) => references.push({ id, name }), onKeyword: name => keywords.push(name) };
  render(catalogue.byName('Your Death Transcends Reality').find(card => card.printedIds.includes('AM0360')), undefined, actions);
  let stopped = false;
  interactions.find(entry => entry.accessibilityRole === 'link' && entry.children === 'Hades').onPress({ stopPropagation() { stopped = true; } });
  assert.ok(stopped); assert.deepEqual(references, [{ id: 'AQ0629', name: 'Hades' }]);
  render(catalogue.byName("Another's Thread")[0], undefined, actions);
  interactions.find(entry => entry.accessibilityLabel === 'Definition of Knockdown').onPress({ stopPropagation() {} });
  assert.deepEqual(keywords, ['Knockdown']);
}));

test('Godform attacks and mirrored Story/Doom books retain their details across phone and landscape widths', () => withRenderers(({ render }) => {
  for (const name of ['Helios Apollonis Exalted', 'Zeus']) {
    const card = catalogue.byName(name)[0], attack = card.faces[0].data.abilities.find(ability => ability.attack).attack;
    const html = render(card);
    assert.match(html, new RegExp(`Attack dice ${attack.attackDice}`));
    assert.ok(html.includes(`Precision ${escape(attack.precision)}`));
    assert.ok(html.includes(`${attack.power[0].type.join(', ')} Power ${attack.power[0].type.length === 1 ? 'die' : 'dice'}`));
  }
  for (const family of ['Clue', 'Story', 'Doom', 'Godform', 'Terrain']) {
    const card = catalogue.search({ family })[0];
    for (const available of [232, 343, 572, 834]) {
      const html = render(card, card.faces[0], {}, available), size = catalogueCardSize(card.faces[0], available);
      assert.ok(size.width <= available);
      assert.ok(html.includes(card.printedIds[0]));
      if (family === 'Story' || family === 'Doom') assert.equal(size.landscape, available >= 620);
    }
  }
}));
