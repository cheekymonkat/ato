import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { newProfile } from '../src/storage/workspace.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import * as campaign from '../src/domain/campaign.ts';
import * as roster from '../src/domain/titan-roster.ts';
import * as selection from '../src/domain/titan-selection.ts';
import * as references from '../src/domain/references.ts';
import * as inventory from '../src/domain/inventory.ts';
const require = createRequire(import.meta.url), React = require('react'), web = require('react-native-web'), ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const root = fileURLToPath(new URL('../src/campaign/', import.meta.url));
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
function compile(name, mocks) {
  const filename = path.join(root, name), load = Module._load;
  Module._load = function(request, parent, ...args) { return parent?.filename === filename && Object.hasOwn(mocks, request) ? mocks[request] : load.call(this, request, parent, ...args); };
  try {
    const module = new Module(filename); module.filename = filename; module.paths = Module._nodeModulePaths(root);
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
    return module.exports;
  } finally { Module._load = load; }
}
function harness(cycle, withRoster = true) {
  let party = newProfile('p', 'Expedition', catalogue.version, cycle, false, withRoster ? catalogue : undefined).party, cursor = 0;
  const slots = [], buttons = new Map(), dropdowns = new Map(), statusMenus = new Map(); let confirmation, statusConfirmation, editor, route;
  const useState = initial => {
    const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  const dispatch = action => { party = partyReducer(party, action, catalogue); };
  const Button = props => { buttons.set(props.label, props); return React.createElement('button', { disabled: props.disabled, 'aria-label': props.label }, props.children ?? props.label); };
  const mocks = { react: { useState, useEffect() {} }, 'react-native': web,
    'expo-router': { router: { push: value => route = value } },
    '../components/Button': { Button }, '../components/cards/CardIcon': { CardIcon: () => null },
    '../components/Sheet': { Sheet: ({ children, title, subtitle }) => React.createElement('section', null, title, subtitle, children) },
    '../components/RemovalConfirmation': { RemovalConfirmation: props => { confirmation = props; return null; } },
    './TitanStatusConfirmation': { TitanStatusConfirmation: props => { statusConfirmation = props; return null; } },
    '../campaign/TitanStatusConfirmation': { TitanStatusConfirmation: props => { statusConfirmation = props; return null; } },
    './TitanRosterEditor': { TitanRosterEditor: props => { editor = props; return null; } },
    './TitanStatusMenu': { TitanStatusMenu: props => {
      statusMenus.set(props.name, props);
      return React.createElement('button', { 'aria-label': `Change ${props.name} status` }, roster.titanStatusLabel(props.status));
    } },
    '../components/CompactDropdown': { CompactDropdown: props => {
      dropdowns.set(props.label, props);
      return React.createElement('select', { 'aria-label': props.label, value: props.value, onChange() {} }, props.options.map(option =>
        React.createElement('option', { key: option.value, value: option.value, disabled: option.disabled }, option.label)));
    } },
    './CampaignPage': { campaignStyles: {} }, '../theme/tokens': { theme: {} }, '../theme/titan-art': { titanArtwork: () => undefined },
    './ArgoBredWarning': { ArgoBredWarning: () => null }, '../state/SpoilerProvider': { useSpoilers: () => ({ hidden: () => false }) },
    '../state/PartyProvider': { useParty: () => ({ party, dispatch }) }, '../catalogue': { getCatalogue: () => catalogue },
    '../domain/campaign': campaign, '../domain/titan-roster': roster, '../domain/titan-selection': selection, '../domain/references': references, '../domain/inventory': inventory,
  };
  return { mocks, buttons, dropdowns, statusMenus, dispatch, party: () => party, confirmation: () => confirmation, statusConfirmation: () => statusConfirmation, editor: () => editor, route: () => route,
    resetState: () => { slots.length = 0; },
    render: (component, props = { onClose() {} }) => { cursor = 0; buttons.clear(); dropdowns.clear(); statusMenus.clear(); confirmation = statusConfirmation = editor = null; return renderToStaticMarkup(React.createElement(component, props)); } };
}

test('Titan management shows the cycle-specific counted tabs, sorts types first, and moves individual cards between health tabs', () => {
  const h = harness(2), { ArgoTitans } = compile('ArgoTitans.tsx', h.mocks), render = () => h.render(ArgoTitans);
  let html = render();
  for (const label of ['Alive · 10', 'Crippled · 0', 'Dead · 0']) assert.ok(h.buttons.has(label));
  assert.ok(html.indexOf('Earthshaker') < html.indexOf('Logicbreaker'));
  assert.ok(html.indexOf('Logicbreaker') < html.indexOf('Mazerunner'));
  assert.ok(html.indexOf('Mazerunner') < html.indexOf('Spartan Dreamwalker'));
  assert.deepEqual(h.statusMenus.get('Earthshaker').statuses, ['alive', 'crippled', 'dead']);
  const before = h.party();
  h.statusMenus.get('Earthshaker').onChange('crippled'); render();
  assert.equal(h.party(), before); assert.equal(h.statusConfirmation().status, 'crippled');
  h.statusConfirmation().onCancel(); render(); assert.equal(h.party(), before);
  h.statusMenus.get('Earthshaker').onChange('crippled'); render(); h.statusConfirmation().onConfirm(); html = render();
  assert.ok(h.buttons.has('Crippled · 1')); assert.ok(h.buttons.has('Alive · 9'));
  assert.match(html, /10 \/ 15 occupied places/);
  h.buttons.get('Crippled · 1').onPress(); html = render();
  assert.match(html, /Earthshaker/); assert.doesNotMatch(html, /Spartan Dreamwalker default/);
  const crippled = h.party();
  h.statusMenus.get('Earthshaker').onChange('dead'); render();
  assert.equal(h.party(), crippled); assert.equal(h.statusConfirmation().status, 'dead');
  h.statusConfirmation().onConfirm(); html = render(); assert.ok(h.buttons.has('Dead · 1'));
  h.buttons.get('Dead · 1').onPress(); html = render();
  assert.match(html, /Earthshaker/); assert.match(html, /9 \/ 15 occupied places/);
  h.statusMenus.get('Earthshaker').onChange('alive'); render();
  assert.ok(h.buttons.has('Alive · 10')); assert.equal(h.party().titanRoster.titans.find(titan => roster.rosterTitanName(titan, catalogue) === 'Earthshaker').status, 'alive');
  const one = harness(1), component = compile('ArgoTitans.tsx', one.mocks).ArgoTitans;
  one.render(component); assert.equal([...one.buttons.keys()].some(label => /Crippled/.test(label)), false);
  assert.deepEqual(one.statusMenus.get('Dreamwalker').statuses, ['alive', 'dead']);
  assert.equal(one.buttons.get('Add Titan').disabled, true);
});

test('Titan deletion goes through confirmation and editing opens the correct individual', () => {
  const h = harness(2), { ArgoTitans } = compile('ArgoTitans.tsx', h.mocks), render = () => h.render(ArgoTitans);
  render(); h.buttons.get('Edit Earthshaker Patterns').onPress(); render();
  assert.equal(roster.rosterTitanName(h.editor().record, catalogue), 'Earthshaker');
  h.editor().onClose(); render(); h.statusMenus.get('Earthshaker').onDelete(); render();
  assert.equal(h.party().titanRoster.titans.length, 10); assert.equal(h.confirmation().subject, 'Earthshaker');
  h.confirmation().onCancel(); render(); assert.equal(h.party().titanRoster.titans.length, 10);
  h.statusMenus.get('Earthshaker').onDelete(); render(); h.confirmation().onConfirm(); render();
  assert.equal(h.party().titanRoster.titans.length, 9);
  h.buttons.get('Add Titan').onPress(); render(); assert.equal(h.editor().record, null);
});

test('Argonaut Titan health actions require confirmation before updating the Argo roster and loadout', () => {
  for (const [cycle, status] of [[1, 'dead'], [2, 'dead'], [2, 'crippled']]) {
    const h = harness(cycle), titan = h.party().titanRoster.titans[0]; let closed = 0;
    h.dispatch({ type: 'titan', argonautId: 'arg-1', titan: { id: 'arg-1:titan', rosterId: titan.id,
      definitionId: titan.definitionId, faceId: titan.faceId, exhausted: false, enabledEffectIds: [], counters: {} } });
    if (cycle === 2) h.dispatch({ type: 'table-override', argonautId: 'arg-1', kind: 'Trauma', reference: {
      definitionId: catalogue.byName('Harsh Conditioning')[0].id, faceId: 'front',
    } });
    const before = h.party(), patterns = before.titanRoster.titans[0].patterns;
    const { TitanSelectionMenu } = compile('../dashboard/TitanSelectionMenu.tsx', h.mocks);
    const render = () => h.render(TitanSelectionMenu, { argonaut: h.party().argonauts[0], onClose: () => closed++ });
    const html = render();
    assert.ok(html.indexOf('Mark Titan Dead') < html.indexOf('Remove Titan'));
    assert.equal(h.buttons.has('Mark Titan Crippled'), cycle >= 2);
    if (cycle >= 2) assert.ok(html.indexOf('Mark Titan Crippled') < html.indexOf('Remove Titan'));
    const actionLabel = status === 'dead' ? 'Mark Titan Dead' : 'Mark Titan Crippled';
    h.buttons.get(actionLabel).onPress(); render();
    assert.equal(h.party(), before); assert.equal(closed, 0);
    assert.equal(h.statusConfirmation().status, status);
    h.statusConfirmation().onCancel(); render(); assert.equal(h.party(), before); assert.equal(closed, 0);
    h.buttons.get(actionLabel).onPress(); render(); h.statusConfirmation().onConfirm();
    assert.equal(closed, 1); assert.equal(h.party().argonauts[0].titan, null);
    assert.deepEqual(h.party().argonauts[0].tableOverrides, roster.emptyTitanPatterns());
    assert.equal(h.party().titanRoster.titans[0].status, status);
    assert.deepEqual(h.party().titanRoster.titans[0].patterns, patterns);
    assert.equal(h.party().argonauts[1], before.argonauts[1]);
    render(); assert.equal(h.buttons.has('Mark Titan Dead'), false);

    h.resetState(); const { ArgoTitans } = compile('ArgoTitans.tsx', h.mocks); h.render(ArgoTitans);
    assert.ok(h.buttons.has('Alive · 9'));
    assert.ok(h.buttons.has(status === 'dead' ? 'Dead · 1' : 'Crippled · 1'));
  }
});

test('Argonaut health actions convert older saves while preserving the individual and its Patterns', () => {
  const h = harness(2, false), card = catalogue.byName('Earthshaker')[0];
  h.dispatch({ type: 'titan', argonautId: 'arg-1', titan: { id: 'arg-1:titan', definitionId: card.id,
    faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} } });
  const reference = { definitionId: catalogue.byName('Harsh Conditioning')[0].id, faceId: 'front' };
  h.dispatch({ type: 'table-override', argonautId: 'arg-1', kind: 'Trauma', reference });
  assert.equal(h.party().titanRoster, undefined);
  const { TitanSelectionMenu } = compile('../dashboard/TitanSelectionMenu.tsx', h.mocks);
  const render = () => h.render(TitanSelectionMenu, { argonaut: h.party().argonauts[0], onClose() {} });
  render(); h.buttons.get('Mark Titan Crippled').onPress(); render();
  assert.equal(h.party().titanRoster, undefined); assert.ok(h.party().argonauts[0].titan);
  h.statusConfirmation().onConfirm();
  assert.equal(h.party().argonauts[0].titan, null);
  assert.equal(h.party().titanRoster.titans[0].id, 'legacy:arg-1');
  assert.equal(h.party().titanRoster.titans[0].status, 'crippled');
  assert.deepEqual(h.party().titanRoster.titans[0].patterns.trauma, reference);
});

