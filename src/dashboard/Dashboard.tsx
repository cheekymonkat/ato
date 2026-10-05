import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogue } from '../catalogue';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { GateAssistance } from '../components/cards/GateAssistance';
import { CombatStats } from '../components/cards/CombatStats';
import { Button } from '../components/Button';
import { Chevron, Emblem } from '../components/Icon';
import { SwipeGuard, SwipeSurface } from '../components/SwipeSurface';
import { canDiscardCard, canExhaustCard } from '../domain/ability-costs';
import type { Argonaut } from '../domain/party';
import { adjacentArgonautId } from '../state/party-reducer';
import type { CounterName } from '../state/party-reducer';
import { useParty } from '../state/PartyProvider';
import { SaveNotice } from '../storage/SaveNotice';
import { AssignedCardVisibility, useSpoilers } from '../state/SpoilerProvider';
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
import { SharedResources } from './SharedResources';
import { RulesAssistanceSheet } from './RulesAssistanceSheet';
import { ArgonautNotes } from './ArgonautNotes';
import { ArgonautOptions } from './ArgonautOptions';
import { StatsSwitcher } from './StatsSwitcher';
import { StatusBar } from './StatusBar';

export function Dashboard({ argonaut, onSelect }: { argonaut: Argonaut; onSelect: (id: string) => void }) {
  return <AssignedCardVisibility argonaut={argonaut}><DashboardBody argonaut={argonaut} onSelect={onSelect} /></AssignedCardVisibility>;
}
function DashboardBody({ argonaut, onSelect }: { argonaut: Argonaut; onSelect: (id: string) => void }) {
  const { party, profile, dispatch } = useParty(), { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const width = Math.min(windowWidth, containerWidth ?? windowWidth);
  const measureContainer = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) setContainerWidth(nextWidth);
  }, []);
  // Give the three equipment columns enough room before putting references beside them.
  const narrow = width < 1040, small = width < 600;
  const identityStacked = narrow ? width < 760 : width < 1300;
  const [colourOpen, setColourOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false), [optionsOpen, setOptionsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [clearing, setClearing] = useState<{ partyId: string; argonautId: string; campaignName: string } | null>(null);
  const [overflow, setOverflow] = useState<CounterName | null>(null), [reference, setReference] = useState<'Trauma' | 'Kratos' | null>(null);
  const index = party.order.indexOf(argonaut.id);
  const positions = useMemo(() => dashboardPositions(argonaut, getCatalogue()), [argonaut]);
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
          <View style={styles.chapter}><View style={styles.campaignHeading}><Text style={styles.eyebrow}>YOUR EXPEDITION</Text><SaveNotice showStatus={false} /></View>
            <Button quiet label="Argonaut Options" onPress={() => setOptionsOpen(true)} style={styles.optionsButton}>
              <View style={styles.optionsIcon}><View style={styles.optionsLine} /><View style={styles.optionsLine} /><View style={styles.optionsLine} /></View>
              <Text style={styles.optionsLabel}>Argonaut Options</Text>
            </Button>
          </View>
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

        </View>

        <CombatStats argonaut={argonaut}><GateAssistance enabled={party.rulesAssistance === true} argonaut={argonaut}>
        <View testID="dashboard-board" style={[styles.board, small && styles.mobilePadding, narrow && styles.boardNarrow]}>
          <View style={[styles.equipmentColumn, narrow && styles.fullColumn]}>
            <View style={[styles.identity, identityStacked && styles.identityNarrow]}>
              <View style={[styles.identityName, identityStacked && styles.identityNameNarrow]}>
                <Text style={styles.eyebrow}>ARGONAUT {index + 1}</Text>
                <ArgonautName key={argonaut.id} argonaut={argonaut} number={index + 1} large={!small} />
                <View style={styles.identityActions}><Button quiet label="Choose Argonaut colour" onPress={() => setColourOpen(true)} style={styles.colourButton}>
                  <View style={[styles.colourDot, { backgroundColor: argonaut.colour }]} /><Text style={styles.colourLabel}>Identity colour</Text><Chevron direction="down" />
                </Button></View>
              </View>
              <View style={[styles.identityStats, identityStacked && styles.identityStatsNarrow]}><StatsSwitcher argonaut={argonaut} onCounterChange={counterChange} /></View>
            </View>
            <StatusBar key={`status:${party.id}:${argonaut.id}`} argonaut={argonaut} />
            <View testID="argonaut-colour-separator" accessibilityLabel={`Argonaut colour ${argonaut.colour}`} style={[styles.separator, { backgroundColor: argonaut.colour }]} />
            <EquipmentArea positions={positions} argonaut={argonaut} headingAction={<Button quiet label="Refresh Gear"
              onPress={() => dispatch({ type: 'refresh-gear', argonautId: argonaut.id })} style={styles.refreshGear} />} />
            <ArgonautNotes key={`notes:${party.id}:${argonaut.id}`} argonaut={argonaut} />
          </View>
          <View style={[styles.referenceColumn, narrow && styles.fullColumn]}>
            <View style={{ gap: 12 }}><SectionHeading title="Titan abilities" />
              {(!titan || hiddenTitan) && referenceLinks}
              {titan && titanCard ? <ReferenceCard card={titanCard} face={titan} exhausted={Boolean(argonaut.titan?.exhausted || argonaut.titan?.discarded)} showTables={false} revealable={false}
                titanHeaderActions={referenceLinks} />
                : <Text style={styles.referenceHint}>Choose a Titan in Argonaut Options to view its abilities, or set a Pattern override in a table.</Text>}
              {argonaut.titan?.discarded && <Text style={styles.referenceHint}>Discarded</Text>}
              {argonaut.titan && <SwipeGuard><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {!argonaut.titan.discarded && (argonaut.titan.exhausted || titan && !hiddenTitan && canExhaustCard(titan)) && <Button quiet label={argonaut.titan.exhausted ? 'Ready Titan' : 'Exhaust Titan'} onPress={() => dispatch({ type: 'titan-exhausted', argonautId: argonaut.id, exhausted: !argonaut.titan?.exhausted })} />}
                {(argonaut.titan.discarded || titan && !hiddenTitan && canDiscardCard(titan)) && <Button quiet label={argonaut.titan.discarded ? 'Restore Titan' : 'Discard Titan'} onPress={() => dispatch({ type: 'titan-discarded', argonautId: argonaut.id, instanceId: argonaut.titan!.id, discarded: !argonaut.titan?.discarded })} />}
              </View></SwipeGuard>}
            </View>
            <MemoryArea argonaut={argonaut} />
            <SharedResources owner={argonaut.id} />
          </View>
        </View></GateAssistance></CombatStats>
        <View style={[styles.footer, small && styles.mobilePadding]}><Text style={styles.footerText}>AEON TRESPASS · ODYSSEY</Text><Text numberOfLines={1} style={[styles.footerText, { flex: 1, textAlign: 'right' }]}>{argonaut.name || `Argonaut ${index + 1}`} · {index + 1} / 4</Text></View>
      </ScrollView>
    </SwipeSurface>
    <DashboardMenu visible={menuOpen} compact={small} onClose={() => setMenuOpen(false)} onBrowseGear={() => {
      setMenuOpen(false); router.push('/gear');
    }} onProfiles={() => { setMenuOpen(false); router.push('/profiles'); }} onClearAll={() => {
      setMenuOpen(false); setClearing({ partyId: party.id, argonautId: argonaut.id, campaignName: profile.name });
    }} />
    {optionsOpen && <ArgonautOptions key={`${party.id}:${argonaut.id}`} argonaut={argonaut} onClose={() => setOptionsOpen(false)}
      onRules={() => { setOptionsOpen(false); setRulesOpen(true); }} />}
    {rulesOpen && <RulesAssistanceSheet argonaut={argonaut} onClose={() => setRulesOpen(false)} />}
    {clearing && <TidesOfFateDialog campaignName={clearing.campaignName} onClose={() => setClearing(null)} onConfirm={() => {
      dispatch({ type: 'clear-all', argonautId: clearing.argonautId, partyId: clearing.partyId, confirmed: true }); setClearing(null);
    }} />}
    {colourOpen && <ColourPicker colour={argonaut.colour} onClose={() => setColourOpen(false)} onSelect={colour => {
      dispatch({ type: 'colour', argonautId: argonaut.id, colour }); setColourOpen(false);
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
  eyebrow: { color: theme.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  navigation: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  tabs: { flex: 1, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.line },
  tab: { minHeight: 60, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  selectedTab: { borderBottomColor: theme.ink }, tabBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, tabNumber: { color: theme.white, fontSize: 11, fontWeight: '600' }, tabLabel: { flex: 1, color: theme.muted, fontSize: 13 }, selectedLabel: { color: theme.ink, fontWeight: '600' },
  smallTab: { paddingHorizontal: 0, justifyContent: 'center' },
  optionsButton: { flexDirection: 'row', gap: 10, backgroundColor: theme.paper, paddingHorizontal: 10, maxWidth: 180 },
  optionsIcon: { gap: 4 }, optionsLine: { width: 16, height: 1, backgroundColor: theme.ink }, optionsLabel: { color: theme.ink, fontSize: 12, flexShrink: 1 },
  campaignHeading: { flex: 1, gap: 8 }, refreshGear: { backgroundColor: theme.paper, paddingHorizontal: 10 },
  identity: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' }, identityNarrow: { flexDirection: 'column', alignItems: 'stretch', gap: 20 },
  identityName: { width: '34%', minWidth: 260, maxWidth: 460, flexShrink: 0, paddingTop: 10 },
  identityNameNarrow: { width: '100%', minWidth: 0, maxWidth: '100%' },
  identityActions: { alignItems: 'flex-start', marginTop: 12 }, colourButton: { flexDirection: 'row', gap: 9, borderWidth: 0, paddingHorizontal: 0, minHeight: 44 }, colourDot: { width: 14, height: 14, borderRadius: 3 }, colourLabel: { color: theme.muted, fontSize: 12 },
  identityStats: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignSelf: 'stretch' },
  identityStatsNarrow: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  separator: { height: 4, width: '100%', marginBottom: 16 },
  board: { width: '100%', paddingHorizontal: 32, flexDirection: 'row', gap: 24, alignItems: 'flex-start' }, boardNarrow: { flexDirection: 'column', gap: 32 },
  equipmentColumn: { flexGrow: 1.85, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 0 }, referenceColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 24 },
  fullColumn: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  referenceLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, referenceButton: { backgroundColor: theme.panel, flexDirection: 'row', paddingHorizontal: 8, gap: 6 }, referenceLabel: { fontSize: 12, color: theme.ink }, referenceHint: { fontSize: 10, color: theme.muted, textAlign: 'center', lineHeight: 16 },
  footer: { width: '100%', paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 30, paddingBottom: 18, gap: 16 }, footerText: { color: theme.muted, fontSize: 9, letterSpacing: 1.3 },
  mobilePadding: { paddingHorizontal: 16 },
});
