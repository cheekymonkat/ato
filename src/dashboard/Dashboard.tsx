import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogue } from '../catalogue';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { Button } from '../components/Button';
import { Counter } from '../components/Counter';
import { Chevron, Emblem, GameIcon } from '../components/Icon';
import { SwipeGuard, SwipeSurface } from '../components/SwipeSurface';
import { SKILL_NAMES } from '../domain/party';
import { argonautSkills, SKILL_MAX, SKILL_MIN } from '../domain/argonaut-stats';
import { canDiscardCard, canExhaustCard } from '../domain/ability-costs';
import { campaignCycle } from '../domain/campaign';
import type { Argonaut } from '../domain/party';
import { adjacentArgonautId } from '../state/party-reducer';
import type { CounterName } from '../state/party-reducer';
import { useParty } from '../state/PartyProvider';
import { SaveNotice } from '../storage/SaveNotice';
import { useSpoilers } from '../state/SpoilerProvider';
import { MemoryArea } from '../memories/MemoryArea';
import { textOnColour, theme } from '../theme/tokens';
import { ArgonautName } from './ArgonautName';
import { ColourPicker } from './ColourPicker';
import { TidesOfFateDialog } from './TidesOfFateDialog';
import { DashboardMenu } from './DashboardMenu';
import { EquipmentArea, SectionHeading } from './EquipmentArea';
import { dashboardPositions } from './model';
import { OverflowDialog } from './OverflowDialog';
import { ReferenceDialog } from './ReferenceDialog';
import { TitanPicker } from './TitanPicker';
import { TokenArea } from './TokenArea';
import { ConditionArea } from './ConditionArea';
import { SharedResources } from './SharedResources';

