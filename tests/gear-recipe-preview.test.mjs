import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { faceForReference } from '../src/domain/card-presentation.ts';

const require = createRequire(import.meta.url), React = require('react'), ts = require('typescript');
const root = fileURLToPath(new URL('../src/components/cards/', import.meta.url));
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
function compile(name, mocks) {
  const filename = path.join(root, name), load = Module._load;
  Module._load = function(request, parent, ...args) {
    if (parent?.filename === filename && Object.hasOwn(mocks, request)) return mocks[request];
    return load.call(this, request, parent, ...args);
  };
  try {
    const module = new Module(filename); module.filename = filename; module.paths = Module._nodeModulePaths(root);
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return module.exports;
  } finally { Module._load = load; }
}
const node = name => { const component = () => null; component.displayName = name; return component; };
const GearCard = node('GearCard'), SecretCard = node('SecretCard'), Button = node('Button'), View = node('View');
function elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(elements)];
}
function hooks() {
  let cursor = 0;
  const slots = [], effects = [];
  const state = initial => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
  };
  const effect = (callback, deps) => {
    const i = cursor++, previous = slots[i];
    if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) {
      effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: callback() }; });
    }
  };
  return { api: { ...React, useState: state, useRef: initial => state(() => ({ current: initial }))[0], useCallback: fn => fn,
    useId: () => 'preview-id', useEffect: effect, useLayoutEffect: effect },
    render: (fn, props) => { cursor = 0; return fn(props); }, flush: () => { effects.splice(0).forEach(fn => fn()); },
    unmount: () => { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('recipe Gear previews preserve IDs while Titan, ingredient and missing links retain references', () => {
  const Trigger = node('Trigger'), Pressable = node('Pressable'), Text = node('Text');
  const { GearRecipeLink } = compile('GearRecipeLink.tsx', {
    'react-native': { Pressable, Text, StyleSheet: { create: value => value } },
    '../../catalogue': { getCatalogue: () => catalogue }, './GearPreviewTrigger': { GearPreviewTrigger: Trigger },
  });
  const gear = catalogue.byName('Boatmace')[0], titan = catalogue.search({ family: 'Titan' })[0];
  const props = { id: gear.printedIds[0], label: 'Boatmace' };
  const preview = GearRecipeLink(props);
  assert.equal(preview.type, Trigger); assert.equal(preview.props.card.id, gear.id); assert.equal(preview.props.referenceId, props.id);
  for (const id of [titan.printedIds[0], 'missing-recipe']) {
    let reference;
    const link = GearRecipeLink({ id, label: 'Reference', onReference: value => { reference = value; } });
    assert.equal(link.type, Pressable); link.props.onPress(); assert.equal(reference, id);
  }
});

test('Gear previews respect spoiler visibility, resolve the referenced face and can flip', () => {
  let hidden = true;
  const harness = hooks();
  const { GearPreviewContent } = compile('GearPreviewContent.tsx', {
    react: harness.api, 'react-native': { View }, '../../domain/card-presentation': { faceForReference },
    '../../state/SpoilerProvider': { useSpoilers: () => ({ hidden: () => hidden, reveal: () => { hidden = false; } }) },
    '../Button': { Button }, './GearCard': { GearCard }, './SecretCard': { SecretCard },
  });
  const card = catalogue.search({ family: 'Gear' }).find(card => card.faces.length === 2);
  assert.ok(card);
  const props = { card, referenceId: card.printedIds[0], width: 320 };
  let tree = harness.render(GearPreviewContent, props);
  assert.equal(tree.type, SecretCard); tree.props.onReveal();
  tree = harness.render(GearPreviewContent, props);
  assert.equal(elements(tree).find(element => element.type === GearCard).props.face.id, faceForReference(card, props.referenceId).id);
  elements(tree).find(element => element.type === Button).props.onPress();
  tree = harness.render(GearPreviewContent, props);
  assert.equal(elements(tree).find(element => element.type === GearCard).props.face.id, 'back');
});

test('desktop hover crosses the link gap, closes on exit, and supports touch, Escape and viewport edges', () => {
  const saved = Object.fromEntries(['document', 'window', 'setTimeout', 'clearTimeout'].map(key => [key, globalThis[key]]));
  const listeners = new Map(), timers = new Map(); let timerId = 0, portal;
  const contains = name => target => target?.region === name;
  const trigger = { region: 'trigger', contains: contains('trigger'), focus: () => { trigger.focused = true; }, getBoundingClientRect: () => ({ left: 880, right: 950, top: 700 }) };
  const panel = { region: 'panel', contains: contains('panel'), getBoundingClientRect: () => ({ height: 650 }) };
  const events = { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
  globalThis.document = { ...events, body: {} }; globalThis.window = { ...events, innerWidth: 1024, innerHeight: 768 };
  globalThis.setTimeout = fn => { timers.set(++timerId, fn); return timerId; }; globalThis.clearTimeout = id => timers.delete(id);
  const harness = hooks(), Content = node('Content');
  try {
    const { GearPreviewTrigger } = compile('GearPreviewTrigger.web.tsx', {
      react: harness.api, 'react-dom': { createPortal: tree => { portal = tree; return null; } },
      '../../theme/tokens': { theme: {} }, './GearPreviewContent': { GearPreviewContent: Content },
    });
    const props = { card: catalogue.byName('Boatmace')[0], referenceId: 'test', label: 'Boatmace' };
    const render = () => {
      portal = undefined;
      const tree = harness.render(GearPreviewTrigger, props), link = elements(tree).find(element => element.type === 'button');
      link.props.ref.current = trigger; if (portal) portal.props.ref.current = panel;
      harness.flush(); return link;
    };
    let link = render(); assert.equal(portal, undefined);
    link.props.onPointerEnter({ pointerType: 'mouse' }); link = render(); assert.ok(portal);
    link.props.onPointerLeave(); assert.equal(timers.size, 1);
    portal.props.onPointerEnter(); assert.equal(timers.size, 0, 'Entering preview cancels link-exit dismissal');
    link = render(); assert.equal(portal.props.style.left, 536); assert.equal(portal.props.style.top, 102);
    portal.props.onPointerLeave(); [...timers.values()].forEach(fn => fn()); link = render(); assert.equal(portal, undefined);
    link.props.onPointerEnter({ pointerType: 'touch' }); link = render(); assert.equal(portal, undefined);
    link.props.onClick({ detail: 1 }); link = render(); assert.ok(portal);
    portal.props.onPointerLeave(); link = render(); assert.ok(portal, 'Touch activation persists until dismissal');
    listeners.get('pointerdown')({ target: panel }); link = render(); assert.ok(portal);
    listeners.get('pointerdown')({ target: { region: 'outside' } }); link = render(); assert.equal(portal, undefined);
    link.props.onClick({ detail: 0 }); link = render(); assert.ok(portal, 'Keyboard activation opens preview');
    listeners.get('keydown')({ key: 'Escape', preventDefault: () => {} }); link = render(); assert.equal(portal, undefined); assert.ok(trigger.focused);
    globalThis.window.innerWidth = 390; globalThis.window.innerHeight = 600;
    link.props.onClick({ detail: 0 }); link = render(); link = render();
    assert.ok(portal.props.style.left >= 16); assert.ok(portal.props.style.left + portal.props.style.width + 16 <= 390 - 16);
    assert.equal(portal.props.style.top, 16); assert.equal(portal.props.style.width, 320);
    listeners.get('scroll')({ target: panel }); link = render(); assert.ok(portal, 'Scrolling the card keeps it open');
    listeners.get('scroll')({ target: { region: 'page' } }); link = render(); assert.equal(portal, undefined);
    link.props.onPointerEnter({ pointerType: 'mouse' }); link = render(); link.props.onPointerLeave(); harness.unmount();
    assert.equal(timers.size, 0); assert.equal(listeners.size, 0, 'Unmount removes preview listeners');
  } finally {
    harness.unmount(); Object.entries(saved).forEach(([key, value]) => { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; });
  }
});

test('native Gear links open a sheet without navigating; dismissal and card references close it', () => {
  const harness = hooks(), Pressable = node('Pressable'), Text = node('Text'), Sheet = node('Sheet'), Content = node('Content');
  const { GearPreviewTrigger } = compile('GearPreviewTrigger.tsx', {
    react: harness.api, 'react-native': { Pressable, Text, StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 390 }) },
    '../Sheet': { Sheet }, './GearPreviewContent': { GearPreviewContent: Content },
  });
  let reference;
  const props = { label: 'Boat Mace', onReference: id => { reference = id; } };
  let tree = harness.render(GearPreviewTrigger, props);
  elements(tree).find(element => element.type === Pressable).props.onPress(); tree = harness.render(GearPreviewTrigger, props);
  assert.ok(elements(tree).find(element => element.type === Sheet)); assert.equal(reference, undefined);
  elements(tree).find(element => element.type === Content).props.onReference('next-card');
  tree = harness.render(GearPreviewTrigger, props); assert.equal(reference, 'next-card');
  assert.equal(elements(tree).some(element => element.type === Sheet), false);
  elements(tree).find(element => element.type === Pressable).props.onPress(); tree = harness.render(GearPreviewTrigger, props);
  elements(tree).find(element => element.type === Sheet).props.onClose(); tree = harness.render(GearPreviewTrigger, props);
  assert.equal(elements(tree).some(element => element.type === Sheet), false);
});
