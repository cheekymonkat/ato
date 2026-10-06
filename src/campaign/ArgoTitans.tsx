import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { CardIcon } from '../components/cards/CardIcon';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { Sheet } from '../components/Sheet';
import { campaignCycle } from '../domain/campaign';
import type { TitanRecord, TitanStatus } from '../domain/party';
import { availableRosterTitans, legacyTitanRoster, livingTitanCount, rosterPatternName, rosterTitanName, rosterTitanType, rosterTypeIssue, sortRoster, titanCapacity, titanStatusLabel } from '../domain/titan-roster';
import { isDreamwalker } from '../domain/titan-selection';
import { useParty } from '../state/PartyProvider';
import type { PartyAction } from '../state/party-reducer';
import { titanArtwork } from '../theme/titan-art';
import { theme } from '../theme/tokens';
import { TitanRosterEditor } from './TitanRosterEditor';
import { TitanStatusMenu } from './TitanStatusMenu';
import { TitanStatusConfirmation } from './TitanStatusConfirmation';

/** Physical Titans, their health and their Patterns share one campaign roster. */
export function ArgoTitans({ onClose }: { onClose: () => void }) {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), cycle = campaignCycle(party);
  const [tab, setTab] = useState<TitanStatus>('alive'), [editing, setEditing] = useState<TitanRecord | 'new' | null>(null);
  const [removing, setRemoving] = useState<TitanRecord | null>(null);
  const [changing, setChanging] = useState<{ titan: TitanRecord; status: 'crippled' | 'dead'; action: Extract<PartyAction, { type: 'titan-roster' }> } | null>(null);
  const owner = { partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: cycle };
  useEffect(() => {
    if (!party.titanRoster) dispatch({ type: 'titan-roster', partyId: party.id, argonautId: party.activeArgonautId,
      expectedCycle: cycle, edit: { operation: 'initialize' } });
  }, [party.id, party.activeArgonautId, party.titanRoster, cycle, dispatch]);
  const titans = legacyTitanRoster(party, catalogue), occupied = livingTitanCount(titans), capacity = titanCapacity(party, catalogue);
  const statuses: TitanStatus[] = cycle === 1 ? ['alive', 'dead'] : ['alive', 'crippled', 'dead'];
  const shown = sortRoster(titans.filter(titan => titan.status === tab), catalogue);
  const bred = shown.filter(titan => !isDreamwalker(catalogue.getFace(titan.definitionId, titan.faceId)));
  const walkers = shown.filter(titan => isDreamwalker(catalogue.getFace(titan.definitionId, titan.faceId)));
  if (changing) return <TitanStatusConfirmation key={`${changing.titan.id}:${changing.status}`} name={rosterTitanName(changing.titan, catalogue)}
    status={changing.status} onCancel={() => setChanging(null)} onConfirm={() => { dispatch(changing.action); setChanging(null); }} />;
  if (editing) return <TitanRosterEditor key={editing === 'new' ? 'new' : editing.id} record={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />;
  if (removing) return <RemovalConfirmation title="Delete Titan" itemType="Titan" subject={rosterTitanName(removing, catalogue)}
    detail="This deletes this individual Titan and releases its Patterns. If selected by an Argonaut, it will be unassigned." onCancel={() => setRemoving(null)} onConfirm={() => {
      dispatch({ type: 'titan-roster', ...owner, edit: { operation: 'delete', id: removing.id, expected: removing, confirmed: true } }); setRemoving(null);
    }} />;
  const tiles = (records: TitanRecord[], title: string) => records.length > 0 && <View style={styles.group}>
    <Text accessibilityRole="header" style={styles.groupTitle}>{title} · {records.length}</Text>
    <View style={styles.grid}>{records.map((titan, index) => {
      const face = catalogue.getFace(titan.definitionId, titan.faceId), art = titanArtwork(face);
      const name = rosterTitanName(titan, catalogue), typeName = rosterTitanType(titan, catalogue), assigned = party.argonauts.find(member => member.titan?.rosterId === titan.id);
      return <View key={titan.id} style={styles.card}>
        <View style={[styles.cardHeader, tab === 'crippled' && styles.crippled, tab === 'dead' && styles.dead]}>
          {art && <Image source={art} resizeMode="cover" accessible={false} style={styles.art} />}
          <View style={styles.cardHeading}><Text style={styles.number}>TITAN {index + 1}</Text><Text style={styles.name}>{name}</Text>
            {name !== typeName && <Text style={styles.type}>{typeName}</Text>}
          </View>
          <TitanStatusMenu name={name} status={titan.status} statuses={statuses} full={occupied >= capacity}
            revivalIssue={titan.status === 'dead' ? rosterTypeIssue(party, titan.id, titan, catalogue) : undefined}
            onChange={status => {
              const action: Extract<PartyAction, { type: 'titan-roster' }> = { type: 'titan-roster', ...owner, edit: { operation: 'status', id: titan.id, status, expected: titan } };
              if (status === 'alive') dispatch(action);
              else setChanging({ titan, status, action });
            }}
            onDelete={() => setRemoving(titan)} />
        </View>
        <View style={styles.details}>
          <Text style={styles.assignment}>{assigned ? `Assigned to ${assigned.name}` : tab === 'alive' ? 'Available for an Argonaut' : 'Unavailable for battle'}</Text>
          {(['trauma', 'kratos'] as const).map(kind => {
            const ref = titan.patterns[kind];
            return <Button key={kind} quiet label={`View ${name} ${kind} table`} style={styles.pattern} onPress={() => {
              const source = ref ?? titan;
              onClose(); router.push({ pathname: '/cards/[id]', params: { id: source.definitionId, face: source.faceId } });
            }}>
              <CardIcon name={kind === 'trauma' ? 'Trauma' : 'Kratos'} size={19} />
              <View style={{ flex: 1 }}><Text style={styles.patternTitle}>{kind === 'trauma' ? 'Trauma' : 'Kratos'}</Text>
                <Text style={styles.patternName}>{rosterPatternName(ref, face, catalogue)}</Text></View>
            </Button>;
          })}
          <Button quiet label={`Edit ${name}`} onPress={() => setEditing(titan)}><Text style={styles.actionText}>Edit Titan</Text></Button>
        </View>
      </View>;
    })}</View>
  </View>;
  return <Sheet visible maxWidth={1000} title="Manage Titans" subtitle={`Cycle ${cycle} · ${occupied} / ${capacity} occupied places`} onClose={onClose} scrollKey={tab}>
    <View style={styles.summary}>
      <View style={{ flex: 1, minWidth: 180 }}><Text style={styles.capacity}>{occupied} <Text style={styles.capacityLimit}>/ {capacity} Titans</Text></Text>
        <Text style={styles.caption}>Alive + Crippled occupy places. Dead Titans keep their Patterns until changed or deleted.</Text></View>
      <Button label="Add Titan" disabled={occupied >= capacity} onPress={() => setEditing('new')} />
    </View>
    {occupied >= capacity && <Text style={styles.caption}>{occupied > capacity ? 'The roster exceeds its current technology limit. ' : 'The roster is full. '}Free a place before adding or restoring a Titan.</Text>}
    <View accessibilityRole="tablist" style={styles.tabs}>{statuses.map(status => <View key={status} style={{ flex: 1 }}><Button quiet role="tab" selected={tab === status}
      label={`${titanStatusLabel(status)} · ${titans.filter(titan => titan.status === status).length}`} onPress={() => setTab(status)} style={[styles.tab, tab === status && styles.activeTab]}>
      <Text style={[styles.tabText, tab === status && styles.activeText]}>{titanStatusLabel(status)} <Text style={styles.tabCount}>{titans.filter(titan => titan.status === status).length}</Text></Text>
    </Button></View>)}</View>
    {tiles(bred, 'Argo-bred')}{tiles(walkers, 'Dreamwalkers')}
    {!shown.length && <View style={styles.empty}><Text style={styles.emptyTitle}>No {titanStatusLabel(tab).toLowerCase()} Titans</Text>
      <Text style={styles.caption}>{tab === 'alive' ? 'Add a Titan or restore one from another tab.' : 'Changing a Titan’s status will move it here.'}</Text></View>}
    <Text style={styles.caption}>{availableRosterTitans(party, catalogue, '').length} unassigned Alive Titans. Pattern allocations are shared across all three tabs.</Text>
  </Sheet>;
}
const styles = StyleSheet.create({
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#E9EDE8', borderRadius: 6 },
  capacity: { fontFamily: theme.serif, fontSize: 30, color: theme.ink }, capacityLimit: { fontSize: 17, color: theme.muted }, caption: { color: theme.muted, fontSize: 12, lineHeight: 19 },
  tabs: { flexDirection: 'row', gap: 8 }, tab: { flex: 1, paddingHorizontal: 5 }, activeTab: { backgroundColor: theme.charcoal, borderColor: theme.charcoal },
  tabText: { fontSize: 14, color: theme.ink, fontWeight: '600' }, activeText: { color: theme.white }, tabCount: { fontVariant: ['tabular-nums'] },
  group: { gap: 10 }, groupTitle: { fontFamily: theme.serif, fontSize: 21, color: theme.ink }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexBasis: 265, flexGrow: 1, flexShrink: 1, minWidth: 220, maxWidth: 340, borderWidth: 1, borderColor: theme.line, borderRadius: 7, overflow: 'hidden', backgroundColor: '#F6F4EE' },
  cardHeader: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#263C3F', overflow: 'hidden' },
  crippled: { backgroundColor: '#735536' }, dead: { backgroundColor: '#4D4545' }, art: { position: 'absolute', top: 0, right: 0, width: '55%', height: '100%', opacity: 0.22 },
  cardHeading: { flex: 1 }, number: { color: '#D5DBD8', fontSize: 9, letterSpacing: 1.5, marginBottom: 5 }, name: { fontFamily: theme.serif, fontSize: 22, color: theme.white },
  type: { color: '#D5DBD8', fontSize: 12, marginTop: 4 },
  details: { padding: 12, gap: 9 }, assignment: { fontSize: 12, color: theme.muted },
  pattern: { flexDirection: 'row', gap: 9, justifyContent: 'flex-start', backgroundColor: theme.paper, padding: 8 }, patternTitle: { fontSize: 10, color: theme.muted }, patternName: { fontSize: 13, color: theme.ink },
  actionText: { color: theme.ink, fontSize: 12 }, empty: { padding: 24, alignItems: 'center', gap: 6 }, emptyTitle: { color: theme.ink, fontFamily: theme.serif, fontSize: 22 },
});
