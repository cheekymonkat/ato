import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { keywordRepository } from '../../catalogue/keywords';
import type { CardFace } from '../../domain/cards';
import { displayValue, strings } from '../../domain/card-presentation';
import { titanAbilityRows } from '../../domain/titan-presentation';
import { gearTheme as g } from '../../theme/gear-tokens';
import { useCardColours } from './CardColours';
import { CardIcon } from './CardIcon';
import { DiceStack } from './GearCard';
import { RichParagraph } from './RichParagraph';
import { adjustedStat, MODIFIED_STAT_COLOUR } from '../../domain/combat-modifiers';
import { useCombatAdjustment } from './CombatStats';

/** Intrinsic height keeps all ability explanations readable on touch screens without hover. */
export function TitanCardBody({ face, ink, headerActions, onSelect }: { face: Extract<CardFace, { kind: 'titan' }>; ink: string; headerActions?: ReactNode; onSelect?: () => void }) {
  const paint = useCardColours();
  const speed = adjustedStat(face.data.speed, useCombatAdjustment(face, 'speed'));
  return <>
    <View style={styles.header}>
      <View style={styles.identity}>
        <View style={styles.identityLine}>
          <TitanSelection onSelect={onSelect} inline>
          <Text accessibilityRole="header" style={[styles.name, { color: ink }]}>{face.name}</Text>
          <View style={styles.stats}>
            <DiceStack dice={[face.data.titanPower]} />
            <View accessible accessibilityLabel={`Speed ${speed.label}`} style={styles.speed}>
              <CardIcon name="Speed" size={20} /><Text style={[styles.statText, { color: paint.colour(speed.changed ? MODIFIED_STAT_COLOUR : '#000000') }]}>{speed.text}</Text>
            </View>
          </View>
          </TitanSelection>
          {headerActions}
        </View>
        {Boolean(face.data.subtitle) && <TitanSelection onSelect={onSelect}><Text style={styles.subtitle}>{displayValue(face.data.subtitle)}</Text></TitanSelection>}
      </View>
      <Text style={[styles.meta, { color: ink }]}>{face.family} · {face.cycle}</Text>
    </View>
    <TitanSelection onSelect={onSelect}>
    {strings(face.data.traits).length > 0 && <Text style={styles.statText}>{strings(face.data.traits).join(' · ')}</Text>}
    {Boolean(face.data.flavor) && <Text style={styles.flavor}>{displayValue(face.data.flavor)}</Text>}
    <View style={styles.abilities}>{titanAbilityRows(face, keywordRepository).map((row, index) => <View key={index}
        style={[styles.ability, index > 0 && { borderTopWidth: 1, borderTopColor: paint.colour(g.papyrusDark), paddingTop: 10 }]}>
        <RichParagraph paragraph={row.heading} inlineGates boldKeywords size={14} align="left" />
        {row.details.map(detail => <View key={detail.name} style={styles.explanation}>
          {row.details.length > 1 && <Text style={styles.detailName}>{detail.name}</Text>}
          {detail.definition ? <>
            {detail.definition.auto && <Text style={styles.statText}>Auto- triggers this ability during the first ability window instead of the listed timing.</Text>}
            <RichParagraph paragraph={detail.definition.main} inlineGates size={13} align="left" />
            {detail.definition.sections.map((section, sectionIndex) => <View key={sectionIndex} style={styles.explanation}>
              <Text style={styles.detailName}>{section.title}</Text>
              {section.content ? <RichParagraph paragraph={section.content} inlineGates size={13} align="left" /> : <Text style={styles.statText}>Definition not supplied.</Text>}
            </View>)}
          </> : <Text style={styles.statText}>Definition not supplied.</Text>}
        </View>)}
    </View>)}</View>
    </TitanSelection>
  </>;
}
/** Keep table actions outside the edit target so they work independently on touch. */
function TitanSelection({ children, onSelect, inline = false }: { children: ReactNode; onSelect?: () => void; inline?: boolean }) {
  const style = inline ? styles.identitySelection : styles.contentSelection;
  return onSelect ? <Pressable accessibilityRole="button" accessibilityLabel="Edit selected Titan" onPress={onSelect} style={style}>{children}</Pressable>
    : <View style={style}>{children}</View>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 12, rowGap: 4 },
  identity: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0, gap: 3 },
  identityLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  identitySelection: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, flexShrink: 1, minWidth: 0 },
  contentSelection: { gap: 12, minWidth: 0 },
  name: { fontSize: 19, lineHeight: 27, textAlign: 'left', flexShrink: 1 }, subtitle: { fontSize: 13, lineHeight: 19, color: '#000000' },
  meta: { fontSize: 11, lineHeight: 17, textAlign: 'right', marginLeft: 'auto', maxWidth: '100%' },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  speed: { flexDirection: 'row', alignItems: 'center', gap: 4 }, statText: { fontSize: 12, lineHeight: 18, color: '#000000' },
  flavor: { fontSize: 12, lineHeight: 18, color: '#000000', fontStyle: 'italic' },
  abilities: { minWidth: 0, gap: 10 },
  ability: { gap: 5 }, explanation: { gap: 4 }, detailName: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#000000' },
});
