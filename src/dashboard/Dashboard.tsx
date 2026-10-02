import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { Counter } from '../components/Counter';
import { Chevron, Emblem, GameIcon } from '../components/Icon';
import { SwipeGuard, SwipeSurface } from '../components/SwipeSurface';
import { SKILL_NAMES } from '../domain/party';
import type { Argonaut } from '../domain/party';
import { adjacentArgonautId } from '../state/party-reducer';
import type { CounterName } from '../state/party-reducer';
import { useParty } from '../state/PartyProvider';
import { textOnColour, theme } from '../theme/tokens';
import { ColourPicker } from './ColourPicker';
import { DashboardMenu } from './DashboardMenu';
import { EquipmentArea, SectionHeading, SlotRow } from './EquipmentArea';
import { dashboardPositions } from './model';
import { OverflowDialog } from './OverflowDialog';
import { ReferenceDialog } from './ReferenceDialog';
import { TitanPicker } from './TitanPicker';

export function Dashboard({ argonaut, onSelect }: { argonaut: Argonaut; onSelect: (id: string) => void }) {
  const { party, dispatch } = useParty(), { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const width = Math.min(windowWidth, containerWidth ?? windowWidth);
  const measureContainer = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) setContainerWidth(nextWidth);
  }, []);
  // Give the three equipment columns enough room before putting references beside them.
  const narrow = width < 1150, small = width < 600;
  const identityStacked = width < 1040, verySmall = width < 360;
  const [colourOpen, setColourOpen] = useState(false), [titanOpen, setTitanOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [overflow, setOverflow] = useState<CounterName | null>(null), [reference, setReference] = useState<'Trauma' | 'Kratos' | null>(null);
  const index = party.order.indexOf(argonaut.id);
  const positions = useMemo(() => dashboardPositions(argonaut, getCatalogue()), [argonaut]);
  const titan = argonaut.titan && getCatalogue().getFace(argonaut.titan.definitionId, argonaut.titan.faceId);
  const navigate = useCallback((direction: -1 | 1) => {
    const id = adjacentArgonautId(party.order, argonaut.id, direction);
    if (id) onSelect(id);
  }, [party.order, argonaut.id, onSelect]);
  const counterChange = (counter: CounterName, delta: -1 | 1) => {
    const value = argonaut.counters[counter] + delta;
    if (value > 9 && delta > 0) setOverflow(counter);
    else dispatch({ type: 'counter', argonautId: argonaut.id, counter, value });
  };

  const triskelion = (
    <View testID="triskelion-section"><SectionHeading title="Triskelion" note="Current values" />
      <View style={styles.triskelion}><View style={styles.counters}>{(['rage', 'fate', 'danger'] as const).map(counter =>
        <Counter key={counter} large inline icon={<GameIcon name={counter === 'rage' ? 'Rage' : counter === 'fate' ? 'Fate' : 'Danger'} size={22} />}
          name={counter[0].toUpperCase() + counter.slice(1)} value={argonaut.counters[counter]}
          onDecrease={() => counterChange(counter, -1)} onIncrease={() => counterChange(counter, 1)} />
      )}</View>
      <View style={styles.referenceLinks}>{(['Trauma', 'Kratos'] as const).map(kind => <View key={kind} style={{ flex: 1 }}>
        <Button quiet label={`${kind} table`} disabled={!titan} onPress={() => setReference(kind)} style={styles.referenceButton}>
          <Text style={styles.referenceLabel}>{kind} table</Text><Chevron />
        </Button>
      </View>)}</View>{!titan && <Text style={styles.referenceHint}>Choose a Titan to view its reference tables.</Text>}
      </View>
    </View>
  );

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} onLayout={measureContainer}>
    <SwipeSurface onNavigate={navigate}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.masthead}><View style={[styles.mastheadContent, small && styles.mobilePadding]}>
          <View style={styles.brand}><Emblem /><View><Text style={styles.brandTitle}>AEON TRESPASS</Text><Text style={styles.brandSub}>O D Y S S E Y</Text></View></View>
          <View style={styles.mastheadActions}>
            {!small && <Text style={styles.mastheadLabel}>THE ARGONAUT JOURNAL</Text>}
            <Button quiet label="Open menu" onPress={() => setMenuOpen(true)} style={styles.menuButton}>
              <View style={styles.menuIcon}><View style={styles.menuLine} /><View style={styles.menuLine} /><View style={styles.menuLine} /></View>
            </Button>
          </View>
        </View></View>

        <View style={[styles.content, small && styles.mobilePadding]}>
          <View style={styles.chapter}><Text style={styles.eyebrow}>YOUR EXPEDITION</Text><Text style={styles.chapterMeta}>Four Argonauts. One odyssey.</Text></View>
          <View style={styles.navigation}>
            <View style={styles.tabs}>{party.order.map((id, tabIndex) => {
              const member = party.argonauts.find(entry => entry.id === id)!;
              return <View key={id} style={{ flex: 1 }}><SwipeGuard><Pressable accessibilityRole="tab"
                accessibilityLabel={`Argonaut ${tabIndex + 1}: ${member.name || `Argonaut ${tabIndex + 1}`}`} accessibilityState={{ selected: id === argonaut.id }}
                onPress={() => onSelect(id)} style={({ pressed }) => [styles.tab, small && styles.smallTab, id === argonaut.id && styles.selectedTab, pressed && { opacity: 0.65 }]}>
                <View style={[styles.tabBadge, { backgroundColor: member.colour }]}><Text style={[styles.tabNumber, { color: textOnColour(member.colour) }]}>{tabIndex + 1}</Text></View>
                {!small && <Text numberOfLines={1} style={[styles.tabLabel, id === argonaut.id && styles.selectedLabel]}>{member.name || `Argonaut ${tabIndex + 1}`}</Text>}
              </Pressable></SwipeGuard></View>;
            })}</View>
          </View>

          <View style={[styles.identity, identityStacked && styles.identityNarrow]}>
            <View style={[styles.identityName, identityStacked && styles.identityNameNarrow]}>
              <Text style={styles.eyebrow}>ARGONAUT {index + 1}</Text>
              <SwipeGuard><TextInput accessibilityLabel="Argonaut name" placeholder={`Argonaut ${index + 1}`} maxLength={60} selectTextOnFocus
                value={argonaut.name} onChangeText={name => dispatch({ type: 'name', argonautId: argonaut.id, name })} style={styles.nameInput} /></SwipeGuard>
              <View style={styles.identityActions}><Button quiet label="Choose Argonaut colour" onPress={() => setColourOpen(true)} style={styles.colourButton}>
                <View style={[styles.colourDot, { backgroundColor: argonaut.colour }]} /><Text style={styles.colourLabel}>Identity colour</Text><Chevron direction="down" />
              </Button></View>
            </View>
            <View style={[styles.skills, identityStacked && styles.skillsStacked, small && styles.skillsSmall]}>{SKILL_NAMES.map(skill => <View key={skill} style={[styles.skillCell, small && styles.skillCellSmall, verySmall && styles.skillCellTiny]}>
              <Counter name={skill} value={argonaut.skills[skill]} onDecrease={() => dispatch({ type: 'skill', argonautId: argonaut.id, skill, delta: -1 })}
                onIncrease={() => dispatch({ type: 'skill', argonautId: argonaut.id, skill, delta: 1 })} />
            </View>)}</View>
          </View>
          <View style={[styles.titanBar, small && styles.titanBarSmall]}>
            <View style={styles.titanChoice}><Text style={styles.eyebrow}>TITAN</Text><Button quiet label="Choose Titan" onPress={() => setTitanOpen(true)} style={styles.titanButton}>
              <GameIcon name="Titan" size={20} /><Text style={styles.titanName}>{titan?.name || 'Choose a Titan'}</Text><Chevron direction="down" />
            </Button>{titan && <Text style={styles.titanMeta}>{titan.cycle}{titan.kind === 'titan' ? ` · Speed ${titan.data.speed}` : ''}</Text>}</View>
            <View style={[styles.paging, small && styles.pagingSmall]}>
              <Button quiet label="Previous Argonaut" disabled={index === 0} onPress={() => navigate(-1)} style={styles.arrow}><Chevron direction="left" /></Button>
              <Text accessibilityLiveRegion="polite" accessibilityLabel={`${argonaut.name || 'Argonaut'}, ${index + 1} of 4`} style={styles.pageNumber}>{index + 1} of 4</Text>
              <Button quiet label="Next Argonaut" disabled={index === party.order.length - 1} onPress={() => navigate(1)} style={styles.arrow}><Chevron /></Button>
            </View>
          </View>
        </View>

        <View testID="argonaut-colour-separator" accessibilityLabel={`Argonaut colour ${argonaut.colour}`} style={[styles.separator, { backgroundColor: argonaut.colour }]} />

        <View testID="dashboard-board" style={[styles.board, small && styles.mobilePadding, narrow && styles.boardNarrow]}>
          {narrow && triskelion}
          <View style={[styles.equipmentColumn, narrow && styles.fullColumn]}><EquipmentArea positions={positions} argonaut={argonaut} /></View>
          <View style={[styles.referenceColumn, narrow && styles.fullColumn]}>
            {!narrow && triskelion}
            <View><SectionHeading title="Memories" /><View style={styles.memoryRows}>
              {positions.filter(position => position.kind === 'mnemos').map((position, memoryIndex) => <SlotRow key={position.id} kinds={['mnemos']} positions={[position]} argonaut={argonaut} compact startIndex={memoryIndex} />)}
              <SlotRow kinds={['fated-mnemos']} positions={positions} argonaut={argonaut} compact />
            </View></View>
            <View style={styles.trackers}><View style={styles.tracker}><Text style={styles.trackerTitle}>Tokens</Text>
              <Text style={styles.trackerBody}>{Object.entries(argonaut.tokens).map(([name, count]) => `${name} ${count}`).join(' · ') || 'No tokens'}</Text></View>
              <View style={styles.tracker}><Text style={styles.trackerTitle}>Conditions</Text><Text style={styles.trackerBody}>{argonaut.localConditions.join(' · ') || 'No conditions'}</Text></View>
            </View>
          </View>
        </View>
        <View style={[styles.footer, small && styles.mobilePadding]}><Text style={styles.footerText}>AEON TRESPASS · ODYSSEY</Text><Text numberOfLines={1} style={[styles.footerText, { flex: 1, textAlign: 'right' }]}>{argonaut.name || `Argonaut ${index + 1}`} · {index + 1} / 4</Text></View>
      </ScrollView>
    </SwipeSurface>
    <DashboardMenu visible={menuOpen} compact={small} onClose={() => setMenuOpen(false)} onBrowseGear={() => {
      setMenuOpen(false); router.push('/gear');
    }} />
    {colourOpen && <ColourPicker colour={argonaut.colour} onClose={() => setColourOpen(false)} onSelect={colour => {
      dispatch({ type: 'colour', argonautId: argonaut.id, colour }); setColourOpen(false);
    }} />}
    {titanOpen && <TitanPicker selectedId={argonaut.titan?.definitionId} onClose={() => setTitanOpen(false)} onSelect={definition => {
      dispatch({ type: 'titan', argonautId: argonaut.id, titan: definition ? { id: `${argonaut.id}:titan`, definitionId: definition.id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {} } : null }); setTitanOpen(false);
    }} />}
    {overflow && <OverflowDialog name={overflow[0].toUpperCase() + overflow.slice(1)} value={argonaut.counters[overflow]} onClose={() => setOverflow(null)} onConfirm={value => {
      dispatch({ type: 'counter', argonautId: argonaut.id, counter: overflow, value, confirmOverflow: true }); setOverflow(null);
    }} />}
    {reference && titan && <ReferenceDialog kind={reference} titan={titan} onClose={() => setReference(null)} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, minWidth: 0, backgroundColor: theme.canvas }, scroll: { paddingBottom: 20 },
  masthead: { backgroundColor: theme.charcoal }, mastheadContent: { width: '100%', paddingHorizontal: 32, minHeight: 86, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 14 }, brandTitle: { color: '#F1EBDE', fontFamily: theme.serif, fontSize: 17, letterSpacing: 2.4 }, brandSub: { color: theme.gold, fontSize: 9, marginTop: 5 }, mastheadLabel: { color: '#B8B3A8', fontSize: 9, letterSpacing: 1.6 },
  mastheadActions: { flexDirection: 'row', alignItems: 'center', gap: 16 }, menuButton: { width: 44, padding: 0, borderColor: '#706D65' },
  menuIcon: { gap: 4 }, menuLine: { width: 20, height: 2, backgroundColor: '#F1EBDE', borderRadius: 1 },
  content: { width: '100%', paddingHorizontal: 32 },
  chapter: { marginTop: 26, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: theme.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 }, chapterMeta: { color: theme.muted, fontSize: 11 },
  navigation: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  tabs: { flex: 1, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.line },
  tab: { minHeight: 60, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  selectedTab: { borderBottomColor: theme.ink }, tabBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, tabNumber: { color: theme.white, fontSize: 11, fontWeight: '600' }, tabLabel: { flex: 1, color: theme.muted, fontSize: 13 }, selectedLabel: { color: theme.ink, fontWeight: '600' },
  smallTab: { paddingHorizontal: 0, justifyContent: 'center' },
  paging: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }, pagingSmall: { alignSelf: 'flex-end' }, arrow: { paddingHorizontal: 0, backgroundColor: theme.paper }, pageNumber: { fontSize: 12, color: theme.muted, minWidth: 35, textAlign: 'center' },
  identity: { flexDirection: 'row', gap: 32, alignItems: 'center' }, identityNarrow: { flexDirection: 'column', alignItems: 'stretch', gap: 24 },
  identityName: { width: 255 }, identityNameNarrow: { width: '100%' }, nameInput: { fontFamily: theme.serif, color: theme.ink, fontSize: 32, minHeight: 52, paddingVertical: 4, marginTop: 8, borderBottomWidth: 1, borderBottomColor: theme.line },
  identityActions: { alignItems: 'flex-start', marginTop: 12 }, colourButton: { flexDirection: 'row', gap: 9, borderWidth: 0, paddingHorizontal: 0, minHeight: 44 }, colourDot: { width: 14, height: 14, borderRadius: 7 }, colourLabel: { color: theme.muted, fontSize: 12 },
  skills: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, flexDirection: 'row', gap: 8 },
  skillsStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' }, skillsSmall: { flexWrap: 'wrap' }, skillCell: { flex: 1 }, skillCellSmall: { flex: 0, flexGrow: 1, flexBasis: '30%' },
  skillCellTiny: { flexBasis: '45%' },
  titanBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 22, marginBottom: 26 }, titanBarSmall: { flexDirection: 'column', alignItems: 'flex-start' },
  titanChoice: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 }, titanButton: { flexDirection: 'row', gap: 12, backgroundColor: theme.paper, paddingHorizontal: 14 }, titanName: { color: theme.ink, fontSize: 13 }, titanMeta: { color: theme.muted, fontSize: 11 },
  separator: { height: 4, width: '100%' },
  board: { width: '100%', paddingHorizontal: 32, paddingTop: 26, flexDirection: 'row', gap: 32 }, boardNarrow: { flexDirection: 'column', gap: 32 },
  equipmentColumn: { flexGrow: 1.6, flexShrink: 1, flexBasis: 0, minWidth: 0 }, referenceColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 24 },
  fullColumn: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  triskelion: { backgroundColor: theme.paper, borderRadius: 6, borderWidth: 1, borderColor: theme.line, padding: 12 }, counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  referenceLinks: { flexDirection: 'row', gap: 8, marginTop: 8 }, referenceButton: { backgroundColor: theme.panel, borderWidth: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, gap: 6 }, referenceLabel: { fontSize: 12, color: theme.ink }, referenceHint: { fontSize: 10, color: theme.muted, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  memoryRows: { gap: 12 }, trackers: { flexDirection: 'row', gap: 12 }, tracker: { flex: 1, borderWidth: 1, borderColor: theme.line, borderRadius: 6, padding: 16, minHeight: 94, backgroundColor: theme.paper }, trackerTitle: { color: theme.ink, fontFamily: theme.serif, fontSize: 18 }, trackerBody: { color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  footer: { width: '100%', paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 30, paddingBottom: 18, gap: 16 }, footerText: { color: theme.muted, fontSize: 9, letterSpacing: 1.3 },
  mobilePadding: { paddingHorizontal: 16 },
});