export function Dashboard({ argonaut, onSelect }: { argonaut: Argonaut; onSelect: (id: string) => void }) {
  const { party, profile, dispatch } = useParty(), { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const width = Math.min(windowWidth, containerWidth ?? windowWidth);
  const measureContainer = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) setContainerWidth(nextWidth);
  }, []);
  // Give the three equipment columns enough room before putting references beside them.
  const narrow = width < 1150, small = width < 600;
  const identityStacked = width < 1040, statsStacked = width < 780;
  const [colourOpen, setColourOpen] = useState(false), [titanOpen, setTitanOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearing, setClearing] = useState<{ partyId: string; argonautId: string; campaignName: string } | null>(null);
  const [overflow, setOverflow] = useState<CounterName | null>(null), [reference, setReference] = useState<'Trauma' | 'Kratos' | null>(null);
  const index = party.order.indexOf(argonaut.id);
  const positions = useMemo(() => dashboardPositions(argonaut, getCatalogue()), [argonaut]);
  const skills = useMemo(() => argonautSkills(argonaut, getCatalogue()), [argonaut]);
  const titan = argonaut.titan && getCatalogue().getFace(argonaut.titan.definitionId, argonaut.titan.faceId);
  const titanCard = argonaut.titan && getCatalogue().get(argonaut.titan.definitionId), spoilers = useSpoilers();
  const hiddenTitan = titanCard && spoilers.hidden(titanCard);
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
    <View testID="triskelion-section" style={[styles.triskelionArea, statsStacked && styles.triskelionStacked]}>
      <SectionHeading title="Triskelion" note={`Current Cycle: ${campaignCycle(party)}`} />
      <View style={styles.triskelion}><View style={styles.counters}>{(['rage', 'fate'] as const).map(counter =>
        <Counter key={counter} large compact icon={<GameIcon name={counter === 'rage' ? 'Rage' : 'Fate'} size={22} />}
          name={counter[0].toUpperCase() + counter.slice(1)} value={argonaut.counters[counter]}
          onDecrease={() => counterChange(counter, -1)} onIncrease={() => counterChange(counter, 1)} />
      )}</View>
      <View style={styles.dangerRow}><View style={styles.dangerCell}>
        <Counter large compact icon={<GameIcon name="Danger" size={22} />} name="Danger" value={argonaut.counters.danger}
          onDecrease={() => counterChange('danger', -1)} onIncrease={() => counterChange('danger', 1)} />
      </View></View>
      </View>
    </View>
  );
  const referenceLinks = <View style={styles.referenceLinks}>{(['Trauma', 'Kratos'] as const).map(kind =>
    <Button key={kind} quiet label={`${kind} table`} onPress={() => setReference(kind)} style={styles.referenceButton}>
      <Text style={styles.referenceLabel}>{kind} table</Text><Chevron />
    </Button>
  )}</View>;

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
          <SaveNotice showStatus={false} />
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
              <ArgonautName key={argonaut.id} argonaut={argonaut} number={index + 1} />
              <View style={styles.identityActions}><Button quiet label="Choose Argonaut colour" onPress={() => setColourOpen(true)} style={styles.colourButton}>
                <View style={[styles.colourDot, { backgroundColor: argonaut.colour }]} /><Text style={styles.colourLabel}>Identity colour</Text><Chevron direction="down" />
              </Button></View>
            </View>
            <View style={[styles.identityStats, statsStacked && styles.identityStatsStacked, identityStacked && styles.identityStatsFull]}>
            <View testID="argonaut-skills" style={[styles.skills, statsStacked && styles.skillsStacked]}>{SKILL_NAMES.map(skill => <View key={skill} style={styles.skillCell}>
              <Counter compact dense name={skill} value={skills[skill]} min={SKILL_MIN} max={SKILL_MAX} onDecrease={() => dispatch({ type: 'skill', argonautId: argonaut.id, skill, delta: -1 })}
                onIncrease={() => dispatch({ type: 'skill', argonautId: argonaut.id, skill, delta: 1 })} />
            </View>)}</View>
            {triskelion}
            </View>
          </View>
          <View style={[styles.titanBar, small && styles.titanBarSmall]}>
            <View style={styles.titanChoice}><Text style={styles.eyebrow}>TITAN</Text><Button quiet label="Choose Titan" onPress={() => setTitanOpen(true)} style={styles.titanButton}>
              <GameIcon name="Titan" size={20} /><Text style={styles.titanName}>{hiddenTitan ? 'Unrevealed Titan' : titan?.name || (argonaut.titan ? 'Unavailable Titan' : 'Choose a Titan')}</Text><Chevron direction="down" />
            </Button>{titan && !hiddenTitan && <Text style={styles.titanMeta}>{titan.cycle}</Text>}</View>
            <View style={[styles.paging, small && styles.pagingSmall]}>
              <Button quiet label="Previous Argonaut" disabled={index === 0} onPress={() => navigate(-1)} style={styles.arrow}><Chevron direction="left" /></Button>
              <Text accessibilityLiveRegion="polite" accessibilityLabel={`${argonaut.name || 'Argonaut'}, ${index + 1} of 4`} style={styles.pageNumber}>{index + 1} of 4</Text>
              <Button quiet label="Next Argonaut" disabled={index === party.order.length - 1} onPress={() => navigate(1)} style={styles.arrow}><Chevron /></Button>
            </View>
          </View>
        </View>

        <View testID="argonaut-colour-separator" accessibilityLabel={`Argonaut colour ${argonaut.colour}`} style={[styles.separator, { backgroundColor: argonaut.colour }]} />

        <View testID="dashboard-board" style={[styles.board, small && styles.mobilePadding, narrow && styles.boardNarrow]}>
          <View style={[styles.equipmentColumn, narrow && styles.fullColumn]}><EquipmentArea positions={positions} argonaut={argonaut} /></View>
          <View style={[styles.referenceColumn, narrow && styles.fullColumn]}>
            <View style={{ gap: 12 }}><SectionHeading title="Titan abilities" />
              {(!titan || hiddenTitan) && referenceLinks}
              {titan && titanCard ? <SwipeGuard>{hiddenTitan ? <Pressable accessibilityRole="button" accessibilityLabel="Edit selected Titan" onPress={() => setTitanOpen(true)}>
                <ReferenceCard card={titanCard} face={titan} revealable={false} />
              </Pressable> : <ReferenceCard card={titanCard} face={titan} exhausted={Boolean(argonaut.titan?.exhausted || argonaut.titan?.discarded)} showTables={false} revealable={false}
                titanHeaderActions={referenceLinks} onSelectTitan={() => setTitanOpen(true)} />}</SwipeGuard>
                : <Text style={styles.referenceHint}>Choose a Titan to view its abilities, or set a Pattern override in a table.</Text>}
              {argonaut.titan?.discarded && <Text style={styles.referenceHint}>Discarded</Text>}
              {argonaut.titan && <SwipeGuard><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {!argonaut.titan.discarded && (argonaut.titan.exhausted || titan && !hiddenTitan && canExhaustCard(titan)) && <Button quiet label={argonaut.titan.exhausted ? 'Ready Titan' : 'Exhaust Titan'} onPress={() => dispatch({ type: 'titan-exhausted', argonautId: argonaut.id, exhausted: !argonaut.titan?.exhausted })} />}
                {(argonaut.titan.discarded || titan && !hiddenTitan && canDiscardCard(titan)) && <Button quiet label={argonaut.titan.discarded ? 'Restore Titan' : 'Discard Titan'} onPress={() => dispatch({ type: 'titan-discarded', argonautId: argonaut.id, instanceId: argonaut.titan!.id, discarded: !argonaut.titan?.discarded })} />}
              </View></SwipeGuard>}
            </View>
            <MemoryArea argonaut={argonaut} />
            <TokenArea argonaut={argonaut} />
            <ConditionArea argonaut={argonaut} />
            <SharedResources owner={argonaut.id} />
          </View>
        </View>
        <View style={[styles.footer, small && styles.mobilePadding]}><Text style={styles.footerText}>AEON TRESPASS · ODYSSEY</Text><Text numberOfLines={1} style={[styles.footerText, { flex: 1, textAlign: 'right' }]}>{argonaut.name || `Argonaut ${index + 1}`} · {index + 1} / 4</Text></View>
      </ScrollView>
    </SwipeSurface>
    <DashboardMenu visible={menuOpen} compact={small} onClose={() => setMenuOpen(false)} onBrowseGear={() => {
      setMenuOpen(false); router.push('/gear');
    }} onProfiles={() => { setMenuOpen(false); router.push('/profiles'); }} onClearAll={() => {
      setMenuOpen(false); setClearing({ partyId: party.id, argonautId: argonaut.id, campaignName: profile.name });
    }} />
    {clearing && <TidesOfFateDialog campaignName={clearing.campaignName} onClose={() => setClearing(null)} onConfirm={() => {
      dispatch({ type: 'clear-all', argonautId: clearing.argonautId, partyId: clearing.partyId, confirmed: true }); setClearing(null);
    }} />}
    {colourOpen && <ColourPicker colour={argonaut.colour} onClose={() => setColourOpen(false)} onSelect={colour => {
      dispatch({ type: 'colour', argonautId: argonaut.id, colour }); setColourOpen(false);
    }} />}
    {titanOpen && <TitanPicker selected={argonaut.titan} onClose={() => setTitanOpen(false)} onSelect={reference => {
      dispatch({ type: 'titan', argonautId: argonaut.id, titan: reference ? argonaut.titan?.definitionId === reference.definitionId
        ? { ...argonaut.titan, faceId: reference.faceId }
        : { id: `${argonaut.id}:titan`, ...reference, exhausted: false, enabledEffectIds: [], counters: {} } : null }); setTitanOpen(false);
    }} />}
    {overflow && <OverflowDialog name={overflow[0].toUpperCase() + overflow.slice(1)} value={argonaut.counters[overflow]} onClose={() => setOverflow(null)} onConfirm={value => {
      dispatch({ type: 'counter', argonautId: argonaut.id, counter: overflow, value, confirmOverflow: true }); setOverflow(null);
    }} />}
    {reference && <ReferenceDialog kind={reference} argonaut={argonaut} onClose={() => setReference(null)} />}
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
  identityName: { width: 255 }, identityNameNarrow: { width: '100%' },
  identityActions: { alignItems: 'flex-start', marginTop: 12 }, colourButton: { flexDirection: 'row', gap: 9, borderWidth: 0, paddingHorizontal: 0, minHeight: 44 }, colourDot: { width: 14, height: 14, borderRadius: 7 }, colourLabel: { color: theme.muted, fontSize: 12 },
  identityStats: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 24 },
  identityStatsFull: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' }, identityStatsStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 16 },
  skills: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillsStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' }, skillCell: { flexGrow: 1, flexShrink: 0, flexBasis: '30%', minWidth: 110 },
  titanBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 22, marginBottom: 26 }, titanBarSmall: { flexDirection: 'column', alignItems: 'flex-start' },
  titanChoice: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 }, titanButton: { flexDirection: 'row', gap: 12, backgroundColor: theme.paper, paddingHorizontal: 14 }, titanName: { color: theme.ink, fontSize: 13 }, titanMeta: { color: theme.muted, fontSize: 11 },
  separator: { height: 4, width: '100%' },
  board: { width: '100%', paddingHorizontal: 32, paddingTop: 26, flexDirection: 'row', gap: 32 }, boardNarrow: { flexDirection: 'column', gap: 32 },
  equipmentColumn: { flexGrow: 1.6, flexShrink: 1, flexBasis: 0, minWidth: 0 }, referenceColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 24 },
  fullColumn: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  triskelionArea: { flex: 0.8, minWidth: 288 }, triskelionStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  triskelion: { gap: 8 }, counters: { flexDirection: 'row', gap: 8 }, dangerRow: { flexDirection: 'row', justifyContent: 'center' }, dangerCell: { width: '50%', flexDirection: 'row', paddingHorizontal: 2 },
  referenceLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, referenceButton: { backgroundColor: theme.panel, flexDirection: 'row', paddingHorizontal: 8, gap: 6 }, referenceLabel: { fontSize: 12, color: theme.ink }, referenceHint: { fontSize: 10, color: theme.muted, textAlign: 'center', lineHeight: 16 },
  footer: { width: '100%', paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 30, paddingBottom: 18, gap: 16 }, footerText: { color: theme.muted, fontSize: 9, letterSpacing: 1.3 },
  mobilePadding: { paddingHorizontal: 16 },
});
