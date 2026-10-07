import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty } from '../src/domain/party.ts';
import * as conditions from '../src/domain/conditions.ts';
import * as modifiers from '../src/domain/combat-modifiers.ts';
import * as patterns from '../src/domain/pattern-table.ts';
import * as references from '../src/domain/references.ts';
import * as skills from '../src/domain/argonaut-stats.ts';
import { SKILL_NAMES } from '../src/domain/party.ts';
import { grayscaleColour, grayscaleSvg } from '../src/domain/card-colour.ts';
import { patternIcons } from '../src/theme/pattern-icons.ts';
import { patternTheme } from '../src/theme/pattern-tokens.ts';

const require = createRequire(import.meta.url), React = require('react'), web = require('react-native-web'), ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const root = fileURLToPath(new URL('../src/', import.meta.url));
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
function compile(relative, mocks) {
  const filename = path.join(root, relative), original = Module._load;
  Module._load = function(request, parent, ...args) {
    return parent?.filename === filename && Object.hasOwn(mocks, request) ? mocks[request] : original.call(this, request, parent, ...args);
  };
  try {
    const module = new Module(filename); module.filename = filename; module.paths = Module._nodeModulePaths(root);
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return module.exports;
  } finally { Module._load = original; }
}
function harness() {
  const party = createParty('ui', ['a', 'b', 'c', 'd'], catalogue.version), nodes = [], tables = [];
  let view = 'triskelion';
  const native = { ...web, ...Object.fromEntries(['Text', 'View'].map(name => [name, props => {
    nodes.push({ ...props, style: web.StyleSheet.flatten(props.style) });
    return React.createElement(web[name], props);
  }])) };
  const svg = Object.fromEntries(['Defs', 'LinearGradient', 'Polygon', 'Rect', 'Stop'].map(name => [name, props => {
    nodes.push({ ...props, svgType: name });
    return React.createElement(name === 'LinearGradient' ? 'linearGradient' : name.toLowerCase(), props);
  }]));
  svg.default = props => React.createElement('svg', props);
  svg.__esModule = true;
  svg.SvgXml = props => { nodes.push({ xml: props.xml }); return React.createElement('span'); };
  const palette = compile('theme/tokens.ts', { 'react-native': web });
  const Button = ({ label, children, disabled }) => React.createElement('button', { 'aria-label': label, disabled }, children ?? label);
  const base = {
    react: { ...React, useState: initial => React.useState(initial === 'triskelion' ? view : initial) },
    'react-native': native, 'react-native-svg': svg,
    '../catalogue': { getCatalogue: () => catalogue }, '../theme/tokens': palette,
    '../state/PartyProvider': { useParty: () => ({ party, dispatch() {} }) },
    '../domain/conditions': conditions, '../domain/combat-modifiers': modifiers,
    '../components/Button': { Button }, './Button': { Button },
  };
  const Counter = compile('components/Counter.tsx', base).Counter;
  const PatternTable = compile('components/PatternTable.tsx', { ...base,
    '../domain/pattern-table': patterns, '../domain/card-colour': { grayscaleColour, grayscaleSvg },
    '../theme/pattern-icons': { patternIcons }, '../theme/pattern-tokens': { patternTheme },
  }).PatternTable;
  const StatsSwitcher = compile('dashboard/StatsSwitcher.tsx', { ...base, '../components/Counter': { Counter },
    '../components/Icon': { GameIcon: () => null }, '../domain/argonaut-stats': skills, '../domain/party': { SKILL_NAMES },
  }).StatsSwitcher;
  const ReferenceDialog = compile('dashboard/ReferenceDialog.tsx', { ...base, '../domain/references': references,
    '../components/PatternTable': { PatternTable: props => { tables.push(props); return React.createElement(PatternTable, props); } },
    '../components/cards/ReferenceCard': { ReferenceCard: props => { tables.push(props); return null; } },
    '../components/Sheet': { Sheet: ({ children }) => React.createElement('section', null, children) },
    '../components/RemovalConfirmation': { RemovalConfirmation: () => null },
    '../domain/titan-selection': { titanDisplayName: face => face.name }, '../domain/titan-roster': { patternIssue() {} },
    '../references/ReferencePicker': { ReferencePicker: () => null },
    '../state/SpoilerProvider': { useSpoilers: () => ({ hidden: () => false }) },
  }).ReferenceDialog;
  return { party, nodes, tables, StatsSwitcher, PatternTable, ReferenceDialog, setView: value => { view = value; },
    render(component, props) { nodes.length = 0; tables.length = 0; return renderToStaticMarkup(React.createElement(component, props)); } };
}
const reference = name => ({ definitionId: catalogue.byName(name)[0].id, faceId: 'front' });
function rouse(owner) {
  owner.conditions = [{ id: 'roused', name: 'Roused', reference: reference('Roused'), amount: 1, source: '', duration: '' }];
}

