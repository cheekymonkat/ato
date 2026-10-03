import type { CardFace } from './cards.ts';
import { visitJson } from './json.ts';
import { flattenAbilities } from './references.ts';
import type { createKeywordRepository } from './keywords.ts';

/** Keep headline costs/gates intact and associate each hover definition with its own ability. */
export function titanAbilityRows(face: Extract<CardFace, { kind: 'titan' }>, keywords: ReturnType<typeof createKeywordRepository>) {
  return flattenAbilities(face.data.abilities).map(heading => {
    const names = new Set<string>();
    visitJson(heading, token => { if (token.type === 'keyword' && typeof token.value === 'string') names.add(token.value); });
    return { heading, details: [...names].map(name => ({ name, definition: keywords.resolve(name) })) };
  });
}
