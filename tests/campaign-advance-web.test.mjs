import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as campaign from '../src/domain/campaign.ts';
import { newProfile } from '../src/storage/workspace.ts';
import { partyReducer } from '../src/state/party-reducer.ts';

const require = createRequire(import.meta.url), React = require('react'), web = require('react-native-web'), ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const root = fileURLToPath(new URL('../src/profiles/', import.meta.url));
function compile(name, mocks) {
  const filename = path.join(root, name), load = Module._load;
  Module._load = function(request, parent, ...args) {
    return parent?.filename === filename && Object.hasOwn(mocks, request) ? mocks[request] : load.call(this, request, parent, ...args);
  };
  try {
    const module = new Module(filename); module.filename = filename; module.paths = Module._nodeModulePaths(root);
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return module.exports;
  } finally { Module._load = load; }
}
function harness() {
  let cursor = 0;
  const slots = [], buttons = new Map();
  const useState = initial => {
    const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
  };
  return { react: { useState, useRef: initial => useState(() => ({ current: initial }))[0] }, buttons,
    Button: props => { buttons.set(props.label, props); return React.createElement('button', { disabled: props.disabled }, props.children ?? props.label); },
    render: (component, props) => { cursor = 0; buttons.clear(); return renderToStaticMarkup(React.createElement(component, props)); },
  };
}

test('existing campaigns only offer confirmed next-cycle advancement while new campaigns can start at any cycle', () => {
  const h = harness(), selectors = new Map(), inputs = new Map(); let confirmation, created;
  let profile = newProfile('p', 'Voyage', 'test-version', 3), preview = false;
  const { PartyProfiles } = compile('PartyProfiles.tsx', {
    react: h.react, 'react-native': { ...web, TextInput: props => { inputs.set(props.accessibilityLabel, props); return null; } },
    'react-native-safe-area-context': { SafeAreaView: web.View }, 'expo-router': { router: { replace: () => {} } },
    '../catalogue': { getCatalogue: () => ({ version: 'test-version' }) }, '../domain/campaign': campaign,
    './CampaignCycleSelector': { CampaignCycleSelector: props => { selectors.set(props.label, props); return null; } },
    './AdvanceCycleConfirmation': { AdvanceCycleConfirmation: props => { confirmation = props; return null; } },
    './InventorySettings': { InventorySettings: () => null }, '../components/Button': { Button: h.Button },
    '../state/PartyProvider': { useParty: () => ({ profile, party: profile.party, workspace: { profiles: [profile] }, preview,
      dispatch: action => { profile = { ...profile, party: partyReducer(profile.party, action) }; },
      createProfile: (...args) => { created = args; return 'a'; } }) },
    '../storage/files': {}, '../storage/SaveNotice': { SaveNotice: () => null }, '../storage/snapshots': { errorMessage: String },
    '../storage/workspace': { referenceProblems: () => [] },
    '../theme/tokens': { theme: {} },
  });
  const render = () => { selectors.clear(); inputs.clear(); confirmation = null; return h.render(PartyProfiles); };
  assert.match(render(), /Current Cycle: 3/);
  assert.equal(selectors.has('Current campaign'), false); assert.equal(h.buttons.has('Save campaign cycle'), false);
  inputs.get('New party name').onChangeText('Later start'); selectors.get('New campaign').onChange(5); render();
  h.buttons.get('Create campaign').onPress(); assert.deepEqual(created, ['Later start', 5, false]);
  h.buttons.get('Advance cycle').onPress(); render(); assert.equal(profile.party.campaignCycle, 3);
  assert.equal(confirmation.cycle, 3); confirmation.onCancel(); render(); assert.equal(confirmation, null); assert.equal(profile.party.campaignCycle, 3);
  h.buttons.get('Advance cycle').onPress(); render();
  const confirm = confirmation.onConfirm; confirm(); confirm(); render();
  assert.equal(profile.party.campaignCycle, 4, 'Repeated confirmation does not skip a cycle'); assert.equal(confirmation, null);
  h.buttons.get('Advance cycle').onPress(); render(); confirmation.onConfirm(); render();
  assert.equal(profile.party.campaignCycle, 5); assert.equal(h.buttons.get('Advance cycle').disabled, true);
  assert.match(render(), /Cycle 5 is the final cycle/);
  profile = newProfile('other', 'Second campaign', 'test-version', 2); render();
  h.buttons.get('Advance cycle').onPress(); render(); const stale = confirmation;
  profile = newProfile('third', 'Third campaign', 'test-version', 1); render(); assert.equal(confirmation, null);
  stale.onConfirm(); render(); assert.equal(profile.party.campaignCycle, 1, 'Old warning cannot advance another campaign');
  preview = true; render(); assert.equal(h.buttons.get('Advance cycle').disabled, true);
});

test('advance warning requires acknowledgement and cannot confirm while disabled', () => {
  const h = harness(); let advances = 0, cancelled = 0;
  const { AdvanceCycleConfirmation } = compile('AdvanceCycleConfirmation.tsx', {
    react: h.react, 'react-native': web, '../components/Button': { Button: h.Button },
    '../components/Sheet': { Sheet: ({ children }) => React.createElement('section', null, children) },
    '../domain/campaign': campaign,
    '../theme/tokens': { theme: {} },
  });
  const props = { campaignName: 'Voyage', cycle: 2, onConfirm: () => advances++, onCancel: () => cancelled++ };
  assert.match(h.render(AdvanceCycleConfirmation, props), /cannot return to an earlier cycle or skip a cycle/);
  const advance = () => h.buttons.get('Advance to Cycle 3');
  assert.equal(advance().disabled, true); advance().onPress(); assert.equal(advances, 0);
  h.buttons.get('Cancel').onPress(); assert.equal(cancelled, 1); assert.equal(advances, 0);
  h.buttons.get('I understand that advancing the cycle cannot be undone').onPress(); h.render(AdvanceCycleConfirmation, props);
  assert.equal(advance().disabled, false);
  h.render(AdvanceCycleConfirmation, { ...props, disabled: true }); assert.equal(advance().disabled, true); advance().onPress(); assert.equal(advances, 0);
  h.render(AdvanceCycleConfirmation, props); advance().onPress(); assert.equal(advances, 1);
  assert.equal(h.render(AdvanceCycleConfirmation, { ...props, cycle: 5 }), '', 'No advancement warning after final cycle');
});
