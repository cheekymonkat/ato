import { createHash } from 'node:crypto';
import { aliasesFor } from '../src/catalogue/normalize.ts';

export function createIdentityResolver(registry = { schemaVersion: 1, entries: [] }) {
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.entries)) throw new Error('Unsupported identity registry');
  const ids = new Set();
  for (const entry of registry.entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id) || typeof entry.game !== 'string' || typeof entry.family !== 'string' || !Array.isArray(entry.aliases) || !entry.aliases.every(a => typeof a === 'string') || (!entry.aliases.length && typeof entry.unprintedKey !== 'string')) throw new Error('Malformed or duplicate identity registry entry');
    ids.add(entry.id);
  }
  return {
    resolve(card) {
      const aliases = aliasesFor(card);
      // Identity has no page, array index or text content. The sole unprinted group
      // is pinned by game/family/cycle; a second record in that group fails collision validation.
      const unprintedKey = aliases.length ? undefined : JSON.stringify([card.game, card.renderType, card.cycle]);
      const matches = registry.entries.filter(entry => entry.game === card.game && entry.family === card.renderType &&
        (aliases.length ? entry.aliases.some(alias => aliases.includes(alias)) : entry.unprintedKey === unprintedKey));
      if (matches.length > 1) throw new Error(`Ambiguous registry identity for ${card.name}. Resolve it explicitly before importing.`);
      if (matches.length === 1) {
        matches[0].aliases = [...new Set([...matches[0].aliases, ...aliases])].sort();
        return matches[0].id;
      }
      const key = JSON.stringify([card.game, card.renderType, aliases.length ? aliases : unprintedKey]);
      const id = `def_${createHash('sha256').update(key).digest('hex').slice(0, 24)}`;
      if (ids.has(id)) throw new Error(`New identity collision for ${card.name}`);
      const entry = { id, game: card.game, family: card.renderType, aliases, ...(unprintedKey ? { unprintedKey } : {}) };
      registry.entries.push(entry); ids.add(id);
      return id;
    },
    snapshot() { return { schemaVersion: 1, entries: [...registry.entries].sort((a, b) => a.id.localeCompare(b.id)) }; },
  };
}
