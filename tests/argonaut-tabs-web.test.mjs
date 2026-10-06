import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createParty } from '../src/domain/party.ts';
import * as likelihood from '../src/domain/argonaut-likelihood.ts';

const require = createRequire(import.meta.url), React = require('react'), web = require('react-native-web'), ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const catalogue = { getFace: id => ({ kind: id === 'standard' ? 'mnemos' : 'fated-mnemos' }) };
function loadTabs(tabs) {
  const filename = fileURLToPath(new URL('../src/dashboard/ArgonautTabs.tsx', import.meta.url)), load = Module._load;
  const mocks = { 'react-native': { ...web, Pressable: props => { tabs.push(props); return React.createElement(web.Pressable, props); } },
    '../catalogue': { getCatalogue: () => catalogue }, '../domain/argonaut-likelihood': likelihood,
    '../components/SwipeSurface': { SwipeGuard: ({ children }) => children },
    '../theme/tokens': { theme: { line: '#D1CDC3', ink: '#292723', muted: '#706D65' }, textOnColour: () => '#FFFFFF' },
  };
  Module._load = function(request, parent, ...args) { return parent?.filename === filename && Object.hasOwn(mocks, request) ? mocks[request] : load.call(this, request, parent, ...args); };
  try {
    const component = new Module(filename); component.filename = filename; component.paths = Module._nodeModulePaths(fileURLToPath(new URL('../', import.meta.url)));
    component._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return component.exports.ArgonautTabs;
  } finally { Module._load = load; }
}
function memories(party, index, standard, fated = []) {
  const member = party.argonauts[index];
  const cards = (nodes, kind) => nodes.map((node, slot) => ({ id: `${member.id}:${kind}:${slot}`, definitionId: kind, faceId: 'front',
    exhausted: false, enabledEffectIds: [], counters: {}, memoryProgress: { node, growthUnlocked: false } }));
  const normal = cards(standard, 'standard'), fate = cards(fated, 'fated');
  party.argonauts[index] = { ...member, mnemosIds: normal.map(card => card.id), fatedMnemosIds: fate.map(card => card.id), instances: [...normal, ...fate] };
}
const visibleText = tab => renderToStaticMarkup(React.createElement(web.View, null, tab.children)).replace(/<[^>]+>/g, '');

test('all four headings show live Least/Most badges without opening an Argonaut or changing selection', () => {
  const tabs = [], ArgonautTabs = loadTabs(tabs), selected = [];
  let party = createParty('party', ['a', 'b', 'c', 'd'], 'catalogue');
  memories(party, 0, [2], [3, 3]); memories(party, 1, [0, 0]); memories(party, 2, [4]); memories(party, 3, [3]);
  const render = activeId => { tabs.length = 0; return renderToStaticMarkup(React.createElement(ArgonautTabs, { party, activeId, compact: false, onSelect: id => selected.push(id) })); };
  const before = structuredClone(party), html = render('d');
  assert.match(html, /role="tablist"/); assert.equal(tabs.length, 4);
  assert.match(visibleText(tabs[0]), /Least Likely/); assert.doesNotMatch(visibleText(tabs[0]), /Most Likely/);
  assert.match(visibleText(tabs[1]), /Most Likely/); assert.doesNotMatch(visibleText(tabs[2]), /Likely/);
  assert.match(tabs[0].accessibilityLabel, /1 standard Mnemos card, 2 nodes/);
  assert.equal(tabs[3].accessibilityState.selected, true);
  tabs[2].onPress(); assert.deepEqual(selected, ['c']);
  render('c'); assert.match(visibleText(tabs[0]), /Least Likely/); assert.match(visibleText(tabs[1]), /Most Likely/);
  assert.deepEqual(party, before);

  party = structuredClone(party); memories(party, 1, [0]); render('c');
  assert.match(visibleText(tabs[1]), /Least Likely/); assert.match(visibleText(tabs[2]), /Most Likely/);
  party = structuredClone(party); memories(party, 0, [8]); render('b');
  assert.match(visibleText(tabs[0]), /Most Likely/); assert.match(visibleText(tabs[1]), /Least Likely/);
});

test('compact headings identify every exact tie, including all-empty and both-role ties', () => {
  const tabs = [], ArgonautTabs = loadTabs(tabs);
  let party = createParty('party', ['a', 'b', 'c', 'd'], 'catalogue');
  const render = () => { tabs.length = 0; return renderToStaticMarkup(React.createElement(ArgonautTabs, { party, activeId: 'a', compact: true, onSelect() {} })); };
  render();
  for (const tab of tabs) {
    assert.match(visibleText(tab), /Least · tied/); assert.match(visibleText(tab), /Most · tied/);
    assert.match(tab.accessibilityLabel, /Least Likely \(tied\), Most Likely \(tied\)/);
    assert.match(tab.accessibilityHint, /Resolve exact ties randomly/);
  }
  memories(party, 0, [3]); memories(party, 1, [3]); memories(party, 2, [6]); memories(party, 3, [6]); render();
  assert.ok(tabs.slice(0, 2).every(tab => /Least · tied/.test(visibleText(tab)) && !/Most/.test(visibleText(tab))));
  assert.ok(tabs.slice(2).every(tab => /Most · tied/.test(visibleText(tab)) && !/Least/.test(visibleText(tab))));
});
