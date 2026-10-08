import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CardFace } from '../../domain/cards';
import { useCardColours } from './CardColours';
import { catalogueCardSize } from './catalogue-layout';

export function CatalogueFrame({ face, width, paper = '#DFDBCD', children }: {
  face: CardFace; width: number; paper?: string; children: ReactNode;
}) {
  const paint = useCardColours();
  return <View testID={`catalogue-card-${face.family}-${face.id}`} style={[styles.frame, {
    width, minHeight: catalogueCardSize(face, width).minHeight, backgroundColor: paint.colour(paper),
  }]}>{children}</View>;
}

export function CatalogueTitle({ name, subtitle, background, colour = '#000000', generous = false }: {
  name: string; subtitle?: string; background?: string; colour?: string; generous?: boolean;
}) {
  const paint = useCardColours();
  return <View style={[styles.titleBand, generous && { paddingVertical: 16 }, background && { backgroundColor: paint.colour(background) }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: paint.colour(colour) }]}>{name.toUpperCase()}</Text>
    {Boolean(subtitle) && <Text style={[styles.subtitle, { color: paint.colour(colour) }]}>{subtitle!.toUpperCase()}</Text>}
  </View>;
}

export function CatalogueFooter({ face, background, colour = '#000000' }: { face: CardFace; background?: string; colour?: string }) {
  const paint = useCardColours();
  return <View style={[styles.footer, background && { backgroundColor: paint.colour(background) }]}>
    <Text style={[styles.ids, { color: paint.colour(colour) }]}>ID(s): {face.printedIds.join(', ') || 'Not supplied'}</Text>
  </View>;
}

export function CatalogueBadge({ title, background = '#000000' }: { title: string; background?: string }) {
  const paint = useCardColours();
  return <View style={styles.badgeRow}><Text style={[styles.badge, { backgroundColor: paint.colour(background), color: paint.colour('#FFFFFF') }]}>{title.toUpperCase()}</Text></View>;
}

const styles = StyleSheet.create({
  frame: { maxWidth: '100%', alignSelf: 'center', borderRadius: 10, overflow: 'hidden', justifyContent: 'space-between' },
  titleBand: { paddingHorizontal: 12, paddingVertical: 8, gap: 3 },
  title: { fontSize: 19, lineHeight: 26, textAlign: 'center' }, subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  footer: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 }, ids: { fontSize: 10, lineHeight: 15 },
  badgeRow: { alignItems: 'center', paddingHorizontal: 12 },
  badge: { fontSize: 13, lineHeight: 20, paddingHorizontal: 5, textAlign: 'center', borderWidth: 1, borderColor: '#FFFFFF' },
});
