import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import * as technologies from '../src/domain/technologies.ts';
import * as campaign from '../src/domain/campaign.ts';
import * as presentation from '../src/domain/card-presentation.ts';
import * as technologyLayout from '../src/components/cards/technology-layout.ts';

const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server'), ts = require('typescript'), web = require('react-native-web');
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
function compile(filename) {
  const component = new Module(filename); component.filename = filename; component.paths = Module._nodeModulePaths(path.dirname(filename));
  component._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename);
  return component.exports;
}

test('every technology renders both logical sides, preserving benefits and recipes from the source face', () => {
  const load = Module._load, error = console.error, messages = [], cache = new Map();
  globalThis.__DEV__ = false;
  Module._load = function(request, parent, ...args) {
    if (request === 'react-native') return web;
    if (request === './elements' && parent?.filename.endsWith('/react-native-svg/lib/commonjs/xmlTags.js')) return require('react-native-svg/lib/commonjs/elements.web.js');
    if (request === 'react-native-svg') return { __esModule: true, ...require('react-native-svg/lib/commonjs/elements.web.js'), ...require('react-native-svg/lib/commonjs/xml.js') };
    if (request === './GateAssistance' && parent?.filename.endsWith('/GateBadge.tsx')) return { useGateCheck: () => null };
    if (request.startsWith('.') && parent?.filename.startsWith(sourceRoot)) {
      const base = path.resolve(path.dirname(parent.filename), request), filename = [base, `${base}.tsx`, `${base}.ts`].find(value => /\.tsx?$/.test(value) && fs.existsSync(value));
      if (filename) { if (!cache.has(filename)) cache.set(filename, compile(filename)); return cache.get(filename); }
    }
    return load.call(this, request, parent, ...args);
  };
  console.error = (...values) => messages.push(values);
  try {
    const { TechnologyCard } = compile(path.join(sourceRoot, 'components/cards/TechnologyCard.tsx'));
    const render = (card, side, width = 270, party) => renderToStaticMarkup(React.createElement(TechnologyCard, { card, side, width,
      requirementStatus: party ? technologies.technologyResearchStatus(card, party, catalogue).requirements : undefined, onReference: () => {}, onKeyword: () => {} }));
    for (const card of catalogue.search({ family: 'Technology' })) {
      for (const side of ['project', 'technology']) for (const width of technologies.technologyType(card) === 'Core' ? [310, 620.16] : [270]) {
        const html = render(card, side, width);
        assert.ok(html.includes(technologies.technologyName(card, side).toUpperCase().replaceAll('&', '&amp;').replaceAll("'", '&#x27;')), card.faces[0].name);
        assert.ok(html.includes(card.printedIds[0]), card.faces[0].name);
        assert.doesNotMatch(html, /\[object Object\]/);
      }
    }
    const weapons = catalogue.byName('Trireme Weapons')[0];
    const project = render(weapons, 'project'), technology = render(weapons, 'technology');
    assert.match(project, /REQUIREMENTS/); assert.match(project, /Excursion Propylon/); assert.doesNotMatch(project, /Boatmace/);
    assert.match(technology, /Trireme Weaponsmith/); assert.match(technology, /Boatmace/); assert.match(technology, /Calcified Knuckle Bone/);
    const previewLinks = [];
    const withPreviews = renderToStaticMarkup(React.createElement(TechnologyCard, { card: weapons, onReference: () => {},
      renderRecipeLink: (id, label) => { previewLinks.push({ id, label }); return React.createElement('button', { 'aria-label': `Preview ${label}` }, label); } }));
    assert.ok(previewLinks.some(link => link.label === 'Boatmace' && catalogue.resolveReference(link.id).status === 'resolved'));
    assert.equal(previewLinks.some(link => link.label === 'Calcified Knuckle Bone'), false, 'Ingredients remain normal references');
    assert.match(withPreviews, /aria-label="Preview Boatmace"/);
    assert.doesNotMatch(technology, /REQUIREMENTS/);
    assert.match(render(catalogue.byName('Antikratos Project')[0], 'technology'), /Argo Ability Limit: 2/);
    assert.match(render(catalogue.byName('Arrow Barrage')[0], 'technology'), /aria-label="3 charges"/);
    const fresh = createParty('p', ['a', 'b', 'c', 'd'], catalogue.version), ranged = catalogue.byName('Trireme Ranged Weapons')[0];
    let requirements = render(ranged, 'project', 270, fresh);
    assert.match(requirements, /aria-label="Trireme Weapons\. Requirement unmet"/);
    assert.match(requirements, /aria-label="Trireme Armor\. Requirement unmet"/);
    const withWeapons = technologies.changeTechnology(fresh, weapons.id, 'research', catalogue);
    requirements = render(ranged, 'project', 270, withWeapons);
    assert.match(requirements, /aria-label="Trireme Weapons\. Requirement met"/);
    assert.match(requirements, /aria-label="Trireme Armor\. Requirement unmet"/);
    assert.match(requirements, />✓</);
    assert.match(requirements, />×</);
    const thesis = catalogue.byName('Mnestis Thesis')[0];
    assert.match(render(thesis, 'project', 270, fresh), /aria-label="ArgoKnowledge 6\+\. Requirement unmet"/);
    assert.match(render(thesis, 'project', 270, { ...fresh, resources: { 'Argo Knowledge': 6 } }), /aria-label="ArgoKnowledge 6\+\. Requirement met"/);
    const manual = render(catalogue.byName('Temenos Sighting')[0], 'project', 270, fresh);
    assert.match(manual, /Verify manually; not blocking research/);
    assert.match(manual, />\?</);
    assert.match(manual, />OR</);
    assert.match(manual, /aria-label="Labyrinthauros Live Study\. Requirement unmet"/);
    assert.match(manual, /aria-label="Hekaton Live Study\. Requirement unmet"/);
    assert.deepEqual(messages, [], 'Web SVGs and rich text must render without React errors');
  } finally { Module._load = load; console.error = error; delete globalThis.__DEV__; }
});

