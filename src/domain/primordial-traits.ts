import type { CatalogueRepository } from '../catalogue/repository.ts';
import { formatParagraph } from './card-presentation.ts';
import type { PrimordialTrack } from './evolution-rules.ts';
import { primordialFace } from './evolution.ts';
import { isRecord } from './json.ts';
import type { createKeywordRepository } from './keywords.ts';

export interface PrimordialTraitDefinition {
  title: string;
  main: unknown;
  sections: { title: string; content: unknown }[];
  source: 'card' | 'keyword' | 'override' | 'sheet' | 'missing';
  printedIds?: readonly string[];
  provenance?: string;
  note?: string;
}
const normalise = (name: string) => name.toLowerCase().replace(/[’]/g, "'").replace(/[‐‑–—-]/g, ' ').replace(/\s+/g, ' ').trim();
/** Trait cards and sheet data supplement the keyword dictionary without global name collisions. */
export function resolvePrimordialTrait(track: PrimordialTrack, trait: string, catalogue: CatalogueRepository,
  keywords: ReturnType<typeof createKeywordRepository>, overrides: Record<string, unknown> = {}): PrimordialTraitDefinition {
  const monsterOverrides = overrides[track.printedId];
  const override = isRecord(monsterOverrides) ? monsterOverrides[trait] : undefined;
  if (isRecord(override) && typeof override.usedFor === 'string' && normalise(override.usedFor) === normalise(track.name)
    && formatParagraph(override.mainDef).label) return { title: trait, main: override.mainDef, sections: [], source: 'override',
      ...(typeof override.source === 'string' ? { provenance: override.source } : {}) };
  const matches = catalogue.byName(trait).flatMap(card => card.faces)
    .filter(face => face.family === 'Trait' && normalise(face.name) === normalise(trait) && formatParagraph(face.data.effects).label);
  const owner = normalise(track.name === 'Alpha Temenos' ? 'Temenos' : track.name);
  const scoped = matches.filter(face => typeof face.data.usedFor === 'string' && normalise(face.data.usedFor) === owner);
  const generic = matches.filter(face => !face.data.usedFor);
  const face = scoped.length === 1 ? scoped[0] : !scoped.length && generic.length === 1 ? generic[0] : undefined;
  if (face) return { title: trait, main: face.data.effects, sections: [], source: 'card', printedIds: face.printedIds };
  const keyword = keywords.resolve(trait);
  if (keyword && (formatParagraph(keyword.main).label || keyword.sections.some(section => formatParagraph(section.content).label)))
    return { title: trait, main: keyword.main, sections: keyword.sections, source: 'keyword' };
  if (trait === 'VP Modification') {
    const vp = primordialFace(track, catalogue)?.data['vp+'];
    if (isRecord(vp)) return { title: trait, main: vp.effects, sections: [
      { title: 'VP count', content: String(vp.vpCount ?? '') },
      ...(isRecord(vp.climbTest) ? [{ title: 'Climb', content: `${String(vp.climbTest.stat)} ${String(vp.climbTest.difficulty)}+` }] : []),
      ...(isRecord(vp.holdOn) ? [{ title: 'Hold on · End of Primordial Round', content: `Test ${String(vp.holdOn.test)}. Fail: ${String(vp.holdOn.fail)}` }] : []),
    ], source: 'sheet' };
  }
  return { title: trait, main: undefined, sections: [], source: 'missing', note: 'This trait has no description in the bundled catalogue or keyword data. Refer to the printed Primordial sheet.' };
}
