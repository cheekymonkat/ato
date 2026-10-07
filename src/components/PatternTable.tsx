import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop, SvgXml } from 'react-native-svg';
import type { JsonValue } from '../domain/json';
import { effectLabel, kratosRowActive, kratosRowLabel, kratosRows, patternIconKey, traumaRowActive, traumaRows } from '../domain/pattern-table';
import type { PatternEffect, PatternKind } from '../domain/pattern-table';
import { grayscaleColour, grayscaleSvg } from '../domain/card-colour';
import { MODIFIED_STAT_COLOUR } from '../domain/combat-modifiers';
import { patternIcons } from '../theme/pattern-icons';
import { patternTheme as p } from '../theme/pattern-tokens';
import { theme } from '../theme/tokens';

function PatternSymbol({ name, size, inactive = false }: { name: string; size: number; inactive?: boolean }) {
  const xml = patternIcons[name as keyof typeof patternIcons];
  return xml ? <SvgXml xml={inactive ? grayscaleSvg(xml) : xml} width={size} height={size} /> : <Text style={styles.symbolFallback}>{name}</Text>;
}

function Gradient({ colour, band = false, inactive = false }: { colour: string; band?: boolean; inactive?: boolean }) {
  const id = `pattern-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const paint = inactive ? grayscaleColour : (value: string) => value;
  return <View accessible={false} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
    <Svg width="100%" height="100%">
      <Defs><LinearGradient id={id} x1="0%" y1={band ? '0%' : '100%'} x2={band ? '100%' : '0%'} y2={band ? '0%' : '65%'}>
        <Stop offset={band ? '20%' : '0%'} stopColor={paint(colour)} />
        <Stop offset={band ? '80%' : '100%'} stopColor={paint(band ? p.traumaBright : colour)} stopOpacity={band ? 1 : 0} />
      </LinearGradient></Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  </View>;
}

function Effect({ effect, inactive }: { effect: PatternEffect; inactive: boolean }) {
  return <View style={styles.effect}>
    {effect.quantity !== undefined && <Text style={styles.quantity}>{effect.quantity}</Text>}
    <PatternSymbol name={patternIconKey(effect)} size={p.effectSize} inactive={inactive} />
  </View>;
}

/** Shared by Titan references and future Pattern card inspection/overrides. */
export function PatternTable({ kind, table, currentValue }: { kind: PatternKind; table: readonly JsonValue[]; currentValue?: number }) {
  const colour = kind === 'Trauma' ? p.trauma : p.kratos;
  return <View style={styles.container}>
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.medallion, { backgroundColor: colour }]} />
        <Text accessibilityRole="header" style={[styles.title, { color: colour }]}>{kind} table</Text>
        <View style={styles.headerBalance} />
      </View>
      <View style={styles.table}>
        <Gradient colour={colour} />
        {table.length === 0 && <Text style={styles.empty}>No {kind.toLowerCase()} table supplied.</Text>}
        {kind === 'Trauma' ? traumaRows(table).map((row, index) => {
          const active = currentValue === undefined ? undefined : traumaRowActive(row, currentValue), inactive = active === false;
          return <View key={index} testID={`pattern-row-Trauma-${index}`} accessible accessibilityLabel={`${row.range}: ${row.type} Trauma${active === undefined ? '' : `; ${active ? 'active' : 'inactive'} at Danger ${currentValue}`}`} style={styles.traumaRow}>
            <Gradient colour={p.trauma} band inactive={inactive} />
            <Text style={styles.range}>{row.range}</Text>
            <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.traumaSymbol}><PatternSymbol name={row.type} size={p.traumaSize} inactive={inactive} /></View>
          </View>;
        }) : kratosRows(table).map(row => {
          const active = currentValue === undefined ? undefined : kratosRowActive(row, currentValue), inactive = active === false;
          const badge = [styles.rage, active && styles.activeRage, inactive && styles.inactiveBadge], number = [styles.rageNumber, active && styles.activeRageNumber];
          return <View key={row.rage} testID={`pattern-row-Kratos-${row.rage}`} accessible accessibilityLabel={`${kratosRowLabel(row)}${active === undefined ? '' : `; ${active ? 'active' : 'inactive'} at Rage ${currentValue}`}`} style={[styles.kratosRow, inactive && styles.inactiveRow]}>
            <View style={[styles.diamond, { pointerEvents: 'none' }]}><Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><Polygon points="50,0 100,50 50,100 0,50" fill={p.white} /></Svg></View>
            <View style={badge}><Text style={number}>{row.rage}</Text></View>
            <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.options, row.options.length === 1 && styles.singleOption]}>
              {row.options.map((option, index) => <View key={index} style={[styles.option, inactive && styles.inactiveBadge]}>
                {option.map((effect, effectIndex) => <View key={effectIndex} style={styles.term}>
                  {effectIndex > 0 && <Text style={styles.plus}>+</Text>}<Effect effect={effect} inactive={inactive} />
                </View>)}
              </View>)}
            </View>
            <View style={badge}><Text style={number}>{row.rage}</Text></View>
          </View>;
        })}
      </View>
      <View style={[styles.base, { backgroundColor: colour }]} />
    </View>
    {kind === 'Kratos' ? <Text style={styles.caption}>Choose one option in a row. + combines effects.</Text> : <View style={styles.legend}>
      {['Minor', 'Major', 'Grave', 'Obol'].map(type => <View key={type} style={styles.legendItem}>
        <PatternSymbol name={type} size={22} /><Text style={styles.legendText}>{effectLabel({ name: type })}</Text>
      </View>)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12, width: '100%', maxWidth: 340, alignSelf: 'center' },
  card: { backgroundColor: p.papyrus, borderRadius: 9, overflow: 'hidden', borderWidth: 1, borderColor: p.papyrusDark },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6, minHeight: 48 },
  medallion: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: p.papyrusDark }, headerBalance: { width: 30 },
  title: { flex: 1, fontSize: 19, textAlign: 'center', paddingVertical: 6 },
  table: { paddingVertical: p.verticalInset, gap: p.rowGap }, base: { height: 8 },
  traumaRow: { marginHorizontal: p.horizontalInset, minHeight: 40, paddingHorizontal: 8, paddingVertical: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  range: { flexShrink: 1, color: p.papyrus, fontSize: 16, fontWeight: '700' }, traumaSymbol: { width: 40, alignItems: 'center' },
  kratosRow: { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34 },
  diamond: { position: 'absolute', left: '15%', top: '15%', width: '70%', height: '70%' },
  rage: { minWidth: p.rageDiameter, minHeight: p.rageDiameter, borderRadius: 99, paddingHorizontal: 4, paddingVertical: 3, backgroundColor: p.kratos, alignItems: 'center', justifyContent: 'center' },
  rageNumber: { fontSize: 13, color: p.white, fontWeight: '600' },
  activeRage: { backgroundColor: p.white, borderWidth: 1, borderColor: MODIFIED_STAT_COLOUR }, activeRageNumber: { color: MODIFIED_STAT_COLOUR, fontWeight: '700' },
  inactiveRow: { opacity: 0.55 }, inactiveBadge: { backgroundColor: '#6B6963' },
  options: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 }, singleOption: { justifyContent: 'center' },
  option: { flexShrink: 1, minWidth: 32, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 3, gap: 4, minHeight: 28, backgroundColor: p.kratos, borderRadius: p.optionRadius },
  term: { flexDirection: 'row', alignItems: 'center', gap: 4 }, effect: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  quantity: { color: p.white, fontSize: 16 }, plus: { color: p.white, fontSize: 16 }, symbolFallback: { color: p.white, fontSize: 13, flexShrink: 1 },
  caption: { textAlign: 'center', color: theme.muted, fontSize: 12, lineHeight: 18 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, legendText: { color: theme.muted, fontSize: 12 },
  empty: { textAlign: 'center', color: theme.ink, padding: 20 },
});
