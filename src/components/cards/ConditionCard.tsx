import { StyleSheet, Text, View } from 'react-native';
import type { CardFace } from '../../domain/cards';
import { displayValue } from '../../domain/card-presentation';
import { conditionSections } from '../../domain/conditions';
import { useCardColours } from './CardColours';
import { RichParagraph } from './RichParagraph';

const ochre = '#A86710';
/** White Condition cards with ochre headings, grey abilities and a separate aftermath. */
export function ConditionCard({ face }: { face: CardFace }) {
  const paint = useCardColours(), sections = conditionSections(face), colour = paint.colour(ochre);
  return <View testID={`condition-card-${face.id}`} style={[styles.card, { backgroundColor: paint.colour('#FFFFFF'), borderColor: paint.colour('#D4D4D4') }]}>
    <View style={styles.body}>
      <Text accessibilityRole="header" style={[styles.title, { color: colour }]}>{face.name.toUpperCase()}</Text>
      {Boolean(face.data.subtitle) && <Text style={[styles.subtitle, { color: colour }]}>({displayValue(face.data.subtitle).toUpperCase()})</Text>}
      <View style={styles.effect}><RichParagraph paragraph={sections.effect} inlineGates size={13} /></View>
      {sections.abilities.map((ability, index) => <View key={index} style={styles.ability}>
        <View style={styles.headingRow}><Text style={[styles.abilityTitle, { backgroundColor: colour, color: paint.colour('#FFFFFF') }]}>{displayValue(ability.title)}</Text></View>
        <View style={[styles.abilityEffect, { backgroundColor: paint.colour('#D4D4D4') }]}><RichParagraph paragraph={ability.effects} inlineGates size={13} /></View>
      </View>)}
      {Boolean(sections.endOfBattle) && <View style={styles.aftermath}><RichParagraph paragraph={sections.aftermath} inlineGates size={13} /></View>}
    </View>
    <View style={[styles.footer, { backgroundColor: colour }]}><Text style={[styles.ids, { color: paint.colour('#FFFFFF') }]}>ID(s): {face.printedIds.join(', ') || 'Not supplied'}</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 300, alignSelf: 'center', minHeight: 320, borderRadius: 9, overflow: 'hidden', borderWidth: 1 },
  body: { flexGrow: 1, paddingTop: 10, paddingBottom: 12 }, title: { fontSize: 19, lineHeight: 27, textAlign: 'center', paddingHorizontal: 12 },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', paddingHorizontal: 12, marginTop: 4 },
  effect: { marginHorizontal: 16, marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D4D4D4', paddingVertical: 6 },
  ability: { marginTop: 14 }, headingRow: { alignItems: 'center', paddingHorizontal: 12 },
  abilityTitle: { fontSize: 13, lineHeight: 20, textAlign: 'center', paddingHorizontal: 5 }, abilityEffect: { paddingHorizontal: 14, paddingVertical: 8 },
  aftermath: { marginHorizontal: 16, marginTop: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D4D4D4', paddingVertical: 6 },
  footer: { paddingHorizontal: 10, paddingVertical: 6 }, ids: { fontSize: 10, lineHeight: 15 },
});
