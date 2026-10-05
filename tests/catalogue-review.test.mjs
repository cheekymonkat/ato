import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { catalogueReviewFiles } from '../scripts/catalogue-review-files.mjs';

const root = new URL('../data/generated/', import.meta.url);
const catalogue = JSON.parse(await readFile(new URL('catalogue.json', root), 'utf8'));

test('readable family files preserve every current definition and face within their size limits', async () => {
  const manifest = JSON.parse(await readFile(new URL('by-family/manifest.json', root), 'utf8'));
  assert.equal(manifest.catalogueVersion, catalogue.catalogueVersion);
  assert.equal(manifest.definitions, 3014);
  assert.equal(manifest.faces, 3217);
  const cards = new Map();
  const families = new Set();
  for (const file of manifest.files) {
    const bytes = await readFile(new URL(`by-family/${file.path}`, root));
    assert.equal(bytes.length, file.bytes);
    assert.ok(bytes.length <= manifest.maxBytesPerFile);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    const part = JSON.parse(bytes);
    assert.equal(bytes.toString(), JSON.stringify(part, null, 2) + '\n');
    assert.equal(part.catalogueVersion, catalogue.catalogueVersion);
    assert.equal(part.family, file.family); assert.equal(part.part, file.part);
    assert.equal(part.cards.length, file.definitions);
    assert.ok(part.cards.length > 0 && part.cards.length <= manifest.maxDefinitionsPerFile);
    families.add(part.family);
    for (const card of part.cards) {
      assert.equal(card.family, part.family);
      assert.ok(!cards.has(card.id), `Repeated readable definition ${card.id}`);
      cards.set(card.id, card);
    }
  }
  assert.equal(families.size, 28);
  assert.equal(cards.size, catalogue.cards.length);
  for (const card of catalogue.cards) assert.deepEqual(cards.get(card.id), card);
  for (const { path, content } of catalogueReviewFiles(catalogue)) {
    assert.equal(await readFile(new URL(`by-family/${path}`, root), 'utf8'), content, 'Deterministic regeneration');
  }
});
