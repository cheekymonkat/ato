import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
