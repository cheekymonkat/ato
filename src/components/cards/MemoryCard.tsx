import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon, Text as SvgText } from 'react-native-svg';
import type { CardFace } from '../../domain/cards';
import { displayValue } from '../../domain/card-presentation';
import { fatedMemorySide, memoryAbilityPanels } from '../../domain/memory-presentation';
import type { MemoryProgress } from '../../domain/party';
import { memoryTheme as m } from '../../theme/memory-tokens';
import { useCardColours } from './CardColours';
import { RichParagraph } from './RichParagraph';

type MemoryFace = Extract<CardFace, { kind: 'mnemos' | 'fated-mnemos' }>;

/** Split black arrows reproduce ATCC's StatTitle skill badges without DOM measurements. */
function SkillBadge({ skill, value = 1 }: { skill: string; value?: number }) {
  const paint = useCardColours(), ink = paint.inactive ? m.inactiveInk : m.black;
  const text = skill.toUpperCase(), width = 85 + text.length * 17;
  const split = width - 47;
  return <View accessible accessibilityLabel={`${skill} ${value}`} style={{ height: 18, width: width * 18 / 38, maxWidth: '100%' }}>
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} 38`}>
      <Polygon points={`0,19 12,3 ${split - 4},3 ${split + 5},35 12,35`} fill={paint.colour(ink)} />
      <Polygon points={`${split + 2},3 ${width - 12},3 ${width},19 ${width - 12},35 ${split + 11},35`} fill={paint.colour(ink)} />
      <SvgText x="16" y="28" fontSize="24" fontWeight="bold" fill={m.white}>{text}</SvgText>
      <SvgText x={width - 31} y="28" fontSize="24" fontWeight="bold" fill={m.white}>{value < 0 ? '−1' : '1'}</SvgText>
    </Svg>
  </View>;
}

/** Shared by selection, memory editor and dashboard; every panel grows to retain all text. */
export function MemoryCard({ face, progress }: { face: MemoryFace; progress?: MemoryProgress }) {
  const paint = useCardColours(), [width, setWidth] = useState<number>(m.width);
  const ink = paint.inactive ? m.inactiveInk : m.black;
  const fated = face.kind === 'fated-mnemos', data = face.data;
  const side = face.kind === 'fated-mnemos' ? fatedMemorySide(face, progress) : undefined;
  const name = side?.name ?? face.name, traits = side?.traits ?? data.traits, stats = side?.stats ?? data.stats;
  const scale = Math.min(1, width / m.width), padding = Math.max(10, 15 * scale);
  const titleSize = Math.max(16, Math.min(fated ? 19 : 18, 300 / ((fated ? 1.2 : 1) * name.length)) * scale);
  return <View testID={`memory-card-${face.id}`} onLayout={event => setWidth(event.nativeEvent.layout.width)}
    style={[styles.card, { minHeight: m.height * scale, backgroundColor: paint.colour(paint.inactive ? m.inactiveBackground : m.background) }]}>
    <View style={[styles.titleBand, fated && { backgroundColor: paint.colour(side?.resolved ? m.growth : ink) }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: fated ? m.white : ink, fontSize: titleSize }]}>{name.toUpperCase()}</Text>
      {traits.length > 0 && <Text style={[styles.traits, { fontSize: Math.max(11, 14 * scale), color: paint.colour(m.traits) }]}>{traits.map(trait => trait.toUpperCase()).join(' - ')}</Text>}
    </View>
    {face.kind === 'mnemos' ? <View style={[styles.panels, { marginHorizontal: padding }]}>
      {memoryAbilityPanels(face, progress).map(({ group, index }) => <View key={index} style={[styles.ability, { backgroundColor: paint.colour(paint.inactive ? m.inactivePanel : m.ability) }]}>
        {progress && <Text style={[styles.availability, { color: ink }]}>{`Ability ${index + 1} · Nodes unlocked`}</Text>}
        <RichParagraph paragraph={group} inlineGates size={14} colour={ink} />
      </View>)}
    </View> : side && <>
      {Boolean(side.flavor) && <Text style={[styles.flavor, { color: paint.colour(paint.inactive ? ink : m.flavor) }]}>{displayValue(side.flavor).replace(/[.!?]$/, '')}.</Text>}
      <View style={styles.effectBox}><View style={[styles.effect, { backgroundColor: paint.colour(paint.inactive ? m.inactivePanel : m.effect) }]}>
        <RichParagraph paragraph={side.ability} inlineGates size={14} colour={ink} />
      </View></View>
    </>}
    {stats.length > 0 && <View style={styles.skills}>{stats.map((skill, index) => <SkillBadge key={`${skill}:${index}`} skill={skill} value={fated ? -1 : 1} />)}</View>}
    <View style={styles.footer}><Text style={[styles.ids, { color: ink }]}>ID(s): {face.printedIds.join(', ') || 'Not supplied'}</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: m.width, borderRadius: m.radius, overflow: 'hidden', justifyContent: 'space-between', alignSelf: 'center' },
  titleBand: { paddingVertical: 5, paddingHorizontal: 8, gap: 3 }, title: { textAlign: 'center', lineHeight: 26 }, traits: { textAlign: 'center', lineHeight: 18 },
  panels: { flexGrow: 1, marginBottom: 10, marginTop: 5, gap: 10 }, ability: { flexGrow: 1, minHeight: 40, padding: 10 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 5, paddingHorizontal: 8 },
  flavor: { fontSize: 13, lineHeight: 19, textAlign: 'center', fontStyle: 'italic', padding: 5, marginHorizontal: '5%', marginVertical: 8 },
  effectBox: { paddingHorizontal: 10, alignItems: 'center', marginBottom: 15 }, effect: { paddingVertical: 4, paddingHorizontal: 10, maxWidth: '100%' },
  footer: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 }, ids: { color: m.black, fontSize: 10, lineHeight: 15 },
  availability: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 5 },
});
