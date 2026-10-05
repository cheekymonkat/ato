import { createHash } from 'node:crypto';

const MAX_CARDS = 100;
const MAX_BYTES = 512 * 1024;
const pretty = value => JSON.stringify(value, null, 2) + '\n';

/** Smaller human-readable mirrors of the validated catalogue; never runtime inputs. */
export function catalogueReviewFiles(catalogue) {
  const groups = new Map();
  for (const card of catalogue.cards) {
    if (!groups.has(card.family)) groups.set(card.family, []);
    groups.get(card.family).push(card);
  }
  const artifacts = [], files = [], slugs = new Set();
  for (const family of [...groups.keys()].sort()) {
    const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug || slugs.has(slug)) throw new Error(`Repeated review filename for family: ${family}`);
    slugs.add(slug);
    // Stable ID order matches the importer and avoids depending on machine locale.
    const cards = groups.get(family).toSorted((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    let part = 1, chunk = [];
    const serialize = values => pretty({ schemaVersion: 1, catalogueVersion: catalogue.catalogueVersion, family, part, cards: values });
    const flush = () => {
      const content = serialize(chunk), path = `${slug}/${String(part).padStart(3, '0')}.json`;
      artifacts.push({ path, content });
      files.push({ path, family, part, definitions: chunk.length, bytes: Buffer.byteLength(content),
        sha256: createHash('sha256').update(content).digest('hex') });
      chunk = []; part++;
    };
    for (const card of cards) {
      const candidate = [...chunk, card];
      if (chunk.length && (candidate.length > MAX_CARDS || Buffer.byteLength(serialize(candidate)) > MAX_BYTES)) flush();
      chunk.push(card);
      if (Buffer.byteLength(serialize(chunk)) > MAX_BYTES) throw new Error(`Card exceeds readable file size limit: ${card.id}`);
    }
    if (chunk.length) flush();
  }
  artifacts.push({ path: 'manifest.json', content: pretty({ format: 'ato-catalogue-review', schemaVersion: 1,
    catalogueVersion: catalogue.catalogueVersion, definitions: catalogue.cards.length,
    faces: catalogue.cards.reduce((sum, card) => sum + card.faces.length, 0),
    maxDefinitionsPerFile: MAX_CARDS, maxBytesPerFile: MAX_BYTES, files }) });
  return artifacts;
}
