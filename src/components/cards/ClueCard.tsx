import { StyleSheet, Text, View } from 'react-native';
import type { CardFace } from '../../domain/cards';
import { displayValue } from '../../domain/card-presentation';
import { CatalogueFooter, CatalogueFrame, CatalogueTitle } from './CatalogueFrame';
import { useCardColours } from './CardColours';
import { RichParagraph } from './RichParagraph';
import type { TextActions } from './RichParagraph';

/** Black title band, grey paper and a bordered italic clue at the foot. */
export function ClueCard({ face, width, ...actions }: TextActions & { face: CardFace; width: number }) {
  const paint = useCardColours();
  return <CatalogueFrame face={face} width={width} paper="#EEEEEE">
    <View>
      <CatalogueTitle name={face.name} subtitle={displayValue(face.data.subtitle)} background="#000000" colour="#FFFFFF" />
      <View style={styles.body}>
        {Boolean(face.data.imageDescription) && <Text style={styles.imageDescription}>Image: {displayValue(face.data.imageDescription)}</Text>}
        <RichParagraph paragraph={face.data.text} inlineGates size={14} {...actions} />
      </View>
    </View>
    <View>
      {Boolean(face.data.flavor) && <Text style={[styles.flavor, { color: paint.colour('#555555'), borderColor: paint.colour('#999999') }]}>{displayValue(face.data.flavor)}</Text>}
      <CatalogueFooter face={face} />
    </View>
  </CatalogueFrame>;
}
const styles = StyleSheet.create({
  body: { marginHorizontal: '5%', paddingVertical: 12, gap: 8 },
  imageDescription: { color: '#000000', fontSize: 13, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  flavor: { marginHorizontal: '5%', marginBottom: 4, padding: 5, borderTopWidth: 1, borderBottomWidth: 1, fontSize: 13, lineHeight: 20, fontStyle: 'italic', textAlign: 'center' },
});
