import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import test from 'node:test';
import { parseCatalogue } from '../src/catalogue/validate.ts';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const catalogue = await json('data/generated/catalogue.json');
const configs = await Promise.all((await readdir(new URL('data/reference/', root)))
  .filter(name => /^gear-art-.*\.json$/.test(name)).sort().map(name => json(`data/reference/${name}`)));
const manifests = await Promise.all(configs.map(config => json(`assets/gear-art/${config.batch}/manifest.json`)));
const artwork = manifests.flatMap(manifest => manifest.cards);

// Extraction writes unfiltered, 8-bit RGBA PNGs. Decode them to check real pixels.
function decodePng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8); assert.equal(bytes[25], 6);
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const rows = inflateSync(Buffer.concat(chunks)), pixels = Buffer.alloc(width * height * 4);
  assert.equal(rows.length, height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const offset = y * (width * 4 + 1);
    assert.equal(rows[offset], 0);
    rows.copy(pixels, y * width * 4, offset + 1, offset + 1 + width * 4);
  }
  return { width, height, pixels };
}

test('all reviewed Gear batches have named, hashed, rounded artwork and matching grayscale pixels', async () => {
  assert.deepEqual(Object.fromEntries(manifests.map(manifest => [manifest.batch ?? 'cycle2-a', manifest.cards.length])),
    { 'cycle2-a': 21,
      'epson-06102026175715': 21, 'epson-06102026180828': 20, 'epson-06102026183814': 21, 'epson-06102026184207': 19,
      'epson-06102026191222': 21, 'epson-06102026191619': 21, 'epson-06102026192724': 20, 'epson-06102026193136': 20,
      'epson-06102026194506': 20, 'epson-06102026194705': 2, 'epson-07102026101950': 21, 'epson-07102026102316': 21,
      'epson-07102026102736': 21, 'epson-07102026103125': 21, 'epson-07102026103350': 1, 'epson-07102026103838': 9,
      'epson-07102026162435': 10,
      'epson-105748': 21, 'epson-110215': 21, 'epson-110738': 13, 'epson-185551': 21, 'epson-185936': 20,
      'epson-210624': 21, 'epson-211018': 20, 'epson-211609': 13, 'epson-212452': 21, 'epson-213909': 21,
      'epson-214451': 21, 'epson-215042': 21, 'epson-215411': 21, 'epson-215757': 2 });
  assert.equal(artwork.length, 567);
  const linked = catalogue.cards.flatMap(card => card.faces.filter(face => face.artwork));
  assert.equal(linked.length, artwork.length);
  for (const entry of artwork) {
    const card = catalogue.cards.find(card => card.id === entry.definitionId);
    const face = card.faces.find(face => face.id === entry.faceId);
    assert.equal(face.kind, 'gear');
    assert.equal(face.name, entry.name);
    assert.deepEqual(face.printedIds, entry.printedIds);
    assert.deepEqual(face.artwork, entry.artwork);
    assert.equal(entry.filename, entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png');
    const bytes = await readFile(new URL(face.artwork.image, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    const colour = decodePng(bytes);
    const gray = decodePng(await readFile(new URL(face.artwork.grayscaleImage, root)));
    assert.equal(colour.width, face.artwork.width); assert.equal(colour.height, face.artwork.height);
    assert.equal(gray.width, colour.width); assert.equal(gray.height, colour.height);
    for (const pixel of [0, colour.width - 1, (colour.height - 1) * colour.width, colour.width * colour.height - 1]) {
      assert.equal(colour.pixels[pixel * 4 + 3], 0, 'Transparent rounded corner');
    }
    assert.equal(colour.pixels[(Math.floor(colour.height / 2) * colour.width + Math.floor(colour.width / 2)) * 4 + 3], 255);
    for (let i = 0; i < colour.pixels.length; i += 4) {
      assert.equal(gray.pixels[i], gray.pixels[i + 1]);
      assert.equal(gray.pixels[i], gray.pixels[i + 2]);
      assert.equal(gray.pixels[i + 3], colour.pixels[i + 3]);
    }
  }
  const xiphos = catalogue.cards.find(card => card.faces.some(face => face.name === 'Temenos Xiphos'));
  assert.notEqual(xiphos.faces[0].artwork.image, xiphos.faces[1].artwork.image);
  assert.match(catalogue.cards.find(card => card.faces[0].name === 'Fists').faces[0].artwork.image, /epson-07102026162435\/fists.png$/);
});

test('new scans preserve original artwork links, disambiguate copies and link reversible faces independently', async () => {
  for (const [index, config] of configs.entries()) {
    const manifest = manifests[index];
    assert.equal(manifest.source, config.source);
    assert.equal(manifest.sourceSha256, config.sourceSha256);
    assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(await readFile(new URL(`data/reference/gear-art-${config.batch}.json`, root))).digest('hex'), manifest.configurationSha256);
    // Completed assets remain usable after the user removes a source scan.
    // A retained/restored source must still match the recorded extraction hash.
    const source = await readFile(new URL(config.source, root)).catch(error => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (source) assert.equal(createHash('sha256').update(source).digest('hex'), manifest.sourceSha256);
    assert.deepEqual(manifest.cards.map(card => [card.definitionId, card.faceId, card.filename]),
      config.cards.map(card => [card.definitionId, card.faceId, card.filename]));
    for (const card of manifest.cards) {
      assert.ok(card.artwork.image.startsWith(`assets/gear-art/${config.batch}/`));
      for (const alias of card.sourcePrintedIds ?? []) assert.ok(card.printedIds.includes(alias));
    }
  }
  assert.equal(new Set(artwork.map(card => `${card.definitionId}/${card.faceId}`)).size, 567);
  const chainWhips = catalogue.cards.filter(card => card.faces[0].name === 'Chain Whip');
  assert.equal(chainWhips.length, 2);
  assert.ok(chainWhips.find(card => card.printedIds.includes('BJ0874')).faces[0].artwork);
  assert.equal(chainWhips.find(card => card.printedIds.includes('BR0729')).faces[0].artwork, undefined);
  const muck = artwork.filter(card => card.name === 'Muck Armor');
  assert.equal(muck.length, 1);
  assert.deepEqual(muck[0].sourcePrintedIds, ['BJ0919']);
  assert.equal(manifests.find(manifest => manifest.batch === 'epson-211018').skippedCards[0].sourcePrintedIds[0], 'BJ0920');
  for (const name of ['Metasword', 'Ladder Buckler', 'Boom Spear', 'Leg Khopesh', 'Fumeblade (Barred)',
    'Necrotic Virus', 'Umbral Virus', 'Spherecast', 'Right Talon of Doom', 'Descender',
    'Spiral Whip', 'Spiral Mace', 'Hammer-Sword', 'Barbed Saw', 'Exoaegis', 'Sun Spear', 'Sun Disc', 'Voice of the People',
    'Phantom Spear', 'Lesser Saphos', 'Dahaka Blade', 'Atlantean Gun', 'Atlantean Gun (Generated)', 'Suntanned Fists']) {
    const faces = catalogue.cards.find(card => card.faces[0].name === name).faces;
    assert.ok(faces[0].artwork); assert.ok(faces[1].artwork);
    assert.notEqual(faces[0].artwork.image, faces[1].artwork.image);
  }
  const repeated = manifests.find(manifest => manifest.batch === 'epson-215757');
  assert.equal(repeated.cards.length, 2);
  const copies = repeated.skippedCards.filter(card => card.definitionId);
  assert.equal(copies.length, 10);
  for (const copy of copies) {
    const matches = artwork.filter(card => card.definitionId === copy.definitionId && card.faceId === copy.faceId);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].artwork.image.includes('epson-212452/'), true);
  }
  const textOnly = manifests.find(manifest => manifest.batch === 'epson-185936').skippedCards[0];
  assert.equal(textOnly.name, 'Eschaton Stones');
  assert.match(textOnly.reason, /no illustration/);
  assert.equal(catalogue.cards.find(card => card.id === textOnly.definitionId).faces[0].artwork, undefined);
  // Source ID discrepancies are evidence, not new card aliases or instances.
  for (const [name, observed] of [['Unsolved Enigma', 'AJ0280'], ['Manos Discus', 'AJ0279']]) {
    const entry = artwork.find(card => card.name === name);
    assert.deepEqual(entry.observedPrintedIds, [observed]);
    assert.equal(entry.printedIds.includes(observed), false);
    assert.match(entry.reviewNote, /imported catalogue/);
  }
  // Similar names are separate Cycle I cards, rather than implied reverse sides.
  for (const names of [['Gigan', 'Gigas'], ["Ariadne's Hello", "Ariadne's Goodbye"], ['Iapetus Lifeguard', 'Iapetus Lifesaver']]) {
    const cards = names.map(name => catalogue.cards.find(card => card.faces[0].name === name));
    assert.notEqual(cards[0].id, cards[1].id);
    assert.notEqual(cards[0].faces[0].artwork.image, cards[1].faces[0].artwork.image);
  }
});

test('later-cycle scans distinguish variants and preserve duplicate and continuation evidence', () => {
  for (const name of ['First Blade', 'Gaiaegis', 'Midashield', 'Blades of Rage', 'Slushbane']) {
    const cards = catalogue.cards.filter(card => card.faces[0].name === name);
    assert.equal(cards.length, 2, name);
    assert.ok(cards.every(card => card.faces[0].artwork), name);
    assert.notEqual(cards[0].faces[0].artwork.image, cards[1].faces[0].artwork.image);
  }
  const recent = manifests.filter(manifest => /^epson-0/.test(manifest.batch) && manifest.batch !== 'epson-07102026162435');
  assert.equal(recent.flatMap(manifest => manifest.cards).length, 279);
  const copies = recent.flatMap(manifest => manifest.skippedCards).filter(card => card.definitionId);
  assert.equal(copies.length, 3);
  for (const copy of copies) {
    assert.equal(artwork.filter(card => card.definitionId === copy.definitionId && card.faceId === copy.faceId).length, 1);
  }
});

test('the missing-gear scan fills ten real faces, keeps Fists and its variant separate and records the Vulture Mask footer discrepancy', () => {
  const manifest = manifests.find(manifest => manifest.batch === 'epson-07102026162435');
  assert.equal(manifest.cards.length, 10);
  const vulture = manifest.cards.find(card => card.name === 'Vulture Mask');
  assert.deepEqual(vulture.observedPrintedIds, ['AJ0274']); assert.deepEqual(vulture.printedIds, ['AJ0279']);
  assert.match(vulture.reviewNote, /no card identity or supply count is changed/);
  const fists = manifest.cards.find(card => card.name === 'Fists'), sun = manifest.cards.find(card => card.name === 'Suntanned Fists');
  assert.notEqual(fists.definitionId, sun.definitionId);
  assert.equal(manifest.cards.find(card => card.name === 'Stock Cryptex').definitionId, sun.definitionId);
  assert.equal(manifest.cards.find(card => card.name === 'Stock Cryptex').faceId, 'back');
});

test('catalogue validation rejects invalid artwork dimensions and unsafe asset paths', () => {
  for (const invalid of [{ width: 0 }, { artBottom: 99999 }, { image: '../outside.png' }]) {
    const broken = structuredClone(catalogue);
    Object.assign(broken.cards.flatMap(card => card.faces).find(face => face.artwork).artwork, invalid);
    assert.throws(() => parseCatalogue(broken), /Invalid Gear artwork/);
  }
});
