import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import * as argo from '../src/domain/argo.ts';
import * as campaign from '../src/domain/campaign.ts';
import * as technology from '../src/domain/technologies.ts';
import * as milestones from '../src/domain/milestones.ts';
import * as milestoneRules from '../src/domain/milestone-rules.ts';
import * as inwardOdyssey from '../src/domain/inward-odyssey.ts';
import { newProfile } from '../src/storage/workspace.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
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
function harness(cycle = 1) {
  let party = newProfile('p', 'Expedition', catalogue.version, cycle).party, cursor = 0;
  const slots = [], buttons = new Map(), inputs = new Map();
  const useState = initial => {
    const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  };
  const dispatch = action => { party = partyReducer(party, action, catalogue); };
  const Button = props => { buttons.set(props.label, props); return React.createElement('button', { disabled: props.disabled, 'aria-label': props.label }, props.children ?? props.label); };
  const TextInput = props => { inputs.set(props.accessibilityLabel, props); return null; };
  return { react: { useState }, Button, TextInput, buttons, inputs, party: () => party,
    partyContext: { useParty: () => ({ party, dispatch }) },
    render: (component, props) => { cursor = 0; buttons.clear(); inputs.clear(); return renderToStaticMarkup(React.createElement(component, props)); },
    mocks: { react: { useState }, 'react-native': { ...web, TextInput }, '../components/Button': { Button },
      'expo-router': { router: { push: () => {} } },
      '../components/Sheet': { Sheet: ({ children }) => React.createElement('section', null, children) },
      './CampaignPage': { campaignStyles: {}, CampaignPage: ({ children }) => React.createElement('main', null, children) },
      '../theme/tokens': { theme: { ink: '#292723', paper: '#FAF9F6', serif: 'Georgia' } },
      '../state/PartyProvider': { useParty: () => ({ party, dispatch }) },
      '../catalogue': { getCatalogue: () => catalogue }, '../domain/campaign': campaign, '../domain/argo': argo, '../domain/technologies': technology,
      '../domain/inward-odyssey': inwardOdyssey },
  };
}
const references = argo.ARGO_RECORD_IDS.map(id => ({ id, name: id === 'titans' ? 'Titans' : id, icon: 'Argo' }));

function milestoneHarness(cycle, kind) {
  const h = harness(cycle); let route;
  const { ArgoMilestoneCard } = compile('ArgoMilestoneCard.tsx', { ...h.mocks,
    '../domain/milestones': milestones, '../domain/milestone-rules': milestoneRules,
    '../components/cards/CardIcon': { CardIcon: () => null },
    'expo-router': { router: { push: value => route = value } },
  });
  const render = () => h.render(ArgoMilestoneCard, { kind });
  const press = label => { h.buttons.get(label).onPress(); return render(); };
  const edit = (token, value) => {
    press(`Edit ${kind === 'story' ? 'Story' : 'Doom'} ${token}`);
    h.inputs.get(`${kind === 'story' ? 'Story' : 'Doom'} ${token} current value`).onChangeText(String(value));
    return render();
  };
  return { ...h, render, press, edit, route: () => route };
}

