import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { Counter } from '../components/Counter';
import { GameIcon } from '../components/Icon';
import { argonautSkills, SKILL_MAX, SKILL_MIN } from '../domain/argonaut-stats';
import { MODIFIED_STAT_COLOUR } from '../domain/combat-modifiers';
import { kratosRageBonus } from '../domain/conditions';
import { SKILL_NAMES } from '../domain/party';
import type { Argonaut } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import type { CounterName } from '../state/party-reducer';
import { argonautColourBackground, theme } from '../theme/tokens';

export function StatsSwitcher({ argonaut, onCounterChange }: { argonaut: Argonaut; onCounterChange: (counter: CounterName, delta: -1 | 1) => void }) {
  const { dispatch } = useParty();
  const [view, setView] = useState<'triskelion' | 'argonaut'>('triskelion');
  const [width, setWidth] = useState(400);
  const skills = useMemo(() => argonautSkills(argonaut, getCatalogue()), [argonaut]);
  const rageBonus = kratosRageBonus(argonaut, getCatalogue());
  const rageSuffix = rageBonus ? <Text style={styles.rageBonus} accessibilityLabel="Roused: +1 Rage for Kratos abilities">(+{rageBonus})</Text> : undefined;
  const tight = width < 342, triskelion = view === 'triskelion';
  const singleTriskelionRow = width >= 430;
  const battleCounterStyle = { backgroundColor: argonautColourBackground(argonaut.colour) };
  const summary = triskelion ? SKILL_NAMES.map(name => ({ name, value: skills[name] }))
    : (['rage', 'fate', 'danger'] as const).map(name => ({ name: name[0].toUpperCase() + name.slice(1), value: argonaut.counters[name] }));
  return <View testID="dashboard-stats" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.panel, tight && styles.tallPanel, singleTriskelionRow && styles.shortPanel]}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>{triskelion ? 'Triskelion' : 'Argonaut stats'}</Text>
      <View accessibilityLabel="Choose stats view" style={styles.switch}>
        {(['triskelion', 'argonaut'] as const).map(choice => <Button key={choice} quiet label={choice === 'triskelion' ? 'Show Triskelion stats' : 'Show Argonaut stats'}
          selected={choice === view} onPress={() => setView(choice)} style={[styles.switchButton, choice === view && styles.selected]}>
          <Text style={[styles.switchLabel, choice === view && styles.selectedLabel]}>{choice === 'triskelion' ? 'Triskelion' : 'Argonaut'}</Text>
        </Button>)}
      </View>
    </View>
    <View testID="read-only-stats" accessibilityLabel={triskelion ? 'Argonaut skill values' : 'Triskelion values'} style={[styles.summary, singleTriskelionRow && !triskelion && styles.singleSummary]}>
      {summary.map(stat => <View key={stat.name} accessible accessibilityLabel={`${stat.name}: ${stat.value}`} style={styles.summaryCell}>
        <Text style={styles.summaryName}>{stat.name}{stat.name === 'Rage' && rageSuffix && <> {rageSuffix}</>}</Text><Text style={styles.summaryValue}>{stat.value}</Text>
      </View>)}
    </View>
    {triskelion ? <View testID="triskelion-section" style={styles.triskelion}>
      <View style={styles.triskelionRow}>{(singleTriskelionRow ? ['rage', 'fate', 'danger'] as const : ['rage', 'fate'] as const).map(counter => <Counter key={counter} large compact style={battleCounterStyle}
        icon={<GameIcon name={counter === 'rage' ? 'Rage' : counter === 'fate' ? 'Fate' : 'Danger'} size={22} />} name={counter[0].toUpperCase() + counter.slice(1)} nameSuffix={counter === 'rage' ? rageSuffix : undefined} value={argonaut.counters[counter]}
        onDecrease={() => onCounterChange(counter, -1)} onIncrease={() => onCounterChange(counter, 1)} />)}</View>
      {!singleTriskelionRow && <View style={styles.dangerRow}><View style={styles.dangerCell}><Counter large compact style={battleCounterStyle} icon={<GameIcon name="Danger" size={22} />} name="Danger" value={argonaut.counters.danger}
        onDecrease={() => onCounterChange('danger', -1)} onIncrease={() => onCounterChange('danger', 1)} /></View></View>}
    </View> : <View testID="argonaut-skills" style={styles.skills}>{SKILL_NAMES.map(skill => <View key={skill} style={[styles.skillCell, tight && styles.tightSkill]}>
      <Counter compact dense name={skill} value={skills[skill]} min={SKILL_MIN} max={SKILL_MAX}
        onDecrease={() => dispatch({ type: 'skill', argonautId: argonaut.id, skill, delta: -1 })}
        onIncrease={() => dispatch({ type: 'skill', argonautId: argonaut.id, skill, delta: 1 })} />
    </View>)}</View>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { height: 300, gap: 10, minWidth: 0 }, tallPanel: { height: 388 }, shortPanel: { height: 252 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, minHeight: 44 },
  title: { color: theme.ink, fontFamily: theme.serif, fontSize: 22 },
  switch: { flexDirection: 'row', borderWidth: 1, borderColor: theme.line, borderRadius: 5, overflow: 'hidden' },
  switchButton: { borderWidth: 0, borderRadius: 0, paddingHorizontal: 8, paddingVertical: 6 }, selected: { backgroundColor: theme.charcoal },
  switchLabel: { color: theme.ink, fontSize: 11 }, selectedLabel: { color: theme.white },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, minHeight: 54 },
  singleSummary: { minHeight: 25 },
  summaryCell: { flexGrow: 1, flexBasis: '31%', minWidth: 0, height: 25, paddingHorizontal: 6, borderWidth: 1, borderColor: theme.line, borderRadius: 4,
    backgroundColor: theme.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  summaryName: { color: theme.ink, fontSize: 12, fontWeight: '500', flexShrink: 1 }, summaryValue: { color: theme.ink, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rageBonus: { color: MODIFIED_STAT_COLOUR, fontWeight: '700' },
  triskelion: { gap: 8 }, triskelionRow: { flexDirection: 'row', gap: 8 }, dangerRow: { alignItems: 'center' }, dangerCell: { width: '50%', minWidth: 138, flexDirection: 'row' },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, skillCell: { flexBasis: '31%', flexGrow: 1, minWidth: 110 }, tightSkill: { flexBasis: '47%' },
});
