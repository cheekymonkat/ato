import { StyleSheet, Text, View } from 'react-native';
import type { CardFace } from '../../domain/cards';
import { displayValue, objects } from '../../domain/card-presentation';
import { CardIcon } from './CardIcon';
import { useCardColours } from './CardColours';
import { CatalogueFooter, CatalogueFrame, CatalogueTitle } from './CatalogueFrame';
import { RichParagraph } from './RichParagraph';
import type { TextActions } from './RichParagraph';

export function ExplorationCard({ face, width, ...actions }: TextActions & { face: CardFace; width: number }) {
  const paint = useCardColours(), data = face.data;
  const triggers = Math.max(0, Number(data.adversaryTriggers) || 0), secondary = objects(data.effects2);
  return <CatalogueFrame face={face} width={width}>
    <CatalogueTitle name={face.name} background="#000000" colour="#FFFFFF" generous />
    <View style={[styles.effects, { backgroundColor: paint.colour('#CAC7B9') }]}>
      <RichParagraph paragraph={data.effects} inlineGates align="left" size={14} {...actions} />
      {secondary.length > 0 && <View style={styles.secondary}><RichParagraph paragraph={secondary} inlineGates align="left" size={14} {...actions} /></View>}
    </View>
    <View>
      {triggers > 0 && <View accessible accessibilityLabel={`${triggers} Adversary triggers`} style={styles.triggers}>
        {Array.from({ length: triggers }, (_, index) => <View key={index} style={styles.trigger}><CardIcon name="Adversary" invert size={32} /></View>)}
      </View>}
      <View style={styles.footerRow}>
        {data.number != null && <View accessible accessibilityLabel={`Exploration card ${data.number}`} style={styles.numberCircle}><Text style={styles.number}>{displayValue(data.number)}</Text></View>}
        <Text style={styles.remove}>{displayValue(data.removeEffect)}</Text>
        <View accessible accessibilityLabel={displayValue(data.stackType)}><CardIcon name={displayValue(data.stackType).replaceAll(' ', '')} size={34} /></View>
      </View>
      {Boolean(data.acclimation) && <Text style={styles.acclimation}>Acclimation: {displayValue(data.acclimation)}</Text>}
      <CatalogueFooter face={face} />
    </View>
  </CatalogueFrame>;
}
const styles = StyleSheet.create({
  effects: { flexGrow: 1, paddingVertical: 14, paddingHorizontal: '10%', gap: 10 }, secondary: { borderTopWidth: 1, borderColor: '#000000', paddingTop: 10 },
  triggers: { flexDirection: 'row', justifyContent: 'center', gap: 15, paddingTop: 12 }, trigger: { backgroundColor: '#000000', borderRadius: 30, padding: 3 },
  footerRow: { marginHorizontal: '5%', paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  numberCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }, number: { color: '#FFFFFF', fontSize: 15 },
  remove: { flex: 1, fontSize: 11, lineHeight: 16, fontStyle: 'italic', textAlign: 'center', color: '#000000' }, acclimation: { marginHorizontal: 10, fontSize: 11, lineHeight: 16, color: '#555555', textAlign: 'center' },
});
