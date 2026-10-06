import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import * as campaign from '../src/domain/campaign.ts';
import * as inventory from '../src/domain/inventory.ts';

const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server'), ts = require('typescript');
const web = require('react-native-web');
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));

// Exercise the actual Cargo screen callbacks with the real search and inventory reducer.
// Layout-only dependencies are replaced so this runs without a browser or native modules.
for (const entry of ['Browse catalogue', 'Add acquired Gear']) test(`${entry} searches and acquires Gear within Cargo`, () => {
  let party = { ...createParty('p', ['a', 'b', 'c', 'd'], catalogue.version), campaignCycle: 2,
    inventory: { version: 1, enforce: true, gear: {}, titans: [] } };
  const state = [], hidden = new Set(), buttons = new Map(), inputs = new Map(), navigation = [];
  let cursor = 0, results;
  const Button = props => {
    buttons.set(props.label, props);
    return React.createElement('button', { disabled: props.disabled }, props.label);
  };
  const load = Module._load;
  Module._load = function(request, parent, ...args) {
    if (parent?.filename === filename) {
      const mocks = {
        react: { useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; } },
        'expo-router': { router: { push: route => navigation.push(route), replace: route => navigation.push(route) } },
        'react-native': { ...web, useWindowDimensions: () => ({ width: 1200 }), TextInput: props => {
          inputs.set(props.accessibilityLabel, props); return React.createElement('input', { value: props.value, readOnly: true });
        } },
        '../catalogue': { getCatalogue: () => catalogue },
        '../components/Button': { Button },
        '../components/Counter': { Counter: () => null },
        '../components/cards/GearCard': { GearCard: ({ face }) => React.createElement('article', null, face.name) },
        '../components/cards/GearResults': { GearResults: props => { results = props; return React.createElement('div', null, props.cards.map(card => card.faces[0].name).join(', ')); } },
        '../components/cards/SecretCard': { SecretCard: ({ onReveal }) => React.createElement(Button, { label: 'Reveal this card', onPress: onReveal }) },
        '../components/RemovalConfirmation': { RemovalConfirmation: () => null },
        '../components/Sheet': { Sheet: ({ visible, children }) => visible ? React.createElement('section', null, children) : null },
        '../domain/campaign': campaign,
        '../domain/inventory': inventory,
        '../state/PartyProvider': { useParty: () => ({ party, dispatch: action => { party = partyReducer(party, action, catalogue); } }) },
        '../state/SpoilerProvider': {
          CampaignCardVisibility: ({ children }) => children,
          useSpoilers: () => ({ hidden: card => hidden.has(card.id), reveal: id => hidden.delete(id) }),
        },
        '../theme/tokens': { theme: {} },
        './CampaignPage': { CampaignPage: ({ children }) => React.createElement('main', null, children), campaignStyles: {} },
      };
      if (Object.hasOwn(mocks, request)) return mocks[request];
    }
    return load.call(this, request, parent, ...args);
  };
  const filename = fileURLToPath(new URL('../src/campaign/CargoPage.tsx', import.meta.url));
  try {
    const component = new Module(filename); component.filename = filename; component.paths = Module._nodeModulePaths(path.dirname(filename));
    component._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    const render = () => { cursor = 0; buttons.clear(); inputs.clear(); results = undefined; return renderToStaticMarkup(React.createElement(component.exports.CargoPage)); };
    render();
    buttons.get(entry).onPress(); render();
    assert.deepEqual(navigation, [], 'Cargo browsing must not navigate to the read-only catalogue');
    assert.ok(inputs.has('Search Gear to acquire'));
    inputs.get('Search Gear to acquire').onChangeText('puzz'); render();
    assert.deepEqual(results.cards.map(card => card.faces[0].name), ['Puzzle Axe']);
    const axe = results.cards[0];
    hidden.add(axe.id);
    results.onSelect(axe, results.faceForCard(axe)); render();
    assert.equal(buttons.get('Add one acquired copy').disabled, true);
    buttons.get('Reveal this card').onPress();
    let markup = render();
    assert.equal(buttons.get('Add one acquired copy').disabled, false);
    assert.ok(markup.indexOf('Add one acquired copy') < markup.indexOf('<article>'), 'Acquisition action must precede the tall preview');
    buttons.get('Add one acquired copy').onPress(); markup = render();
    assert.match(markup, /Added Puzzle Axe to Cargo/);
    assert.deepEqual(inventory.gearStock(party, axe.id, catalogue), { owned: 1, allocated: 0, available: 1 });
    assert.equal(party.inventory.enforce, true);
    buttons.get('Add one acquired copy').onPress(); render();
    assert.equal(party.inventory.gear[axe.id], 2);
    assert.equal(buttons.get('Add one acquired copy').disabled, true, 'All printed copies are recorded');
  } finally { Module._load = load; }
});
