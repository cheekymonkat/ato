import { StyleSheet, Text, View } from 'react-native';
import type { CardFace } from '../../domain/cards';
import { displayValue, objects } from '../../domain/card-presentation';
import { CatalogueBadge, CatalogueFooter, CatalogueFrame, CatalogueTitle } from './CatalogueFrame';
import { RichParagraph } from './RichParagraph';
import type { TextActions } from './RichParagraph';

export function KratosCard({ face, width, ...actions }: TextActions & { face: CardFace; width: number }) {
  const rally = objects(face.data.rally);
  return <CatalogueFrame face={face} width={width} paper="#FFFFFF">
    <View style={styles.body}>
      <CatalogueTitle name={face.name} />
      {Boolean(face.data.flavor) && <Text style={styles.flavor}>“{displayValue(face.data.flavor)}”</Text>}
      <View style={styles.effects}><RichParagraph paragraph={face.data.effects} inlineGates size={14} {...actions} /></View>
      {rally.length > 0 && <View style={styles.rally}>
        <CatalogueBadge title="Rally" />
        <View style={styles.rallyBody}>
          <Text style={styles.timing}>End of your turn:</Text>
          <RichParagraph paragraph={rally} inlineGates size={14} align="left" {...actions} />
          <Text style={styles.success}><Text style={styles.timing}>Success:</Text> Discard this card.</Text>
        </View>
      </View>}
    </View>
    <CatalogueFooter face={face} />
  </CatalogueFrame>;
}

export function MoirosCard({ face, width, ...actions }: TextActions & { face: CardFace; width: number }) {
  return <CatalogueFrame face={face} width={width} paper="#FFFFFF">
    <View style={styles.body}>
      <CatalogueTitle name={face.name} colour="#162F9A" />
      <View style={styles.effects}><RichParagraph paragraph={face.data.effects} inlineGates size={14} {...actions} /></View>
    </View>
    <CatalogueFooter face={face} />
  </CatalogueFrame>;
}
const styles = StyleSheet.create({
  body: { paddingTop: 10, paddingBottom: 20, gap: 12 },
  flavor: { marginHorizontal: 30, borderTopWidth: 1, borderColor: '#D4D4D4', paddingTop: 8, color: '#808080', fontStyle: 'italic', textAlign: 'center', fontSize: 13, lineHeight: 20 },
  effects: { marginHorizontal: 30, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D4D4D4', paddingVertical: 8 },
  rally: { marginTop: 8 }, rallyBody: { backgroundColor: '#D4D4D4', paddingVertical: 8, paddingHorizontal: 30, gap: 3 },
  timing: { fontWeight: '700', color: '#000000', fontSize: 14, lineHeight: 21 }, success: { marginTop: 6, color: '#000000', fontSize: 14, lineHeight: 21 },
});
