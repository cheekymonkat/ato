import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import * as presentation from '../src/domain/card-presentation.ts';
import * as charges from '../src/domain/gear-charges.ts';
import * as gearTokens from '../src/theme/gear-tokens.ts';
const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server'), ts = require('typescript');
const web = require('react-native-web');

function hasNestedButtons(html) {
  const stack = [], voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const match of html.matchAll(/<(\/)?([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const tag = match[2].toLowerCase();
    if (match[1]) { stack.splice(stack.lastIndexOf(tag)); continue; }
    if (tag === 'button' && stack.includes('button')) return true;
    if (!voidTags.has(tag) && !match[0].endsWith('/>')) stack.push(tag);
  }
  return false;
}

// The same renderer reproduces the previously invalid wrapping button.
// Verify the browser DOM, including its keyboard selection target, rather than JSX shape.
test('selectable cards render child actions outside the selection button on web', () => {
  const child = React.createElement(web.Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Exhaust ability' }, React.createElement(web.Text, null, 'Exhaust'));
  const broken = renderToStaticMarkup(React.createElement(web.Pressable, { accessibilityRole: 'button' }, child));
  assert.equal(hasNestedButtons(broken), true, 'The check must detect the original failure');
  const originalLoad = Module._load, originalError = console.error, originalWarn = console.warn;
  const messages = [], recorded = [];
  Module._load = function(request, parent, ...args) {
    if (request === 'react-native') return { ...web, Pressable: props => { recorded.push(props); return React.createElement(web.Pressable, props); } };
    if (request === '../../theme/tokens') return { theme: { gold: '#B49A60' } };
    return originalLoad.call(this, request, parent, ...args);
  };
  console.error = (...values) => messages.push(values);
  console.warn = (...values) => messages.push(values);
  try {
    const filename = fileURLToPath(new URL('../src/components/cards/CardSelectionTarget.tsx', import.meta.url));
    const component = new Module(filename);
    component.filename = filename;
    component.paths = Module._nodeModulePaths(path.dirname(filename));
    component._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    let edits = 0;
    const markup = renderToStaticMarkup(React.createElement(component.exports.CardSelectionTarget, { label: 'Edit Mnemos 1', onPress: () => edits++ }, child));
    assert.equal(hasNestedButtons(markup), false);
    assert.match(markup, /<button[^>]*aria-label="Edit Mnemos 1"[^>]*tabindex="0"/);
    assert.match(markup, /<button[^>]*aria-label="Exhaust ability"/);
    assert.match(markup, /<div[^>]*role="group"[^>]*tabindex="-1"/);
    assert.deepEqual(messages, [], 'Rendering must not emit React errors or pointer-events warnings');
    let stopped = false;
    recorded.find(props => props.accessibilityRole === 'button').onPress({ stopPropagation: () => { stopped = true; } });
    assert.equal(stopped, true);
    assert.equal(edits, 1, 'Keyboard selection opens the card once');
    recorded.find(props => props.role === 'group').onPress();
    assert.equal(edits, 2, 'Pointer selection remains available');
  } finally {
    Module._load = originalLoad; console.error = originalError; console.warn = originalWarn;
  }
});

test('equipped Gear charge boxes are independent buttons, spend to zero and restore without opening card editing', () => {
  const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
  const definition = catalogue.byName('Alchemic Incendiaries')[0], face = definition.faces[0];
  let instance = { id: 'gear', definitionId: definition.id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} };
  let edits = 0, stopped = 0;
  const recorded = [], messages = [], originalLoad = Module._load, originalError = console.error, originalWarn = console.warn;
  const paint = { inactive: false, colour: colour => colour };
  const mocks = {
    'react-native': { ...web, Pressable: props => { recorded.push(props); return React.createElement(web.Pressable, props); } },
    '../../domain/card-presentation': presentation, '../../domain/gear-charges': charges, '../../theme/gear-tokens': gearTokens,
    '../../domain/combat-modifiers': { adjustedStat: value => ({ label: value, text: value, changed: false }), MODIFIED_STAT_COLOUR: '#B42332' },
    '../../theme/tokens': { theme: { gold: '#B49A60' } },
    '../SwipeSurface': { SwipeGuard: ({ children }) => children },
    './CardIcon': { CardIcon: ({ name }) => React.createElement('span', { 'data-icon': name }) },
    './CardColours': { CardColours: ({ children }) => children, useCardColours: () => paint },
    './CombatStats': { useCombatAdjustment: () => 0 }, './gear-art-assets': { gearArtAssets: {} },
    './RichParagraph': { RichParagraph: () => null },
    './GateBadge': { GateBackground: () => null, GateBadge: () => null, StatGate: () => null },
  };
  Module._load = function(request, parent, ...args) {
    return Object.hasOwn(mocks, request) ? mocks[request] : originalLoad.call(this, request, parent, ...args);
  };
  console.error = (...values) => messages.push(values); console.warn = (...values) => messages.push(values);
  const compile = name => {
    const filename = fileURLToPath(new URL(`../src/components/cards/${name}.tsx`, import.meta.url)), component = new Module(filename);
    component.filename = filename; component.paths = Module._nodeModulePaths(path.dirname(filename));
    component._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return component.exports[name];
  };
  try {
    const GearCard = compile('GearCard'), Selection = compile('CardSelectionTarget');
    const render = editable => {
      recorded.length = 0;
      return renderToStaticMarkup(React.createElement(Selection, { label: 'Edit Gear', onPress: () => edits++ },
        React.createElement(GearCard, { face, instance, width: 240, onCharge: editable ? index => { instance = charges.spendGearCharge(instance, face, index); } : undefined })));
    };
    const tap = () => recorded.find(props => props.testID === 'gear-charge-front-0').onPress({ stopPropagation: () => stopped++ });
    let html = render(true);
    assert.equal(hasNestedButtons(html), false);
    assert.match(html, /Alchemic Incendiaries charges: 2 of 2. Spend one charge/);
    assert.match(html, /data-icon="Energy"/);
    assert.equal(recorded.filter(props => props.testID?.startsWith('gear-charge-')).length, 1);
    tap(); html = render(true); assert.match(html, /charges: 1 of 2. Spend one charge/);
    tap(); html = render(true); assert.match(html, /charges: 0 of 2. Restore charges/);
    tap(); html = render(true); assert.match(html, /charges: 2 of 2. Spend one charge/);
    assert.equal(edits, 0); assert.equal(stopped, 3);
    recorded.find(props => props.role === 'group').onPress(); assert.equal(edits, 1);
    render(false); assert.equal(recorded.some(props => props.testID?.startsWith('gear-charge-')), false);
    const withArmor = { ...face, data: { ...face.data, defensiveStatistics: [{ type: 'Armor', armorDice: ['Red'] }, ...face.data.defensiveStatistics] } };
    recorded.length = 0;
    renderToStaticMarkup(React.createElement(GearCard, { face: withArmor, instance, onCharge() {} }));
    assert.deepEqual(recorded.filter(props => props.testID?.startsWith('gear-charge-')).map(props => props.testID), ['gear-charge-front-1']);
    assert.deepEqual(messages, []);
  } finally { Module._load = originalLoad; console.error = originalError; console.warn = originalWarn; }
});
