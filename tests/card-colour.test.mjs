import test from 'node:test';
import assert from 'node:assert/strict';
import { grayscaleColour, grayscaleSvg } from '../src/domain/card-colour.ts';
import { gearIcons } from '../src/theme/gear-icons.ts';
import { memoryTheme } from '../src/theme/memory-tokens.ts';
import { gateColour } from '../src/theme/gear-tokens.ts';

test('grayscale preserves black, white, transparency and relative brightness', () => {
  assert.equal(grayscaleColour('#000000'), '#000000');
  assert.equal(grayscaleColour('#FFFFFF'), '#FFFFFF');
  assert.equal(grayscaleColour('#FF0000'), '#363636');
  assert.equal(grayscaleColour('#00FF00'), '#B6B6B6');
  assert.equal(grayscaleColour('#0000FF'), '#121212');
  assert.equal(grayscaleColour('#F008'), '#36363688');
  assert.equal(grayscaleColour('#abcdef00').slice(-2), '00');
  assert.equal(grayscaleColour('none'), 'none');
});

test('SVG recolouring preserves IDs, gradient references and nonpaint content', () => {
  const svg = '<svg id="abc"><defs><linearGradient id="ff0000"><stop stop-color="#FF0000" /></linearGradient></defs><path fill="url(#ff0000)" stroke="#0F0" /><text fill="#fff">#00FF00</text></svg>';
  const gray = grayscaleSvg(svg);
  assert.ok(gray.includes('id="ff0000"'));
  assert.ok(gray.includes('fill="url(#ff0000)"'));
  assert.ok(gray.includes('stop-color="#363636"'));
  assert.ok(gray.includes('stroke="#B6B6B6"'));
  assert.ok(gray.includes('>#00FF00</text>'));
  assert.equal(grayscaleSvg(gray), gray);
});

test('exhausted memories have a distinct neutral palette and their coloured gates and Growth header desaturate', () => {
  for (const colour of [memoryTheme.inactiveBackground, memoryTheme.inactivePanel, memoryTheme.inactiveInk, grayscaleColour(memoryTheme.growth), grayscaleColour(gateColour('Danger')), grayscaleColour(gateColour('Fate'))]) {
    assert.equal(colour.slice(1, 3), colour.slice(3, 5));
    assert.equal(colour.slice(3, 5), colour.slice(5, 7));
  }
  assert.notEqual(memoryTheme.inactiveBackground, memoryTheme.background);
  assert.notEqual(memoryTheme.inactiveInk, memoryTheme.black);
  // Keep the visible ability text readable on the darker neutral panel.
  const linear = hex => { const value = parseInt(hex, 16) / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; };
  const contrast = (linear(memoryTheme.inactivePanel.slice(1, 3)) + 0.05) / (linear(memoryTheme.inactiveInk.slice(1, 3)) + 0.05);
  assert.ok(contrast >= 4.5);
});

test('all bundled Gear symbols can be desaturated without changing geometry or identity', () => {
  for (const [name, source] of Object.entries(gearIcons)) {
    const gray = grayscaleSvg(source);
    for (const match of gray.matchAll(/(?:fill|stroke|stop-color)="(#[\da-f]{6})"/gi)) {
      const colour = match[1].slice(1).toLowerCase();
      assert.equal(colour.slice(0, 2), colour.slice(2, 4), name);
      assert.equal(colour.slice(2, 4), colour.slice(4, 6), name);
    }
    const withoutPaint = xml => xml.replace(/((?:fill|stroke|stop-color|flood-color|color)=["'])#[\da-f]{3,8}(["'])/gi, '$1PAINT$2');
    assert.equal(withoutPaint(gray), withoutPaint(source), name);
    assert.equal(grayscaleSvg(gray), gray, name);
  }
});
