import assert from 'node:assert/strict';
import test from 'node:test';
import { colourBrightnessSelection, colourWheelMarker, colourWheelSelection, hexToHsv, hsvToHex } from '../src/domain/colour-picker.ts';

test('saved colours survive opening the picker without colour drift, including grayscale and arbitrary RGB', () => {
  for (const colour of ['#B54A48', '#416EAA', '#547E59', '#B38A35', '#123ABC', '#FFFFFF', '#000000', '#808080']) {
    assert.equal(hsvToHex(hexToHsv(colour)), colour);
  }
  // Sample across the full RGB range, not just the default palette.
  for (let red = 0; red <= 255; red += 17) for (let green = 0; green <= 255; green += 17) for (let blue = 0; blue <= 255; blue += 17) {
    const colour = '#' + [red, green, blue].map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
    assert.equal(hsvToHex(hexToHsv(colour)), colour);
  }
});

test('wheel selection matches displayed hue/saturation at different widths and clamps outside drags', () => {
  for (const size of [232, 300]) for (const hue of [0, 60, 120, 180, 240, 300, 359]) {
    const marker = colourWheelMarker({ hue, saturation: 0.65, value: 0.7 });
    const selected = colourWheelSelection(marker.x * size / 300, marker.y * size / 300, size);
    assert.ok(Math.abs(selected.hue - hue) < 1e-9);
    assert.ok(Math.abs(selected.saturation - 0.65) < 1e-9);
  }
  assert.equal(colourWheelSelection(150, 150, 300).saturation, 0);
  assert.deepEqual(colourWheelSelection(1000, 150, 300), { hue: 0, saturation: 1 });
  assert.equal(hsvToHex({ ...colourWheelSelection(290, 150, 300), value: 1 }), '#FF0000');
  assert.equal(hsvToHex({ ...colourWheelSelection(10, 150, 300), value: 1 }), '#00FFFF');
});

test('brightness track reaches black and full brightness, preserving hue and saturation', () => {
  for (const width of [232, 300]) {
    assert.equal(colourBrightnessSelection(-100, width), 0);
    assert.equal(colourBrightnessSelection(150 * width / 300, width), 0.5);
    assert.equal(colourBrightnessSelection(1000, width), 1);
  }
  const colour = hexToHsv('#123ABC');
  assert.equal(hsvToHex({ ...colour, value: 0 }), '#000000');
  assert.equal(hsvToHex({ hue: 420, saturation: 1, value: 1 }), '#FFFF00');
  assert.equal(hsvToHex({ hue: 0, saturation: 0, value: 1 }), '#FFFFFF');
});
