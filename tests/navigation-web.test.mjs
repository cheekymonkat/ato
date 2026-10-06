import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESTINATIONS } from '../src/navigation/destinations.ts';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
function compile(filename) {
  const component = new Module(filename); component.filename = filename; component.paths = Module._nodeModulePaths(path.dirname(filename));
  component._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename);
  return component.exports;
}

// Use the same web implementations Metro selects, without a browser or new dependencies.
// Rendering with React DOM catches native-only props leaking into actual SVG markup.
test('all six navigation icons render on web without React errors and remain decorative', () => {
  const load = Module._load, error = console.error, messages = [], cache = new Map();
  Module._load = function(request, parent, ...args) {
    if (request === 'react-native') return require('react-native-web');
    if (request === './elements' && parent?.filename.endsWith('/react-native-svg/lib/commonjs/xmlTags.js')) return require('react-native-svg/lib/commonjs/elements.web.js');
    if (request === 'react-native-svg') return { __esModule: true, ...require('react-native-svg/lib/commonjs/elements.web.js'), ...require('react-native-svg/lib/commonjs/xml.js') };
    if (request.startsWith('.') && parent?.filename.startsWith(sourceRoot)) {
      const base = path.resolve(path.dirname(parent.filename), request), filename = [`${base}.tsx`, `${base}.ts`].find(value => fs.existsSync(value));
      if (filename) { if (!cache.has(filename)) cache.set(filename, compile(filename)); return cache.get(filename); }
    }
    return load.call(this, request, parent, ...args);
  };
  console.error = (...values) => messages.push(values);
  try {
    const { NavigationIcon } = compile(path.join(sourceRoot, 'navigation/NavigationIcon.tsx'));
    const { MenuIcon } = compile(path.join(sourceRoot, 'components/Icon.tsx'));
    for (const name of DESTINATIONS) for (const colour of ['#DCC38D', '#D5D1C7']) {
      const markup = renderToStaticMarkup(React.createElement(NavigationIcon, { name, colour }));
      assert.match(markup, /^<svg\b/);
      assert.match(markup, /aria-hidden="true"/);
      assert.match(markup, /<path d="[^"]+"/);
      assert.ok(markup.includes(`fill="${colour}"`));
      assert.equal(markup, renderToStaticMarkup(React.createElement(MenuIcon, { name: name === 'Cargo' ? 'CargoHold' : name, size: 24, colour })), 'Navigation uses the matching extracted icon');
      assert.doesNotMatch(markup, /\baccessible=/);
    }
    assert.deepEqual(messages, [], 'React must not log SVG rendering errors');
  } finally {
    Module._load = load;
    console.error = error;
  }
});
