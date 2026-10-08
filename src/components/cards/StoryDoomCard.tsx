import { StyleSheet, Text, View } from 'react-native';
import type { CardDefinition, CardFace } from '../../domain/cards';
import { displayValue, strings } from '../../domain/card-presentation';
import { CardIcon } from './CardIcon';
import { useCardColours } from './CardColours';
import { CatalogueBadge, CatalogueFooter, CatalogueFrame, CatalogueTitle } from './CatalogueFrame';
import { catalogueCardSize } from './catalogue-layout';
import { RichParagraph } from './RichParagraph';
import type { TextActions } from './RichParagraph';

/** Mirrored book covers; on phones the illustrated symbol panel gives way to the page. */
export function StoryDoomCard({ card, face, width, ...actions }: TextActions & { card: CardDefinition; face: CardFace; width: number }) {
  const paint = useCardColours(), doom = face.family === 'Doom', landscape = catalogueCardSize(face, width).landscape;
  const ink = doom ? '#FFFFFF' : '#000000', cover = doom ? '#3E1E07' : '#5E300E';
  const rawNumber = displayValue(face.data.cardNumber ?? card.faces[0].data.cardNumber);
  const number = `${rawNumber === 'IO' ? '1' : rawNumber}${face.id === 'front' ? 'A' : 'B'}`;
  const symbol = <View style={[styles.symbol, { backgroundColor: paint.colour(doom ? '#1A1A1A' : '#FFFFFF') }]}>
    <CardIcon name={doom ? 'Doom' : 'Progress'} size={Math.min(230, width * 0.28)} />
  </View>;
  return <CatalogueFrame face={face} width={width} paper={doom ? '#1A1A1A' : '#FFFFFF'}>
    <View style={styles.spread}>
      {landscape && !doom && symbol}
      <View style={[styles.book, { backgroundColor: paint.colour(cover) }]}>
        <View accessible accessibilityLabel={`Card ${number}`} style={[styles.ribbon, doom ? styles.ribbonRight : styles.ribbonLeft, { backgroundColor: paint.colour(doom ? '#5E300E' : '#8B4513') }]}>
          <Text style={styles.cardNumber}>{number}</Text>
          <View style={[styles.ribbonTip, { borderTopColor: paint.colour(cover) }]} />
        </View>
        <View style={[styles.pages, { backgroundColor: paint.colour(doom ? '#000000' : '#BFBCAB'), paddingLeft: doom ? 0 : 8, paddingRight: doom ? 8 : 0 }]}>
          <View style={[styles.page, { backgroundColor: paint.colour(doom ? '#0B0B0B' : '#F0EEDF') }]}>
            <View style={styles.content}>
              <CatalogueTitle name={face.name} colour={ink} />
              <View style={styles.flavor}>
                {strings(face.data.flavor).map((paragraph, index) => <Text key={index} style={[styles.flavorText, { color: paint.colour(doom ? '#B5B5B5' : '#666666') }]}>{paragraph}</Text>)}
              </View>
              <CatalogueBadge title="Rules" background="#2F1706" />
              {Boolean(face.data.rulesTitle) && <Text style={[styles.rulesTitle, { color: paint.colour(ink) }]}>{displayValue(face.data.rulesTitle)}</Text>}
              {(Array.isArray(face.data.rules) ? face.data.rules : []).map((paragraph, index) => <RichParagraph key={index} paragraph={paragraph} inlineGates colour={ink} invert={doom} size={14} {...actions} />)}
            </View>
            <CatalogueFooter face={face} colour={ink} background={doom ? '#000000' : undefined} />
          </View>
        </View>
      </View>
      {landscape && doom && symbol}
    </View>
  </CatalogueFrame>;
}
const styles = StyleSheet.create({
  spread: { flexDirection: 'row', minHeight: 457 }, symbol: { flex: 4, alignItems: 'center', justifyContent: 'center', padding: 12 },
  book: { flex: 3, minWidth: 0, paddingVertical: 12, paddingHorizontal: 10 },
  pages: { flexGrow: 1, paddingVertical: 8, marginHorizontal: 7 }, page: { flexGrow: 1, justifyContent: 'space-between' },
  content: { paddingHorizontal: 10, paddingBottom: 24, gap: 10 },
  flavor: { gap: 10 }, flavorText: { fontSize: 13, lineHeight: 20, fontStyle: 'italic' }, rulesTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  ribbon: { position: 'absolute', zIndex: 1, top: 34, width: 25, alignItems: 'center', paddingTop: 3 }, ribbonLeft: { left: 0 }, ribbonRight: { right: 0 },
  cardNumber: { color: '#FFFFFF', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  ribbonTip: { width: 0, height: 0, borderLeftWidth: 12.5, borderRightWidth: 12.5, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
});
