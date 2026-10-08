import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { CardIcon } from '../components/cards/CardIcon';
import { MenuIcon } from '../components/Icon';
import { MILESTONE_TRACKS, SHIP_TRACKS, VOYAGE_TRACKS, argoTrack } from '../domain/argo';
import type { ArgoTrackDefinition, ArgoRecordId } from '../domain/argo';
import { campaignCycle } from '../domain/campaign';
import type { KnownCardFamily } from '../domain/cards';
import { argoAbilityLimit } from '../domain/technologies';
import { currentInwardOdyssey } from '../domain/inward-odyssey';
import { SharedResources } from '../dashboard/SharedResources';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { CampaignPage, campaignStyles } from './CampaignPage';
import { GrowingNotes } from './GrowingNotes';
import { ArgoTitans } from './ArgoTitans';
import { ARGO_REFERENCES, ArgoReferences } from './ArgoReferences';
import { ArgoTrackEditor } from './ArgoTrackEditor';
import { ArgoMilestoneCard } from './ArgoMilestoneCard';

export function ArgoPage() {
  const { party } = useParty();
  return <ArgoBody key={`${party.id}:${campaignCycle(party)}`} />;
}
function ArgoBody() {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), cycle = campaignCycle(party);
  const [editing, setEditing] = useState<ArgoTrackDefinition | null>(null);
  const [reference, setReference] = useState<{ id: ArgoRecordId; family?: KnownCardFamily } | null>(null);
  const owner = { partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: cycle };
  const aaLimit = argoAbilityLimit(party, catalogue);
  const inward = currentInwardOdyssey(party, catalogue);
  const tile = (definition: ArgoTrackDefinition) => {
    const track = argoTrack(party, definition, catalogue), limit = track.limit, reached = limit !== null && limit !== undefined && track.value >= limit;
    if (definition.readOnly) return <View key={definition.id} style={[styles.tile, styles.abilityTile]}>
      <View style={styles.tileHeading}>{definition.icon && <CardIcon name={definition.icon} size={20} />}<Text style={styles.label}>Titans</Text></View>
      <Button quiet label="Manage Titans" onPress={() => setReference({ id: 'titans' })} style={styles.valueButton}><View style={styles.valueRow}><Text style={styles.value}>{track.value}</Text><Text style={styles.limit}>/ {limit}</Text></View></Button>
      <Button quiet label="View Titan limit technologies" onPress={() => router.push('/technology')} style={styles.browse}><Text style={styles.small}>Limit from technology ↗</Text></Button>
    </View>;
    return <View key={definition.id} style={[styles.tile, definition.milestone && styles.milestone, definition.cycles && styles.voyageTrack]}>
      <View style={styles.tileHeading}>{definition.icon && <CardIcon name={definition.icon} size={20} />}<Text style={styles.label}>{definition.name}{track.reference ? ` · ${track.reference}` : ''}</Text></View>
      <View style={styles.controls}>
        <Button quiet label={`Decrease ${definition.name}`} disabled={track.value <= (definition.signed ? Number.MIN_SAFE_INTEGER : 0)} onPress={() => dispatch({ type: 'argo-track', ...owner, id: definition.id, delta: -1 })} style={styles.step}><Text style={styles.symbol}>−</Text></Button>
        <View style={styles.valueCell}><Button quiet label={`Edit ${definition.name}`} onPress={() => setEditing(definition)} style={styles.valueButton}>
          <View style={styles.valueRow}><Text accessibilityLiveRegion="polite" style={[styles.value, reached && styles.reached, (track.value < 0 || limit != null && track.value > limit) && styles.negative, { fontSize: Math.max(12, Math.min(29, 72 / String(track.value).length)) }]}>{track.value}</Text>{limit !== undefined && limit !== null && <Text style={styles.limit}>/ {limit}</Text>}</View>
        </Button></View>
        <Button quiet label={`Increase ${definition.name}`} disabled={reached || track.value >= Number.MAX_SAFE_INTEGER} onPress={() => dispatch({ type: 'argo-track', ...owner, id: definition.id, delta: 1 })} style={styles.step}><Text style={styles.symbol}>+</Text></Button>
      </View>
      {limit !== undefined && limit !== null && <View style={styles.rail}><View style={[styles.fill, reached && styles.fullFill, { width: `${limit === 0 ? (track.value > 0 ? 100 : 0) : Math.max(0, Math.min(100, track.value / limit * 100))}%` }]} /></View>}
      {definition.id === 'inwards' && <View style={styles.inwardDetails}>
        <Text style={styles.small}>Every 2 Progress → +1 Argo Knowledge</Text>
        {inward.card && inward.face && <Button quiet label={`View Inward Odyssey card: ${inward.face.name}`} onPress={() => {
          router.push({ pathname: '/cards/[id]', params: { id: inward.card!.id, face: inward.face!.id } });
        }} style={styles.browse}><Text style={styles.inwardTitle}>{inward.face.name} ↗</Text></Button>}
        {inward.adventure ? <>
          <Text accessibilityLiveRegion="polite" style={styles.adventure}>{inward.adventure.knowledge}: {inward.adventure.title}</Text>
          <Text style={styles.small}>Read during the Story Step, after all other Story events.</Text>
        </> : <Text style={styles.small}>No adventure at this Knowledge value on the current cycle’s card.</Text>}
      </View>}
    </View>;
  };
  return <CampaignPage title="Argo">
    <View style={styles.section}>
      <View style={styles.sectionHeader}><View style={styles.headingRow}><MenuIcon name="Argo" size={24} colour={theme.gold} /><Text accessibilityRole="header" style={styles.heading}>Ship & company</Text></View><Text style={styles.caption}>Tap a total to edit · Titan and ability limits come from technology</Text></View>
      <View style={styles.grid}>{SHIP_TRACKS.map(tile)}
        <View style={[styles.tile, styles.abilityTile]}><View style={styles.tileHeading}><MenuIcon name="Technology" size={20} /><Text style={styles.label}>Argo Ability Limit</Text></View>
          <Button quiet label="View Argo Ability limit technologies" onPress={() => router.push('/technology')} style={styles.valueButton}><Text style={styles.value}>{aaLimit ?? '—'}</Text></Button>
          <Text style={styles.small}>From active technology ↗</Text>
        </View>
      </View>
      <View style={[styles.grid, styles.voyageRow]}>
        <View style={styles.voyageHeading}><Text accessibilityRole="header" style={styles.eyebrow}>CYCLE {cycle}</Text><Text style={styles.small}>Voyage tracks</Text></View>
        {VOYAGE_TRACKS.filter(track => track.cycles?.includes(cycle)).map(definition => <View key={definition.id} style={styles.voyageCell}>{tile(definition)}</View>)}
      </View>
    </View>
    <View style={styles.section}>
      <View style={styles.sectionHeader}><View style={styles.headingRow}><MenuIcon name="Timeline" size={23} colour={theme.gold} /><Text accessibilityRole="header" style={styles.heading}>Campaign progress</Text></View><Text style={styles.caption}>Select the current card · tap its title for details</Text></View>
      <View style={styles.grid}><ArgoMilestoneCard kind="story" /><ArgoMilestoneCard kind="doom" />{MILESTONE_TRACKS.filter(track => track.id === 'inwards').map(tile)}</View>
    </View>
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.heading}>Campaign references</Text><Text style={styles.caption}>Quick access to your expedition’s records</Text></View>
      <View style={styles.shortcuts}>{ARGO_REFERENCES.map(entry => <View key={entry.id} style={styles.shortcutCell}>
        <Button quiet label={entry.name} onPress={() => entry.id === 'adventures' ? router.push('/adventures') : setReference({ id: entry.id })} style={styles.shortcut}>
          <MenuIcon name={entry.icon} size={28} colour="#32565A" /><Text style={styles.shortcutName}>{entry.name}</Text>
          <Text style={styles.shortcutMeta}>{entry.id === 'adventures' ? 'Stories & progress' : entry.id === 'titans' ? 'Manage Titans' : entry.id === 'diplomacy' ? `Cycle ${cycle} factions` : entry.id === 'evolution' ? 'Evolution & battle tracks' : party.argo?.records[entry.id]?.trim() ? 'View records' : entry.families ? 'Records & cards' : 'Add records'}</Text>
        </Button>
      </View>)}</View>
    </View>
    <SharedResources owner={party.activeArgonautId} />
    <View style={{ gap: 10 }}><Text accessibilityRole="header" style={campaignStyles.heading}>Campaign notes</Text>
      <GrowingNotes label="Campaign notes" value={party.campaignNotes ?? ''} onChange={text => dispatch({ type: 'campaign-notes', partyId: party.id, argonautId: party.activeArgonautId, text })} />
    </View>
    {editing && <ArgoTrackEditor definition={editing} track={argoTrack(party, editing, catalogue)} onClose={() => setEditing(null)} onSave={(value, limit, cardReference) => {
      dispatch({ type: 'argo-track-edit', ...owner, id: editing.id, value, limit, reference: cardReference }); setEditing(null);
    }} />}
    {reference?.id === 'titans' ? <ArgoTitans onClose={() => setReference(null)} /> : reference && <ArgoReferences key={`${reference.id}:${reference.family ?? ''}`} id={reference.id} initialFamily={reference.family} onClose={() => setReference(null)} />}
  </CampaignPage>;
}
const styles = StyleSheet.create({
  section: { backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 6, overflow: 'hidden' },
  sectionHeader: { backgroundColor: '#263C3F', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, heading: { color: theme.paper, fontFamily: theme.serif, fontSize: 20 }, caption: { color: '#D5DBD8', fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 },
  tile: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 132, backgroundColor: '#F0EEE7', borderRadius: 5, borderWidth: 1, borderColor: '#DEDACF', padding: 8, gap: 4 },
  tileHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 24 }, label: { color: theme.ink, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', width: '100%', maxWidth: 190 }, step: { width: 44, padding: 0, borderWidth: 0 }, symbol: { fontSize: 24, color: theme.muted },
  valueCell: { flex: 1, minWidth: 44 }, valueButton: { minWidth: 44, minHeight: 44, borderWidth: 0, paddingHorizontal: 4, paddingVertical: 0 }, valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', gap: 5, maxWidth: '100%' },
  value: { color: theme.ink, fontFamily: theme.serif, fontSize: 29, fontVariant: ['tabular-nums'], flexShrink: 1 }, limit: { fontSize: 14, color: theme.muted }, reached: { color: '#32565A' }, negative: { color: theme.danger },
  rail: { height: 3, backgroundColor: '#DEDACF', overflow: 'hidden', borderRadius: 2, marginTop: 4 }, fill: { height: 3, backgroundColor: theme.gold }, fullFill: { backgroundColor: '#32565A' },
  abilityTile: { alignItems: 'center', justifyContent: 'center' }, small: { color: theme.muted, fontSize: 10, textAlign: 'center' },
  voyageRow: { borderTopWidth: 1, borderTopColor: theme.line }, voyageHeading: { justifyContent: 'center', alignItems: 'flex-start', gap: 5, flexBasis: 100 }, voyageCell: { flexGrow: 1, flexBasis: 140, minWidth: 132, maxWidth: 260 },
  voyageTrack: { flexBasis: 'auto', flexGrow: 0 },
  eyebrow: { color: theme.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  milestone: { flexBasis: 255, backgroundColor: theme.paper }, browse: { minHeight: 44, borderWidth: 0, padding: 4 }, browseText: { color: '#32565A', fontSize: 12 },
  inwardDetails: { gap: 6, paddingTop: 8 }, inwardTitle: { color: '#32565A', fontFamily: theme.serif, fontSize: 17, textAlign: 'center' },
  adventure: { color: theme.ink, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 }, shortcutCell: { flexGrow: 1, flexBasis: '18%', minWidth: 128 },
  shortcut: { backgroundColor: '#F0EEE7', gap: 8, borderColor: '#DEDACF', minHeight: 110, paddingHorizontal: 8 }, shortcutName: { fontSize: 13, color: theme.ink, textAlign: 'center', fontWeight: '600' }, shortcutMeta: { color: theme.muted, fontSize: 10 },
});
