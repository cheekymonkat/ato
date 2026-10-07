import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { kratosRowActive, kratosRows, traumaRowActive, traumaRows, kratosRowLabel, patternIconKey } from '../src/domain/pattern-table.ts';
import { patternIcons } from '../src/theme/pattern-icons.ts';

const catalogue = JSON.parse(await readFile(new URL('../data/generated/catalogue.json', import.meta.url), 'utf8'));
const faces = catalogue.cards.flatMap(card => card.faces).filter(face => face.kind === 'titan' || face.family === 'Pattern');
const faceNamed = name => faces.find(face => face.name === name);

test('Pandoran combined effects stay grouped separately from choices', () => {
  const rows = kratosRows(faceNamed('Pandoran Strain').data.kratosTable);
  assert.equal(kratosRowLabel(rows[1]), 'Rage 2: 1 Break plus 1 Reroll or 1 Scale');
  assert.equal(kratosRowLabel(rows[2]), 'Rage 3: 1 Opening plus 1 Reposition or 1 Closing');
  assert.equal(patternIconKey(rows[4].options[0][0]), 'RedPowerDie');
  assert.equal(patternIconKey(rows[1].options[0][1]), 'PowerReroll');
  assert.equal(patternIconKey({ name: 'Black', quantity: '1' }), 'Black');
});

test('variable tables retain every source row, choice, effect, quantity and trauma range', () => {
  const counts = new Set();
  for (const face of faces) {
    const data = face.data, original = JSON.stringify(data);
    const rows = kratosRows(data.kratosTable);
    counts.add(rows.length);
    assert.deepEqual(rows.map(row => row.options.map(option => option.map(effect => ({ name: effect.name, ...(effect.quantity === undefined ? {} : { x_value: effect.quantity }) })))), data.kratosTable, face.name);
    assert.deepEqual(traumaRows(data.traumaTable), data.traumaTable, face.name);
    assert.equal(JSON.stringify(data), original);
    // ATCC also displays these two names as text: no SVG exists in its icon set.
    for (const row of rows) for (const option of row.options) for (const effect of option) assert.ok(patternIcons[patternIconKey(effect)] || ['Pull', 'RedtoBlack'].includes(effect.name), `${face.name}: ${effect.name}`);
    for (const row of traumaRows(data.traumaTable)) assert.ok(patternIcons[row.type], `${face.name}: ${row.type}`);
  }
  assert.deepEqual([...counts].sort((a, b) => a - b), [0, 6, 7, 8, 9]);
  assert.deepEqual(traumaRows(faceNamed('Shade Training').data.traumaTable).map(row => row.range), ['1-2', '3-4', '5', '6-7', '8-9', '10+']);
});

test('future symbols and malformed values remain readable instead of disappearing', () => {
  assert.equal(kratosRowLabel(kratosRows([[[{ name: 'FutureSymbol', x_value: '+0' }]]])[0]), 'Rage 1: +0 FutureSymbol');
  assert.equal(kratosRows([['unrecognised text']])[0].options[0][0].name, 'unrecognised text');
  assert.deepEqual(traumaRows(['unrecognised text']), [{ range: '—', type: 'unrecognised text' }]);
});

test('symbols with implicit SVG fills remain visible on black options', () => {
  // Fire's original path omits fill and relies on SVG's default black. ATCC's
  // CSS inversion also inverts that default; native SVG needs an explicit fill.
  assert.match(patternIcons.Fire, /<svg[^>]*fill="#ffffff"/);
  assert.doesNotMatch(patternIcons.Fire, /<path[^>]*fill="#000000"/);
  assert.match(patternIcons.RedPowerDie, /#a51d21/);
  for (const xml of Object.values(patternIcons)) {
    assert.ok(xml.includes('viewBox='));
    assert.ok(!xml.includes('data:image/'), 'hidden tracing images must not ship');
  }
});

test('Kratos activates every row up to current Rage, including derived Roused Rage', () => {
  const rows = kratosRows(faceNamed('Pandoran Strain').data.kratosTable);
  assert.deepEqual(rows.filter(row => kratosRowActive(row, 5)).map(row => row.rage), [1, 2, 3, 4, 5]);
  assert.deepEqual(rows.filter(row => kratosRowActive(row, 6)).map(row => row.rage), [1, 2, 3, 4, 5, 6]);
  assert.equal(rows.some(row => kratosRowActive(row, 0)), false);
  assert.equal(rows.every(row => kratosRowActive(row, 100)), true);
});

test('Trauma highlights the current band at inclusive boundaries, singleton values and open-ended limits', () => {
  const rows = traumaRows(faceNamed('Heavy-Gear Training').data.traumaTable);
  for (const [danger, expected] of [[0, []], [1, ['1-3']], [3, ['1-3']], [4, ['4-6']], [5, ['4-6']], [6, ['4-6']], [7, ['7-9']], [9, ['7-9']], [10, ['10+']], [100, ['10+']]]) {
    assert.deepEqual(rows.filter(row => traumaRowActive(row, danger)).map(row => row.range), expected);
  }
  const shade = traumaRows(faceNamed('Shade Training').data.traumaTable);
  assert.deepEqual(shade.filter(row => traumaRowActive(row, 5)).map(row => row.range), ['5']);
  assert.equal(traumaRowActive({ range: '—', type: 'unknown' }, 5), false);
  assert.equal(traumaRowActive(rows[0], NaN), false);
});