test('technology tabs automatically show cycle Core, research eligible projects and confirm removal', () => {
  let party = createParty('p', ['a', 'b', 'c', 'd'], catalogue.version), cursor = 0, confirmation, viewport = 390;
  const state = [], buttons = new Map(), tabs = new Map(), inputs = new Map(), tiles = [], hidden = new Set();
  const filename = path.join(sourceRoot, 'technology/TechnologyPage.tsx'), load = Module._load;
  const Button = props => { buttons.set(props.label, props); return React.createElement('button', { disabled: props.disabled }, props.label); };
  Module._load = function(request, parent, ...args) {
    if (parent?.filename === filename) {
      const mocks = {
        react: { useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; } },
        'react-native': { ...web, useWindowDimensions: () => ({ width: viewport }), TextInput: props => { inputs.set(props.accessibilityLabel, props); return React.createElement('input', { value: props.value, readOnly: true }); } },
        'expo-router': { router: { push: () => {} } },
        '../catalogue': { getCatalogue: () => catalogue },
        '../campaign/CampaignPage': { CampaignPage: ({ children }) => React.createElement('main', null, children), campaignStyles: {} },
        '../components/Button': { Button },
        '../components/cards/TechnologyCard': { TechnologyCard: props => { tiles.push(props); return React.createElement('article', null, props.card.faces[0].name); } },
        '../components/cards/GearRecipeLink': { GearRecipeLink: () => null },
        '../components/cards/technology-layout': technologyLayout,
        '../components/cards/SecretCard': { SecretCard: ({ onReveal }) => React.createElement(Button, { label: 'Reveal card', onPress: onReveal }) },
        '../components/RemovalConfirmation': { RemovalConfirmation: props => { confirmation = props; return null; } },
        '../components/Sheet': { Sheet: () => null },
        '../domain/campaign': campaign,
        '../domain/card-presentation': presentation,
        '../domain/technologies': technologies,
        '../state/PartyProvider': { useParty: () => ({ party, dispatch: action => { party = partyReducer(party, action, catalogue); } }) },
        '../state/SpoilerProvider': { CampaignCardVisibility: ({ children }) => children, useSpoilers: () => ({ hidden: card => hidden.has(card.id), reveal: id => hidden.delete(id) }) },
        '../theme/tokens': { theme: {} },
        './TechnologyTabs': { TechnologyTabs: props => { tabs.set(props.label, props); return null; } },
      };
      if (Object.hasOwn(mocks, request)) return mocks[request];
    }
    return load.call(this, request, parent, ...args);
  };
  try {
    const { TechnologyPage } = compile(filename);
    const render = () => { cursor = 0; buttons.clear(); tabs.clear(); inputs.clear(); tiles.length = 0; confirmation = undefined; return renderToStaticMarkup(React.createElement(TechnologyPage)); };
    // React remounts tile state when its tab/card key changes; mirror that in this hook harness.
    const search = text => { state.splice(10); inputs.get('Search technologies').onChangeText(text); return render(); };
    const select = (label, id) => { state.splice(10); tabs.get(label).onSelect(id); return render(); };
    render();
    assert.equal(tabs.get('Technology pages').selected, 'projects');
    assert.ok(tiles.every(tile => technologies.technologyType(tile.card) !== 'Core'));
    select('Technology pages', 'abilities'); select('Active technology types', 'Core');
    assert.equal(tiles.length, 5);
    assert.ok(tiles.every(tile => tile.card.faces[0].cycle === 'Cycle I'));
    assert.ok(tiles.every(tile => tile.width === 310), 'Core cards must fit the phone page including tile padding');
    viewport = 1440; render();
    assert.ok(tiles.every(tile => tile.width === 620.16), 'Core cards use the reference landscape width on desktop');
    viewport = 390; render();
    assert.equal(buttons.has('Add awarded Core'), false);
    assert.equal(buttons.has('Remove technology'), false);
    assert.deepEqual(technologies.researchedTechnologyIds(party), []);
    for (const expectedCycle of [1, 2]) party = partyReducer(party, { type: 'advance-cycle', partyId: party.id, argonautId: 'a', expectedCycle, confirmed: true }, catalogue);
    state.splice(10); render();
    assert.equal(tiles.length, 5);
    assert.ok(tiles.every(tile => tile.card.faces[0].cycle === 'Cycle III'));
    // Switching to a separately created Cycle 1 campaign remains supported.
    party = createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
    state.splice(10); render();
    select('Technology pages', 'projects'); select('Project types', 'Combat');
    select('Combat project types', 'Production Facility');
    assert.deepEqual(tiles.map(tile => tile.card.faces[0].name), ['Trireme Armor', 'Trireme Weapons']);
    assert.ok(tiles.every(tile => technologies.technologyType(tile.card) === 'Production Facility'));
    search('AA0008');
    assert.equal(tiles[0].side, 'project');
    assert.equal(buttons.get('Research project').disabled, false);
    buttons.get('View technology').onPress(); render();
    assert.equal(tiles[0].side, 'technology');
    buttons.get('Research project').onPress(); render();
    assert.equal(tiles.length, 0, 'Research removes the project from the available list');
    select('Technology pages', 'catalogue'); search('Trireme Ranged Weapons');
    assert.equal(buttons.get('Research project').disabled, true, 'Armor prerequisite is still missing');
    assert.deepEqual(tiles[0].requirementStatus.children.map(child => child.met), [true, false]);
    assert.doesNotMatch(render(), /Research requirements/, 'Statuses belong on the card without a repeated checklist beneath it');
    select('Technology pages', 'abilities');
    assert.deepEqual(tabs.get('Active technology types').options.map(option => option.id), technologies.TECHNOLOGY_TYPES);
    select('Active technology types', 'Production Facility');
    assert.equal(tiles[0].card.faces[0].name, 'Trireme Weapons');
    buttons.get('Remove technology').onPress(); render();
    assert.ok(confirmation);
    assert.equal(technologies.researchedTechnologyIds(party).length, 1, 'Opening confirmation must not remove a record');
    confirmation.onConfirm(); render();
    assert.deepEqual(technologies.researchedTechnologyIds(party), []);
    for (const expectedCycle of [1, 2, 3, 4]) party = partyReducer(party, { type: 'advance-cycle', partyId: party.id, argonautId: 'a', expectedCycle, confirmed: true }, catalogue);
    select('Technology pages', 'catalogue');
    assert.ok(tabs.get('Catalogue technology types').options.every(option => option.id !== 'Core'));
    assert.ok(tiles.every(tile => technologies.technologyType(tile.card) !== 'Core'));
    const expected = catalogue.search({ family: 'Technology', campaignCycle: 5 }).filter(card => technologies.technologyType(card) === 'Argo Ability');
    const pageCount = Math.ceil(expected.length / 12);
    let markup = select('Catalogue technology types', 'Argo Ability');
    const ordered = [];
    for (let page = 0; page < pageCount; page++) {
      ordered.push(...tiles.map(tile => tile.card));
      if (page < pageCount - 1) { state.splice(10); buttons.get('Next page').onPress(); markup = render(); }
    }
    assert.deepEqual(ordered.map(card => card.id).sort(), expected.map(card => card.id).sort());
    assert.deepEqual([...new Set(ordered.map(card => card.faces[0].cycle))], ['Cycle V', 'Cycle IV', 'Cycle III', 'Cycle II', 'Cycle I']);
    for (const label of ['Cycle V', 'Cycle IV', 'Cycle III', 'Cycle II', 'Cycle I']) {
      const names = ordered.filter(card => card.faces[0].cycle === label).map(card => technologies.technologyName(card, 'technology'));
      assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), `${label} is alphabetically ordered across pagination`);
    }
    assert.match(markup, /role="heading"[^>]*>Cycle I</);
  } finally { Module._load = load; }
});
