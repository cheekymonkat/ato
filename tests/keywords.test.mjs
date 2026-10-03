import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createKeywordRepository } from '../src/domain/keywords.ts';
import { formatParagraph } from '../src/domain/card-presentation.ts';

const source = JSON.parse(fs.readFileSync(new URL('../data/reference/keywords.json', import.meta.url)));
const keywords = createKeywordRepository(source);

test('exact subname matches return only that explanation while unmatched variants fall back to the primary keyword', () => {
  const original = structuredClone(source.Reflex);
  const advanced = keywords.resolve('Advanced Reflex');
  assert.equal(advanced.title, 'Advanced Reflex');
  assert.equal(formatParagraph(advanced.main).label, '2 spaces instead.');
  assert.deepEqual(advanced.sections, []);
  const superior = keywords.resolve('Superior Reflex');
  assert.equal(formatParagraph(superior.main).label, '3 spaces instead.');
  assert.deepEqual(superior.sections, []);
  const base = keywords.resolve('Reflex');
  assert.equal(base.title, 'Reflex');
  assert.equal(formatParagraph(base.main).label, 'Move up to 1 space.');
  assert.deepEqual(keywords.resolve('Unmatched Reflex'), base);
  assert.deepEqual(source.Reflex, original);
  assert.equal(keywords.resolve('No such keyword'), undefined);
});

test('subnames use existing case, whitespace, hyphen and parameter matching and preserve Auto timing', () => {
  const fixture = { Jump: { mainDef: 'Base jump', subName0: 'Advanced Jump', subDef0: 'Advanced jump' },
    Break: { mainDef: 'Base break', subName0: 'Self Combo-Breaker: X spaces', subDef0: 'Matching parameterised variant' } };
  const repository = createKeywordRepository(fixture);
  for (const label of ['Advanced Jump', ' advanced   jump ', 'ADVANCED JUMP']) {
    assert.equal(repository.resolve(label).main, 'Advanced jump');
    assert.deepEqual(repository.resolve(label).sections, []);
  }
  assert.deepEqual(repository.resolve('  Auto-Advanced Jump  '), { title: 'Auto-Advanced Jump', auto: true, main: 'Advanced jump', sections: [] });
  assert.equal(repository.resolve('Self Combo–Breaker: 4 spaces').main, 'Matching parameterised variant');
  assert.equal(repository.resolve('Improved Jump').main, 'Base jump');
});

test('subnames take precedence over primary-name collisions and unavailable subdefinitions retain the original fallback', () => {
  const repository = createKeywordRepository({
    Base: { mainDef: 'Original definition', subName0: 'Advanced Base', subDef0: 'Subname definition',
      subName1: 'Missing Base', subName2: 'Empty Base', subDef2: [] },
    'Advanced Base': { mainDef: 'Colliding primary name' },
  });
  assert.equal(repository.resolve('Advanced Base').main, 'Subname definition');
  for (const label of ['Missing Base', 'Empty Base']) {
    const fallback = repository.resolve(label);
    assert.equal(fallback.title, 'Base');
    assert.equal(fallback.main, 'Original definition');
  }
});