test('Roused renders a red title suffix while editable and read-only Rage stay at the saved value', () => {
  const h = harness(), owner = h.party.argonauts[0]; owner.counters.rage = 5; rouse(owner);
  let html = h.render(h.StatsSwitcher, { argonaut: owner, onCounterChange() {} });
  assert.match(html, /\(\+1\)/);
  assert.ok(h.nodes.some(node => node.accessibilityLabel === 'Rage: 5'));
  assert.ok(h.nodes.some(node => node.accessibilityLabel?.startsWith('Roused:') && node.style.color === modifiers.MODIFIED_STAT_COLOUR));
  assert.doesNotMatch(html, /Increase Rage \(/, 'Counter action labels retain the original stat name');
  h.setView('argonaut'); html = h.render(h.StatsSwitcher, { argonaut: owner, onCounterChange() {} });
  assert.match(html, /\(\+1\)/); assert.ok(h.nodes.some(node => node.accessibilityLabel === 'Rage: 5'));
  owner.conditions = []; html = h.render(h.StatsSwitcher, { argonaut: owner, onCounterChange() {} });
  assert.doesNotMatch(html, /\(\+1\)/); assert.equal(owner.counters.rage, 5);
});

test('Kratos badges turn red through current Rage and unused rows are muted; catalogue previews stay neutral', () => {
  const h = harness(), table = catalogue.byName('Pandoran Strain')[0].faces[0].data.kratosTable;
  h.render(h.PatternTable, { kind: 'Kratos', table, currentValue: 5 });
  assert.deepEqual(h.nodes.filter(node => node.style?.color === modifiers.MODIFIED_STAT_COLOUR).map(node => node.children),
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(h.nodes.find(node => node.testID === 'pattern-row-Kratos-6').style.opacity, 0.55);
  assert.match(h.nodes.find(node => node.testID === 'pattern-row-Kratos-5').accessibilityLabel, /active at Rage 5/);
  h.render(h.PatternTable, { kind: 'Kratos', table });
  assert.equal(h.nodes.some(node => node.style?.color === modifiers.MODIFIED_STAT_COLOUR), false);
  assert.equal(h.nodes.some(node => node.style?.opacity === 0.55), false);
});

test('Trauma greyscales inactive bands while preserving the matching band and every printed row', () => {
  const h = harness(), table = catalogue.byName('Heavy-Gear Training')[0].faces[0].data.traumaTable;
  h.render(h.PatternTable, { kind: 'Trauma', table, currentValue: 5 });
  const rows = h.nodes.filter(node => node.testID?.startsWith('pattern-row-Trauma'));
  assert.equal(rows.length, 4);
  assert.ok(rows[1].accessibilityLabel.includes('; active at Danger 5'));
  assert.ok(rows.filter((_, index) => index !== 1).every(row => row.accessibilityLabel.includes('; inactive at Danger 5')));
  const bandStarts = h.nodes.filter(node => node.svgType === 'Stop' && node.offset === '20%').map(node => node.stopColor);
  assert.deepEqual(bandStarts, [grayscaleColour(patternTheme.trauma), patternTheme.trauma, grayscaleColour(patternTheme.trauma), grayscaleColour(patternTheme.trauma)]);
});

test('Argonaut reference popups pass derived Rage and current Danger to both Titan defaults and Pattern overrides', () => {
  const h = harness(), owner = h.party.argonauts[0]; owner.counters.rage = 5; owner.counters.danger = 4; rouse(owner);
  owner.titan = { ...reference('Philoctera'), id: 'titan', exhausted: false, enabledEffectIds: [], counters: {} };
  h.render(h.ReferenceDialog, { kind: 'Kratos', argonaut: owner, onClose() {} });
  assert.equal(h.tables[0].currentValue, 6);
  h.render(h.ReferenceDialog, { kind: 'Trauma', argonaut: owner, onClose() {} });
  assert.equal(h.tables[0].currentValue, 4);
  owner.tableOverrides.trauma = reference('Heavy-Gear Training');
  h.render(h.ReferenceDialog, { kind: 'Trauma', argonaut: owner, onClose() {} });
  assert.deepEqual(h.tables[0].tableValues, { Kratos: 6, Trauma: 4 });
  assert.equal(owner.counters.rage, 5);
});