test('Story selectors follow A/B order, hide targetless counters and open the exact selected side', () => {
  const h = milestoneHarness(1, 'story');
  assert.match(h.render(), /The Absent Rule/);
  assert.equal(h.buttons.get('Previous Story card').disabled, true);
  h.press('Increase Story Progress');
  assert.equal(milestones.currentMilestone(h.party(), 'story', catalogue).tokens.Progress, 1);
  h.press('Next Story card');
  assert.equal(milestones.currentMilestone(h.party(), 'story', catalogue).side.label, '1B');
  assert.equal(h.buttons.has('Edit Story Progress'), false);
  h.press('Next Story card'); h.edit('Progress', 9);
  h.press('Save tokens');
  assert.equal(h.buttons.get('Increase Story Progress').disabled, true);
  assert.equal(milestones.currentMilestone(h.party(), 'story', catalogue).side.label, '2A');
  h.press('Next Story card'); assert.equal(h.buttons.has('Edit Story Progress'), false);
  h.press('Next Story card'); assert.match(h.render(), /Checkpoints: 2 · 5 · 9/);
  h.press('Choose Story card');
  const labels = [...h.buttons.keys()].filter(label => /^Story \d[AB] ·/.test(label));
  assert.deepEqual(labels.map(label => label.slice(6, 8)), ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B']);
  h.press(labels.at(-1));
  assert.equal(h.buttons.get('Next Story card').disabled, true);
  const selected = milestones.currentMilestone(h.party(), 'story', catalogue).side;
  h.press(`View Story card 4B: ${selected.face.name}`);
  assert.deepEqual(h.route(), { pathname: '/cards/[id]', params: { id: selected.card.id, face: 'back' } });
});

test('at-least Story counters display a limit of 50 and retain their printed requirement and checkpoints', () => {
  const h = milestoneHarness(2, 'story'); h.render(); h.press('Choose Story card');
  h.press('Story 2B · Black Nadir');
  assert.match(h.render(), /Required: at least 10/);
  assert.match(h.render(), /Checkpoints: 10 · 15 · 20/);
  assert.match(renderToStaticMarkup(h.buttons.get('Edit Story Progress').children), /50/);
  h.edit('Progress', 51); assert.equal(h.buttons.get('Save tokens').disabled, true);
  h.buttons.get('Save tokens').onPress(); h.render();
  assert.equal(milestones.currentMilestone(h.party(), 'story', catalogue).tokens.Progress, 0);
  h.inputs.get('Story Progress current value').onChangeText('50'); h.render();
  h.press('Save tokens');
  assert.equal(h.buttons.get('Increase Story Progress').disabled, true);
  h.buttons.get('Increase Story Progress').onPress(); h.render();
  assert.equal(milestones.currentMilestone(h.party(), 'story', catalogue).tokens.Progress, 50);
});

test('Cycle IV Doom enforces both token limits and resets investment when advancing', () => {
  const h = milestoneHarness(4, 'doom'); h.render();
  h.edit('Doom', 6); assert.equal(h.buttons.get('Save tokens').disabled, true);
  h.inputs.get('Doom Doom current value').onChangeText('5'); h.render(); h.press('Save tokens');
  h.edit('Progress', 3); h.press('Save tokens');
  assert.equal(h.buttons.get('Increase Doom Doom').disabled, true);
  assert.equal(h.buttons.get('Increase Doom Progress').disabled, true);
  h.press('Next Doom card');
  const current = milestones.currentMilestone(h.party(), 'doom', catalogue);
  assert.equal(current.side.label, '1B'); assert.equal(current.side.face.name, 'Market Forces');
  assert.deepEqual(current.tokens, { Doom: 0, Progress: 0 });
  assert.deepEqual(current.side.tokens.map(rule => rule.target), [6, 4]);
});

test('Cycle V Story countdown starts at the printed count, reaches zero and leaves advancement manual', () => {
  const h = milestoneHarness(5, 'story'); h.render();
  assert.equal(h.buttons.get('Increase Story Progress').disabled, true);
  for (let i = 0; i < 4; i++) h.press('Decrease Story Progress');
  assert.equal(h.buttons.get('Decrease Story Progress').disabled, true);
  assert.equal(milestones.currentMilestone(h.party(), 'story', catalogue).side.label, '1A');
  h.press('Next Story card');
  assert.equal(milestones.currentMilestone(h.party(), 'story', catalogue).tokens.Progress, 3);
});

test('Argo overview updates campaign totals, edits milestones and keeps resources and notes below shortcuts', () => {
  const h = harness(2); let editor, reference, titans = false, notes, route;
  const { ArgoPage } = compile('ArgoPage.tsx', { ...h.mocks,
    'expo-router': { router: { push: value => route = value } },
    '../components/cards/CardIcon': { CardIcon: () => null }, '../components/Icon': { MenuIcon: () => null },
    './ArgoTrackEditor': { ArgoTrackEditor: props => { editor = props; return null; } },
    './ArgoMilestoneCard': { ArgoMilestoneCard: props => React.createElement('article', null, props.kind) },
    './ArgoReferences': { ARGO_REFERENCES: references, ArgoReferences: props => { reference = props; return null; } },
    './ArgoTitans': { ArgoTitans: () => { titans = true; return null; } },
    '../dashboard/SharedResources': { SharedResources: () => React.createElement('h2', null, 'Shared resources') },
    './GrowingNotes': { GrowingNotes: props => { notes = props; return null; } },
  });
  const render = () => { editor = null; reference = null; titans = false; return h.render(ArgoPage); };
  const html = render();
  assert.ok(html.indexOf('Campaign references') < html.indexOf('Shared resources'));
  assert.ok(html.indexOf('Shared resources') < html.indexOf('Campaign notes'));
  assert.doesNotMatch(html, /Available Titans|Campaign settings &amp; backups|Open Cargo/);
  assert.match(html, /Humanity/); assert.doesNotMatch(html, /Strangers|Paranoia/);
  assert.match(html, /Titans/);
  assert.equal(h.buttons.has('Increase Titan Limit'), false);
  assert.equal(h.buttons.has('Decrease Titan Limit'), false);
  assert.equal(h.buttons.has('Edit Titan Limit'), false);
  assert.match(renderToStaticMarkup(h.buttons.get('Manage Titans').children), />15</);
  h.buttons.get('View Titan limit technologies').onPress(); assert.equal(route, '/technology');
  h.buttons.get('Increase Argo Knowledge').onPress(); render();
  assert.equal(h.party().resources['Argo Knowledge'], 21);
  h.buttons.get('Decrease Humanity').onPress(); render(); assert.equal(h.party().argo.tracks['2:humanity'].value, -1);
  h.buttons.get('Edit Inwards Odyssey').onPress(); render(); assert.equal(editor.track.value, 0);
  editor.onSave(1, 2, ''); render();
  assert.equal(editor, null, 'Saving closes the editor');
  notes.onChange('Catharsis D11'); render(); assert.equal(h.party().campaignNotes, 'Catharsis D11');
  h.buttons.get('decks').onPress(); render(); assert.equal(reference.id, 'decks');
  reference.onClose(); render(); assert.equal(reference, null);
  h.buttons.get('Titans').onPress(); render(); assert.equal(titans, true);
  h.buttons.get('Edit Hull').onPress(); render(); editor.onSave(5, 5, ''); render();
  assert.equal(h.buttons.get('Increase Hull').disabled, true);
  h.buttons.get('Increase Hull').onPress(); render();
  assert.equal(h.party().argo.tracks.hull.value, 5, 'A stale callback cannot exceed the cap');
  h.buttons.get('Decrease Hull').onPress(); render();
  assert.equal(h.buttons.get('Increase Hull').disabled, false);
  h.buttons.get('Increase Hull').onPress(); render();
  assert.equal(h.party().argo.tracks.hull.value, 5);
});

test('Inward Odyssey converts the second Progress, shows the exact adventure without a duplicate Knowledge label, and links to its card side', () => {
  const h = harness(2); let editor, route;
  const { ArgoPage } = compile('ArgoPage.tsx', { ...h.mocks,
    'expo-router': { router: { push: value => route = value } },
    '../components/cards/CardIcon': { CardIcon: () => null }, '../components/Icon': { MenuIcon: () => null },
    './ArgoTrackEditor': { ArgoTrackEditor: props => { editor = props; return null; } },
    './ArgoMilestoneCard': { ArgoMilestoneCard: () => null },
    './ArgoReferences': { ARGO_REFERENCES: [], ArgoReferences: () => null },
    './ArgoTitans': { ArgoTitans: () => null },
    '../dashboard/SharedResources': { SharedResources: () => null }, './GrowingNotes': { GrowingNotes: () => null },
  });
  const render = () => { editor = null; return h.render(ArgoPage); };
  assert.match(render(), /No adventure at this Knowledge value/);
  h.buttons.get('Edit Argo Knowledge').onPress(); render(); editor.onSave(21, 40, '');
  assert.match(render(), /21: Land of the Strong and Free/);
  h.buttons.get('Increase Inwards Odyssey').onPress(); render();
  h.buttons.get('Increase Inwards Odyssey').onPress();
  const html = render();
  assert.match(html, /22: The Price of Difference/); assert.doesNotMatch(html, /Argo Knowledge: 22/);
  assert.equal(argo.argoTrack(h.party(), argo.argoTrackDefinition('inwards', 2), catalogue).value, 0);
  assert.equal(h.party().resources['Argo Knowledge'], 22);
  h.buttons.get('View Inward Odyssey card: Inward Odyssey: Abysswatchers').onPress();
  assert.deepEqual(route, { pathname: '/cards/[id]', params: { id: inwardOdyssey.currentInwardOdyssey(h.party(), catalogue).card.id, face: 'front' } });
  h.buttons.get('Edit Argo Knowledge').onPress(); render(); editor.onSave(30, 40, ''); render();
  h.buttons.get('Edit Inwards Odyssey').onPress(); render(); editor.onSave(2, 2, '');
  assert.match(render(), /31: Blood of the Earth/);
  h.buttons.get('View Inward Odyssey card: Inward Odyssey: Abysswatchers').onPress();
  assert.equal(route.params.face, 'back');
});

test('Inward Odyssey exact-value editor has a fixed target and explains its Knowledge conversion', () => {
  const h = harness(); let saved;
  const { ArgoTrackEditor } = compile('ArgoTrackEditor.tsx', h.mocks);
  const definition = argo.argoTrackDefinition('inwards', 1), props = { definition, track: { value: 1, limit: 2 },
    onSave: (...values) => saved = values, onClose: () => {} };
  const render = () => h.render(ArgoTrackEditor, props);
  assert.match(render(), /Setting Progress to 2 resets it to 0 and adds 1 Argo Knowledge/);
  assert.equal(h.inputs.has('Inwards Odyssey limit'), false);
  h.inputs.get('Inwards Odyssey current value').onChangeText('2'); render();
  assert.equal(h.buttons.get('Save track').disabled, false);
  h.buttons.get('Save track').onPress(); assert.deepEqual(saved, [2, 2, '']);
  h.inputs.get('Inwards Odyssey current value').onChangeText('3'); render();
  assert.equal(h.buttons.get('Save track').disabled, true);
});

test('Fate and Knowledge editors keep total inputs but display read-only limits', () => {
  for (const id of ['fate', 'knowledge']) {
    const h = harness(); let saved;
    const { ArgoTrackEditor } = compile('ArgoTrackEditor.tsx', h.mocks);
    const definition = argo.SHIP_TRACKS.find(track => track.id === id);
    const props = { definition, track: { value: 0, limit: id === 'fate' ? 9 : 40 }, onSave: (...values) => saved = values, onClose: () => {} };
    const render = () => h.render(ArgoTrackEditor, props);
    const html = render();
    assert.equal(h.inputs.has(`${definition.name} limit`), false);
    assert.equal(h.inputs.has(`${definition.name} current value`), true);
    assert.match(html, id === 'fate' ? /Fixed campaign limit/ : /Set by the campaign cycle/);
    h.inputs.get(`${definition.name} current value`).onChangeText(String(props.track.limit + 1)); render();
    assert.equal(h.buttons.get('Save track').disabled, true);
    h.buttons.get('Save track').onPress(); assert.equal(saved, undefined);
    h.inputs.get(`${definition.name} current value`).onChangeText(String(props.track.limit)); render();
    assert.equal(h.buttons.get('Save track').disabled, false);
    h.buttons.get('Save track').onPress(); assert.deepEqual(saved, [props.track.limit, props.track.limit, '']);
    props.track = { value: 0, limit: props.track.limit + 1 };
    render();
    h.buttons.get('Save track').onPress(); assert.equal(saved[1], props.track.limit, 'Read-only limits follow live props');
  }
});

test('direct editor blocks values above a limit and limits below the value, permitting the exact boundary', () => {
  const h = harness(); let saved;
  const { ArgoTrackEditor } = compile('ArgoTrackEditor.tsx', h.mocks);
  const props = { definition: argo.SHIP_TRACKS[0], track: { value: 5, limit: 5 }, onSave: (...values) => saved = values, onClose: () => {} };
  const render = () => h.render(ArgoTrackEditor, props);
  render(); assert.equal(h.buttons.get('Save track').disabled, false);
  h.inputs.get('Hull current value').onChangeText('6');
  assert.match(render(), /cannot exceed the limit of 5/);
  assert.equal(h.buttons.get('Save track').disabled, true);
  h.buttons.get('Save track').onPress(); assert.equal(saved, undefined);
  h.inputs.get('Hull limit').onChangeText('6'); render();
  h.buttons.get('Save track').onPress(); assert.deepEqual(saved, [6, 6, '']);
  h.inputs.get('Hull limit').onChangeText('0'); render(); assert.equal(h.buttons.get('Save track').disabled, true);
  h.inputs.get('Hull current value').onChangeText('0'); render(); assert.equal(h.buttons.get('Save track').disabled, false);
});

test('Shared Resources applies Argo limits to its counters and rejects adding capped aliases', () => {
  const h = harness();
  const counters = new Map();
  const { SharedResources } = compile('../dashboard/SharedResources.tsx', { ...h.mocks,
    '../components/Counter': { Counter: props => { counters.set(props.name, props); return null; } },
    '../components/RemovalConfirmation': { RemovalConfirmation: () => null },
  });
  const render = () => { counters.clear(); return h.render(SharedResources, { owner: h.party().activeArgonautId }); };
  render(); h.buttons.get('Manage shared resources').onPress(); render();
  h.inputs.get('Shared resource name').onChangeText('Argo Fate'); render();
  h.buttons.get('Add shared resource').onPress(); render();
  assert.equal(counters.get('Argo Fate').max, 9);
  for (let i = 0; i < 8; i++) { counters.get('Argo Fate').onIncrease(); render(); }
  assert.equal(counters.get('Argo Fate').value, 9);
  counters.get('Argo Fate').onIncrease(); render(); assert.equal(counters.get('Argo Fate').value, 9);
  h.inputs.get('Shared resource name').onChangeText('@ArgoFate'); render();
  assert.equal(h.buttons.get('Add shared resource').disabled, true);
  counters.get('Argo Fate').onDecrease(); render();
  assert.equal(h.buttons.get('Add shared resource').disabled, false);
});

test('Shared Resources hides Knowledge, prevents adding its aliases and preserves it when resetting visible resources', () => {
  const h = harness(2), counters = new Map();
  const { SharedResources } = compile('../dashboard/SharedResources.tsx', { ...h.mocks,
    '../components/Counter': { Counter: props => { counters.set(props.name, props); return null; } },
    '../components/RemovalConfirmation': { RemovalConfirmation: () => null },
  });
  const render = () => { counters.clear(); return h.render(SharedResources, { owner: h.party().activeArgonautId }); };
  assert.match(render(), /No shared resources/); assert.doesNotMatch(render(), /Argo Knowledge/);
  h.buttons.get('Manage shared resources').onPress(); render();
  assert.equal(counters.size, 0); assert.equal(h.buttons.get('Reset shared resource amounts').disabled, true);
  for (const name of ['Argo Knowledge', '@ArgoKnowledge', 'argo knowledge', 'ArgoKnowledge']) {
    h.inputs.get('Shared resource name').onChangeText(name); render();
    assert.equal(h.buttons.get('Add shared resource').disabled, true);
    h.buttons.get('Add shared resource').onPress(); render();
    assert.deepEqual(h.party().resources, { 'Argo Knowledge': 20 });
  }
  h.inputs.get('Shared resource name').onChangeText('Ore'); render();
  h.buttons.get('Add shared resource').onPress(); render();
  assert.equal(counters.has('Argo Knowledge'), false); assert.equal(counters.get('Ore').value, 1);
  h.buttons.get('Reset shared resource amounts').onPress(); render();
  assert.deepEqual(h.party().resources, { 'Argo Knowledge': 20, Ore: 0 });
});

test('direct track editor accepts signed Humanity and optional limits, rejects fractions and closes on cancel', () => {
  const h = harness(); let saved, cancelled = false;
  const { ArgoTrackEditor } = compile('ArgoTrackEditor.tsx', h.mocks);
  const props = { definition: argo.VOYAGE_TRACKS.find(track => track.id === 'humanity'), track: { value: 0 }, onSave: (...values) => saved = values, onClose: () => cancelled = true };
  const render = () => h.render(ArgoTrackEditor, props);
  render(); h.inputs.get('Humanity current value').onChangeText('-3'); render();
  assert.equal(h.buttons.get('Save track').disabled, false); h.buttons.get('Save track').onPress(); assert.deepEqual(saved, [-3, null, '']);
  h.inputs.get('Humanity limit').onChangeText('-2'); render(); assert.equal(h.buttons.get('Save track').disabled, true);
  h.inputs.get('Humanity limit').onChangeText('9'); h.inputs.get('Humanity current value').onChangeText('1.5'); render(); assert.equal(h.buttons.get('Save track').disabled, true);
  h.inputs.get('Humanity current value').onChangeText(''); render(); assert.equal(h.buttons.get('Save track').disabled, true);
  h.buttons.get('Cancel').onPress(); assert.equal(cancelled, true);
});

test('reference notebooks save independently; card libraries search, respect spoilers and open full inspection', () => {
  const h = harness(3); let notebook, closed = false, route;
  const { ArgoReferences } = compile('ArgoReferences.tsx', { ...h.mocks,
    'expo-router': { router: { push: value => route = value } },
    '../state/SpoilerProvider': { useSpoilers: () => ({ hidden: card => card.faces[0].name === 'The Absent Rule', reveal: () => {} }) },
    './GrowingNotes': { GrowingNotes: props => { notebook = props; return null; } },
  });
  const props = { id: 'decks', onClose: () => closed = true }, render = () => h.render(ArgoReferences, props);
  render(); notebook.onChange('Story 2A'); render(); assert.equal(h.party().argo.records.decks, 'Story 2A');
  h.buttons.get('Cards').onPress(); const html = render();
  assert.ok(html.indexOf('CYCLE 3') < html.indexOf('CYCLE 2') && html.indexOf('CYCLE 2') < html.indexOf('CYCLE 1'));
  assert.doesNotMatch(html, /The Absent Rule|Cycle IV|Cycle V/);
  h.inputs.get('Search Story cards').onChangeText('Trespassing'); render();
  assert.equal(h.buttons.has('A Phantom Thread'), false);
  h.buttons.get('Trespassing').onPress(); assert.equal(closed, true);
  assert.deepEqual(route, { pathname: '/cards/[id]', params: { id: catalogue.byName('Trespassing')[0].id } });
});