test('Dead and Crippled confirmations require the checkbox and support cancellation', () => {
  for (const status of ['dead', 'crippled']) {
    const h = harness(2), { TitanStatusConfirmation } = compile('TitanStatusConfirmation.tsx', h.mocks);
    let confirmed = 0, cancelled = 0;
    const label = roster.titanStatusLabel(status), render = () => h.render(TitanStatusConfirmation, {
      name: 'Earthshaker', status, onConfirm: () => confirmed++, onCancel: () => cancelled++,
    });
    assert.match(render(), /Any Argonaut assignment will be cleared/);
    assert.equal(h.buttons.get(`Confirm ${label}`).disabled, true);
    h.buttons.get(`Confirm ${label}`).onPress(); assert.equal(confirmed, 0);
    h.buttons.get(`I confirm marking Earthshaker ${label}`).onPress(); render();
    assert.equal(h.buttons.get(`Confirm ${label}`).disabled, false);
    h.buttons.get(`I confirm marking Earthshaker ${label}`).onPress(); render();
    assert.equal(h.buttons.get(`Confirm ${label}`).disabled, true);
    h.buttons.get('Cancel').onPress(); assert.equal(cancelled, 1); assert.equal(confirmed, 0);
    h.buttons.get(`I confirm marking Earthshaker ${label}`).onPress(); render();
    h.buttons.get(`Confirm ${label}`).onPress(); assert.equal(confirmed, 1);
  }
});

