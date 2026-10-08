import { StyleSheet, Text, View } from 'react-native';
import type { CardFace } from '../../domain/cards';
import { displayValue } from '../../domain/card-presentation';
import { CardIcon } from './CardIcon';
import { useCardColours } from './CardColours';
import { CatalogueFooter, CatalogueFrame, CatalogueTitle } from './CatalogueFrame';
import { RichParagraph } from './RichParagraph';
import type { TextActions } from './RichParagraph';

const arrows: Record<string, string> = { Up: '↑', Down: '↓', Left: '←', Right: '→', Choose: '↕' };
export function TraumaCard({ face, width, ...actions }: TextActions & { face: CardFace; width: number }) {
  const paint = useCardColours(), data = face.data, subtype = displayValue(data.subtype), obol = subtype === 'Obol';
  const death = obol && !face.name.toUpperCase().includes('LIVE'), ink = death ? '#FFFFFF' : '#000000';
  return <CatalogueFrame face={face} width={width} paper={obol ? death ? '#000000' : '#FFFFFF' : '#DFDBCD'}>
    <View style={[styles.body, obol && styles.obol]}>
      <CatalogueTitle name={face.name} colour={death ? '#E8AAA0' : '#4D120B'} subtitle={data.usedFor ? `${displayValue(data.usedFor)} only` : undefined} />
      {Boolean(data.flavor) && <Text style={[styles.flavor, { color: paint.colour(death ? '#BBBBBB' : '#666666') }]}>“{displayValue(data.flavor)}”</Text>}
      <View style={styles.effects}><RichParagraph paragraph={data.effects} inlineGates colour={ink} invert={death} size={14} {...actions} /></View>
    </View>
    <View>
      {!obol && <View style={[styles.typeBar, { backgroundColor: paint.colour('#9B2315') }]}>
        <Text style={styles.value}>{subtype === 'Minor' ? arrows[displayValue(data.arrow)] ?? displayValue(data.arrow) : subtype === 'Major' ? displayValue(data.number) : ''}</Text>
        <Text style={styles.type}>{data.isCondition ? `CONDITION TRAUMA (${displayValue(data.isCondition).toUpperCase()})` : `${subtype.toUpperCase()} TRAUMA`}</Text>
        <View accessible accessibilityLabel={`${subtype} Trauma ${displayValue(data.sign)}`} style={styles.symbol}>
          <CardIcon name={subtype} size={34} />
          <Text style={styles.sign}>{displayValue(data.sign)}</Text>
        </View>
      </View>}
      <CatalogueFooter face={face} background="#4D120B" colour="#FFFFFF" />
    </View>
  </CatalogueFrame>;
}
const styles = StyleSheet.create({
  body: { paddingTop: 20, paddingBottom: 28, gap: 10 }, obol: { paddingTop: 45 },
  flavor: { marginHorizontal: 30, fontSize: 13, lineHeight: 20, fontStyle: 'italic', textAlign: 'center' },
  effects: { marginHorizontal: 30, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#AAAAAA' },
  typeBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4, gap: 8, minHeight: 32 },
  value: { minWidth: 16, fontSize: 18, color: '#FFFFFF' }, type: { flex: 1, fontSize: 11, lineHeight: 16, textAlign: 'center', color: '#FFFFFF' },
  symbol: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, sign: { position: 'absolute', fontSize: 23, lineHeight: 30, color: '#FFFFFF' },
});
