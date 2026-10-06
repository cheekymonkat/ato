import type { CatalogueRepository } from '../catalogue/repository.ts';
import { memoryProgress } from './memories.ts';
import type { Argonaut } from './party.ts';

type MemoryCatalogue = Pick<CatalogueRepository, 'getFace'>;
export interface StandardMnemosStats { cardCount: number; nodeCount: number }
export interface ArgonautLikelihood {
  stats: Record<string, StandardMnemosStats>;
  leastIds: string[];
  mostIds: string[];
}

/** Only assigned, catalogue-confirmed standard Mnemos count; readiness is irrelevant. */
export function getStandardMnemosStats(argonaut: Argonaut, catalogue: MemoryCatalogue): StandardMnemosStats {
  const assigned = new Set(argonaut.mnemosIds.filter(id => id !== null));
  const cards = argonaut.instances.filter(instance => assigned.has(instance.id)
    && catalogue.getFace(instance.definitionId, instance.faceId)?.kind === 'mnemos');
  return { cardCount: cards.length, nodeCount: cards.reduce((sum, instance) => sum + (memoryProgress(instance).node ?? 0), 0) };
}
const compare = (a: StandardMnemosStats, b: StandardMnemosStats) => a.cardCount - b.cardCount || a.nodeCount - b.nodeCount;

/** Return every exact tie so presentation can distinguish eligibility from a random pick. */
export function evaluateArgonautLikelihood(argonauts: readonly Argonaut[], catalogue: MemoryCatalogue): ArgonautLikelihood {
  if (!argonauts.length) throw new Error('Party cannot be empty.');
  const evaluated = argonauts.map(argonaut => ({ id: argonaut.id, ...getStandardMnemosStats(argonaut, catalogue) }));
  const sorted = [...evaluated].sort(compare), least = sorted[0], most = sorted[sorted.length - 1];
  return { stats: Object.fromEntries(evaluated.map(({ id, cardCount, nodeCount }) => [id, { cardCount, nodeCount }])),
    leastIds: evaluated.filter(entry => compare(entry, least) === 0).map(entry => entry.id),
    mostIds: evaluated.filter(entry => compare(entry, most) === 0).map(entry => entry.id) };
}
/** Inject the random source for reproducible rules checks; unique results consume no draw. */
export function chooseLikelyArgonaut(ids: readonly string[], random: () => number = Math.random): string {
  if (!ids.length) throw new Error('No eligible Argonauts.');
  if (ids.length === 1) return ids[0];
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random source must return a number from 0 (inclusive) to 1 (exclusive).');
  return ids[Math.floor(draw * ids.length)];
}