test('status badge dropdown offers alternative states, dismisses outside and keeps red Delete last', () => {
  const h = harness(2), presses = new Map(), changes = []; let deleted = 0;
  h.mocks.react.useRef = () => ({ current: { measureInWindow: callback => callback(250, 100, 80, 44) } });
  h.mocks['react-native'] = { ...web, useWindowDimensions: () => ({ width: 390, height: 844 }),
    Modal: ({ visible, children }) => visible ? React.createElement(React.Fragment, null, children) : null,
    Pressable: props => { presses.set(props.accessibilityLabel, props); return React.createElement('button', {
      'aria-label': props.accessibilityLabel, 'aria-expanded': props.accessibilityState?.expanded,
    }, props.children); },
    Text: props => React.createElement('span', { style: { color: web.StyleSheet.flatten(props.style)?.color } }, props.children),
  };
  h.mocks['react-native-safe-area-context'] = { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
  h.mocks['../theme/tokens'] = { theme: { danger: '#A3423D', white: '#FFFFFF' } };
  const { TitanStatusMenu } = compile('TitanStatusMenu.tsx', h.mocks);
  let props = { name: 'Earthshaker', status: 'alive', statuses: ['alive', 'crippled', 'dead'], full: false,
    onChange: status => changes.push(status), onDelete: () => deleted++ };
  const render = () => { presses.clear(); return h.render(TitanStatusMenu, props); };
  render(); assert.equal(h.buttons.size, 0);
  assert.equal(presses.get('Change Earthshaker status').accessibilityState.expanded, false);
  presses.get('Change Earthshaker status').onPress(); let html = render();
  assert.equal(presses.get('Change Earthshaker status').accessibilityState.expanded, true);
  assert.deepEqual([...h.buttons.keys()], ['Mark Earthshaker Crippled', 'Mark Earthshaker Dead', 'Delete Earthshaker']);
  assert.match(html, /color:#A3423D[^>]*>Delete<\/span>/);
  presses.get('Dismiss Titan status menu').onPress(); render(); assert.equal(h.buttons.size, 0);
  presses.get('Change Earthshaker status').onPress(); render(); h.buttons.get('Mark Earthshaker Crippled').onPress(); render();
  assert.deepEqual(changes, ['crippled']); assert.equal(h.buttons.size, 0);

  props = { ...props, status: 'crippled' };
  presses.get('Change Earthshaker status').onPress(); render();
  assert.deepEqual([...h.buttons.keys()], ['Mark Earthshaker Alive', 'Mark Earthshaker Dead', 'Delete Earthshaker']);
  h.buttons.get('Delete Earthshaker').onPress(); render(); assert.equal(deleted, 1); assert.equal(h.buttons.size, 0);

  props = { ...props, status: 'dead', full: true };
  presses.get('Change Earthshaker status').onPress(); html = render();
  assert.equal(h.buttons.get('Mark Earthshaker Alive').disabled, true);
  assert.equal(h.buttons.get('Mark Earthshaker Crippled').disabled, true);
  assert.equal(h.buttons.get('Delete Earthshaker').disabled, undefined);
  assert.match(html, /Titan roster full/);
  h.buttons.get('Mark Earthshaker Alive').onPress(); assert.deepEqual(changes, ['crippled']);
  presses.get('Dismiss Titan status menu').onPress(); render();

  props = { ...props, status: 'alive', statuses: ['alive', 'dead'], full: false };
  presses.get('Change Earthshaker status').onPress(); render();
  assert.deepEqual([...h.buttons.keys()], ['Mark Earthshaker Dead', 'Delete Earthshaker']);
});

test('Titan editor uses three dropdowns and disables scarce Pattern copies before saving the new individual', () => {
  const h = harness(2), { TitanRosterEditor } = compile('TitanRosterEditor.tsx', h.mocks), props = { record: null, onClose() {} }, render = () => h.render(TitanRosterEditor, props);
  const html = render(); assert.equal(h.buttons.get('Add Titan').disabled, true);
  assert.equal((html.match(/<select /g) ?? []).length, 3);
  assert.doesNotMatch(html, /Select a card to review/);
  const card = catalogue.byName('Firestarter')[0];
  const types = h.dropdowns.get('Titan type');
  assert.ok(types.options.some(option => option.value === card.id && option.label === 'Firestarter'));
  assert.ok(types.options.some(option => option.label === 'Spartan Dreamwalker'));
  assert.equal(types.options.some(option => option.label === 'Persian Dreamwalker'), false);
  types.onChange(card.id); render();
  assert.equal(h.buttons.get('Add Titan').disabled, false);
  const pattern = catalogue.byName('Mazewalker')[0], reference = { definitionId: pattern.id, faceId: 'front' }, existing = h.party().titanRoster.titans[0];
  h.dispatch({ type: 'titan-roster', partyId: 'p', argonautId: 'arg-1', expectedCycle: 2, edit: { operation: 'patterns', id: existing.id, expected: existing, patterns: { trauma: null, kratos: reference } } });
  render();
  const kratos = h.dropdowns.get('Kratos Pattern'), unavailable = kratos.options.find(option => option.value === `${pattern.id}:front`);
  assert.equal(unavailable.disabled, true); assert.match(unavailable.detail, /assigned/);
  assert.equal(h.dropdowns.get('Trauma Pattern').options.some(option => option.value === `${pattern.id}:front`), false);
  kratos.onChange(unavailable.value); render();
  assert.equal(h.dropdowns.get('Kratos Pattern').value, '');
  assert.equal(h.buttons.get('Add Titan').disabled, false);
  const available = h.dropdowns.get('Kratos Pattern').options.find(option => option.value && !option.disabled);
  assert.ok(available); h.dropdowns.get('Kratos Pattern').onChange(available.value); render();
  assert.equal(h.dropdowns.get('Kratos Pattern').value, available.value);
  h.dropdowns.get('Kratos Pattern').onChange(''); render();
  h.buttons.get('Add Titan').onPress();
  assert.equal(h.party().titanRoster.titans.length, 11);
  assert.equal(roster.rosterTitanName(h.party().titanRoster.titans.at(-1), catalogue), 'Firestarter');
  assert.deepEqual(h.party().titanRoster.titans.at(-1).patterns, { trauma: null, kratos: null });
});
