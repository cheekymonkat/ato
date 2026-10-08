import type { CardFace } from '../../domain/cards.ts';

const sizes: Record<string, { width: number; height: number }> = {
  'Mini American': { width: 270, height: 414 },
  Standard: { width: 326.4, height: 456.96 },
  Square: { width: 352.5, height: 352.5 },
  Tarot: { width: 359.04, height: 620.16 },
};

/** Printed proportions are minimums; text can grow without an inner scroll area. */
export function catalogueCardSize(face: CardFace, availableWidth: number) {
  const book = face.family === 'Story' || face.family === 'Doom';
  const printed = sizes[face.data.cardSize] ?? sizes.Standard;
  const width = Math.max(1, Math.min(availableWidth, book && availableWidth >= 620 ? 834 : printed.width));
  return { width, minHeight: book ? 457 : printed.height * width / printed.width, landscape: book && width >= 620 };
}
