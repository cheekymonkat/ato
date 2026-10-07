import assert from 'node:assert/strict';
import test from 'node:test';
import { headers, missingGearRows, toCsv } from '../scripts/report-missing-gear-art.mjs';

const face = (name, cycle = 'Cycle I', id = 'front', data = {}, printedIds = ['A001']) =>
  ({ name, cycle, id, kind: 'gear', data, printedIds });
const gear = (id, faces, printedIds = faces.flatMap(face => face.printedIds)) => ({ id, family: 'Gear', printedIds, faces });
const technology = (name, cycle, recipes) => ({ id: name, family: 'Technology',
  faces: [{ id: 'front', name, cycle, kind: 'other', data: { recipes } }] });

test('missing flips keep the original name, secret number and recipe technology through printed aliases', () => {
  const catalogue = { cards: [
    gear('spear', [face('Spear', 'Cycle II', 'front', { secretCardNumber: 42 }, ['B001', 'B002']),
      face('Strikeback', 'Cycle II', 'back', {}, ['B001', 'B002'])]),
    technology('Weapon facility', 'Cycle II', [{ refID: 'B002', name: 'Different recipe wording' }]),
  ] };
  const rows = missingGearRows(catalogue, new Set(['spear/front']));
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].slice(0, 7), ['Spear', 'Cycle II', 'Weapon facility', '42', 'Flipped side', 'Strikeback', 'Front: Spear']);
});

test('technology recipe names cannot cross cycles or attach to ambiguous same-cycle definitions', () => {
  const catalogue = { cards: [gear('old', [face('Blade')]), gear('new', [face('Blade', 'Cycle IV')]),
    gear('a', [face('Uncertain', 'Cycle IV')]), gear('b', [face('Uncertain', 'Cycle IV')]),
    technology('Old facility', 'Cycle I', [{ name: 'Blade' }]),
    technology('New facility', 'Cycle IV', [{ name: 'Blade' }, { name: 'Uncertain' }]),
  ] };
  const rows = missingGearRows(catalogue, new Set());
  assert.equal(rows.find(row => row[10] === 'old')[2], 'Old facility');
  assert.equal(rows.find(row => row[10] === 'new')[2], 'New facility');
  assert.equal(rows.find(row => row[10] === 'a')[2], '');
  assert.equal(rows.find(row => row[10] === 'b')[2], '');
  assert.equal(rows[0][1], 'Cycle IV');
});

test('reports only real missing faces and includes intentional no-art exceptions', () => {
  const catalogue = { cards: [gear('both', [face('Sword'), face('Bow', 'Cycle I', 'back')]),
    gear('single', [face('Shield')]), gear('ready', [face('Armor')]),
    gear('fists', [face('Fists', 'Cycle I', 'front', {}, [])]), gear('text', [face('Stones')]),
  ] };
  const rows = missingGearRows(catalogue, new Set(['ready/front']), new Map([['text/front', 'Contains no illustration.']]));
  assert.equal(rows.length, 5);
  assert.equal(rows.filter(row => row[10] === 'both').length, 2);
  assert.equal(rows.filter(row => row[10] === 'single').length, 1);
  assert.ok(rows.every(row => row[10] !== 'ready'));
  assert.match(rows.find(row => row[10] === 'fists')[9], /Default unarmed/);
  assert.equal(rows.find(row => row[10] === 'text')[9], 'Contains no illustration.');
});

test('CSV protects commas, quotes and line breaks and preserves empty values', () => {
  assert.equal(headers.length, 11);
  assert.equal(toCsv([['Gear, "A"', 'Line 1\nLine 2', null, 0]]),
    '\uFEFF"Gear, ""A""","Line 1\nLine 2","","0"\r\n');
});
