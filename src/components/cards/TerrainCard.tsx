import { StyleSheet, Text, View } from 'react-native';
import type { CardFace } from '../../domain/cards';
import { displayValue, objects, strings } from '../../domain/card-presentation';
import { CardIcon } from './CardIcon';
import { useCardColours } from './CardColours';
import { CatalogueFooter, CatalogueFrame, CatalogueTitle } from './CatalogueFrame';
import { RichParagraph } from './RichParagraph';
import type { TextActions } from './RichParagraph';

export function TerrainCard({ face, width, ...actions }: TextActions & { face: CardFace; width: number }) {
  const paint = useCardColours(), tiles = objects(face.data.tiles);
  const keywords = strings(face.data.keywords).map(name => ({ abilityText: [{ type: 'keyword', value: name }] }));
  return <CatalogueFrame face={face} width={width}>
    <View>
      <CatalogueTitle name={face.name} background="#454549" colour="#FFFFFF" generous />
      {tiles.length > 0 && <View style={[styles.tiles, { backgroundColor: paint.colour('#BFBCAB') }]}>
        {tiles.map((tile, index) => <View key={index} accessible accessibilityLabel={`${displayValue(tile.count)} × ${displayValue(tile.type)} tile`} style={styles.tile}>
          <Text style={styles.count}>{displayValue(tile.count)} ×</Text>
          <View style={[styles.tileIcon, { backgroundColor: paint.colour('#9E9B8C') }]}>
            <CardIcon name={`Tile_${tile.type === 'O' ? '2x2' : displayValue(tile.type)}`} size={40} />
          </View>
        </View>)}
      </View>}
      <View style={styles.body}>
        {keywords.length > 0 && <RichParagraph paragraph={keywords} boldKeywords size={14} {...actions} />}
        <RichParagraph paragraph={face.data.abilities} inlineGates size={14} {...actions} />
      </View>
    </View>
    <CatalogueFooter face={face} />
  </CatalogueFrame>;
}
const styles = StyleSheet.create({
  tiles: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 10 }, count: { fontSize: 27, color: '#000000' },
  tileIcon: { borderRadius: 10, padding: 8, alignItems: 'center', justifyContent: 'center' }, body: { padding: 16, gap: 12 },
});
