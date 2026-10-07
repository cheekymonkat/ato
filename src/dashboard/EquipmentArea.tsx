import { CardSelectionTarget } from '../components/cards/CardSelectionTarget';
import { router } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { EquippedGear } from '../components/cards/EquippedGear';
import { EquipmentActions } from '../components/cards/EquipmentActions';
import { SwipeGuard } from '../components/SwipeSurface';
import { GameIcon } from '../components/Icon';
import type { GameIconName } from '../components/Icon';
import type { Argonaut } from '../domain/party';
import type { CapacityPosition } from '../domain/slots';
import { slotRestrictionLabel } from '../domain/slots';
import { loadoutState } from '../domain/loadout';
import type { SlotKind } from '../domain/cards';
import { theme } from '../theme/tokens';
import { useSpoilers } from '../state/SpoilerProvider';
import { equipmentGroupWidths, equipmentSlotSize, GROUP_GAP, SLOT_GAP, SLOT_WIDTH } from './equipment-layout';
import { positionRouteParam } from '../loadout/position-params';
import { visibleEquipmentPositions } from './equipment-positions';
import { useParty } from '../state/PartyProvider';

const labels: Record<SlotKind, string> = { hand: 'Weapon', armor: 'Armor', support: 'Support', attachment: 'Attachment', mnemos: 'Mnemos', 'fated-mnemos': 'Fated Mnemos' };
const icons: Record<SlotKind, GameIconName> = { hand: 'OneHanded', armor: 'Armor', support: 'Support', attachment: 'Attachment', mnemos: 'Mnemos', 'fated-mnemos': 'FatedMnemos' };
const slotWidth = SLOT_WIDTH, slotGap = SLOT_GAP;

function EquipmentSelection({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return <SwipeGuard><CardSelectionTarget label={label} hint="Opens equipment selection and editing"
    onPress={onPress} style={({ pressed }) => [styles.selection, pressed && styles.pressed]}>{children}</CardSelectionTarget></SwipeGuard>;
}

export function SectionHeading({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.heading}>{title}</Text>
    {action || note && <Text style={styles.note}>{note}</Text>}</View>;
}

function SlotCard({ position, index, argonaut, compact, cellWidth }: { position: CapacityPosition; index: number; argonaut: Argonaut; compact?: boolean; cellWidth: number }) {
  const catalogue = getCatalogue();
  const { party, dispatch } = useParty();
  const active = loadoutState(argonaut, catalogue).activeInstanceIds;
  const assignment = argonaut.equipment.find(entry => active.has(entry.instanceId) && entry.positionIds.includes(position.id));
  const memoryId = position.kind === 'mnemos' ? argonaut.mnemosIds[index] : position.kind === 'fated-mnemos' ? argonaut.fatedMnemosIds[index] : undefined;
  const instance = argonaut.instances.find(item => item.id === (assignment?.instanceId || memoryId));
  const face = instance && catalogue.getFace(instance.definitionId, instance.faceId);
  const definition = instance && catalogue.get(instance.definitionId);
  const spoilers = useSpoilers(), hidden = definition && spoilers.hidden(definition);
  const sourceDefinition = position.source && catalogue.get(position.source.definitionId);
  const source = sourceDefinition?.faces.find(face => face.id === position.source?.faceId);
  const sourceName = source && (sourceDefinition && spoilers.hidden(sourceDefinition) ? 'unrevealed Gear' : source.name);
  const label = `${labels[position.kind]}${position.kind === 'armor' ? '' : ` ${index + 1}`}`;
  const horizontal = compact && (position.kind === 'mnemos' || position.kind === 'fated-mnemos');
  const editable = !['mnemos', 'fated-mnemos'].includes(position.kind);
  const openEditor = () => router.push({ pathname: '/loadout/[id]', params: { id: argonaut.id, position: positionRouteParam(position.id), ...(instance ? { instance: instance.id } : {}) } });
  const content = <>
    <Text style={styles.slotLabel}>{label}</Text>
    {face?.kind === 'gear' && definition ? <EquippedGear card={definition} face={face} exhausted={Boolean(instance?.exhausted || instance?.discarded)} instance={instance}
      onCharge={instance ? index => dispatch({ type: 'equipment-charge', partyId: party.id, argonautId: argonaut.id,
        instanceId: instance.id, definitionId: instance.definitionId, faceId: instance.faceId, index }) : undefined} /> : <View style={[styles.cardBody, horizontal && styles.compactBody]}>
      <View style={styles.symbol}><GameIcon name={icons[position.kind]} size={compact ? 28 : 38} /></View>
      <View style={horizontal ? { flex: 1 } : { alignItems: 'center' }}>
        <Text style={[styles.empty, face && styles.cardName]}>{hidden ? 'Unrevealed card' : face?.name || (compact ? 'Unassigned' : 'Unequipped')}</Text>
        {source && <Text style={styles.grantText}>{position.eligibility ? slotRestrictionLabel(position.eligibility) : 'Additional slot'}</Text>}
      </View>
    </View>}
    {sourceName && <Text style={styles.source}>Granted by {sourceName}</Text>}
  </>;
  return <View testID={`slot-${position.kind}-${index + 1}`} accessibilityLabel={`${label}, ${hidden ? 'unrevealed card' : face?.name || 'empty'}${sourceName ? `, granted by ${sourceName}` : ''}`}
    style={[styles.card, compact && styles.compact, position.source && styles.granted, face && styles.equipped, editable ? [styles.gearSlot, { width: cellWidth }] : styles.memorySlot]}>
    {editable ? <EquipmentSelection label={`${instance ? 'Edit' : 'Equip'} ${label}${instance ? `: ${hidden ? 'unrevealed card' : face?.name || 'card'}` : ''}`} onPress={openEditor}>{content}</EquipmentSelection> : <View style={styles.selection}>{content}</View>}
    {instance && <Text style={[styles.source, styles.status]}>{instance.discarded ? 'Discarded' : instance.exhausted ? 'Exhausted' : 'Ready'}{assignment?.positionIds.length && assignment.positionIds.length > 1 ? ` · Uses ${assignment.positionIds.length} positions` : ''}{assignment?.override ? ' · Manual override' : ''}</Text>}
    {editable && instance && <EquipmentActions argonautId={argonaut.id} instance={instance} definition={definition} />}
  </View>;
}

function SlotRow({ kinds, positions, argonaut, rowWidth, compact = false, startIndex = 0 }: { kinds: SlotKind[]; positions: CapacityPosition[]; argonaut: Argonaut; rowWidth: number; compact?: boolean; startIndex?: number }) {
  const slots = positions.filter(position => kinds.includes(position.kind));
  const { width: cellWidth } = equipmentSlotSize(rowWidth, slots.length);
  const counters: Partial<Record<SlotKind, number>> = {};
  return <View style={styles.row}>{slots.map(position => {
    const index = counters[position.kind] ?? startIndex; counters[position.kind] = index + 1;
    return <SlotCard key={position.id} position={position} index={index} argonaut={argonaut} compact={compact} cellWidth={cellWidth} />;
  })}</View>;
}

export function EquipmentArea({ positions, argonaut, headingAction }: { positions: CapacityPosition[]; argonaut: Argonaut; headingAction?: ReactNode }) {
  const { width } = useWindowDimensions();
  const [areaWidth, setAreaWidth] = useState(width - 32);
  const state = loadoutState(argonaut, getCatalogue()), needsReassignment = state.pending;
  const visiblePositions = visibleEquipmentPositions(positions, argonaut.equipment, state.activeInstanceIds);
  const spoilers = useSpoilers();
  const groups: { title: string; kinds: SlotKind[]; note?: string; compact?: boolean }[] = [
    { title: 'Equipment', kinds: ['hand', 'armor'], note: 'Your Titan’s loadout' },
    { title: 'Support', kinds: ['support'], note: `${positions.filter(position => position.kind === 'support').length} available slots` },
    { title: 'Attachments', kinds: ['attachment'], compact: true },
  ];
  const groupWidths = equipmentGroupWidths(areaWidth, groups.map(group => visiblePositions.filter(position => group.kinds.includes(position.kind)).length));
  return <View style={styles.area}>
    <View style={styles.groups} onLayout={event => { if (event.nativeEvent.layout.width > 0) setAreaWidth(event.nativeEvent.layout.width); }}>{groups.map((group, index) => {
      return <View key={group.title} style={[styles.group, { width: groupWidths[index] }]}>
        <SectionHeading title={group.title} note={group.note} action={index === 0 ? headingAction : undefined} />
        <SlotRow kinds={group.kinds} positions={visiblePositions} argonaut={argonaut} rowWidth={groupWidths[index]} compact={group.compact} />
      </View>;
    })}</View>
    {needsReassignment.length > 0 && <View style={styles.reassignment}><Text style={styles.reassignmentTitle}>Needs reassignment</Text>
      {needsReassignment.map(({ assignment: entry, reasons }) => {
        const item = argonaut.instances.find(instance => instance.id === entry.instanceId);
        const definition = item && getCatalogue().get(item.definitionId);
        const face = item && getCatalogue().getFace(item.definitionId, item.faceId);
        const name = definition && spoilers.hidden(definition) ? 'Unrevealed card' : face?.name || entry.instanceId;
        return <View key={entry.instanceId} style={styles.pendingCard}>
          <EquipmentSelection label={`Reassign ${name}`} onPress={() => router.push({ pathname: '/loadout/[id]', params: { id: argonaut.id, instance: entry.instanceId } })}>
            {definition && face?.kind === 'gear' ? <EquippedGear card={definition} face={face} exhausted={Boolean(item?.exhausted || item?.discarded)} instance={item} /> : <Text style={styles.reassignmentText}>{name}</Text>}
            <Text style={styles.source}>{reasons.join(' ')}</Text>
          </EquipmentSelection>
          {item && <><Text style={[styles.source, styles.status]}>{item.discarded ? 'Discarded' : item.exhausted ? 'Exhausted' : 'Ready'}</Text><EquipmentActions argonautId={argonaut.id} instance={item} definition={definition} /></>}
        </View>;
      })}</View>}
  </View>;
}
const styles = StyleSheet.create({
  area: { gap: 24, minWidth: 0 }, groups: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: GROUP_GAP },
  group: { flexShrink: 0, minWidth: 0 }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 },
  heading: { fontFamily: theme.serif, fontSize: 20, color: theme.ink }, note: { color: theme.muted, fontSize: 11 },
  row: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: slotGap },
  card: { minWidth: 88, minHeight: 168, backgroundColor: '#EAE7DF', borderWidth: 1, borderStyle: 'dashed', borderColor: '#BEB9AE', borderRadius: 6 },
  compact: { minHeight: 112 }, granted: { backgroundColor: '#E8E4D7', borderColor: theme.gold, borderStyle: 'solid' }, equipped: { backgroundColor: theme.paper, borderStyle: 'solid' },
  gearSlot: { flexGrow: 0, flexShrink: 0, minWidth: 0, maxWidth: slotWidth }, memorySlot: { flex: 1 }, selection: { padding: 10 }, pressed: { opacity: 0.7 },
  slotLabel: { fontSize: 11, fontWeight: '600', color: theme.muted }, cardBody: { minHeight: 128, alignItems: 'center', justifyContent: 'center', gap: 13, paddingVertical: 16 },
  compactBody: { flexDirection: 'row', gap: 12, paddingVertical: 12 }, symbol: { opacity: 0.26 }, empty: { color: theme.muted, fontSize: 11 },
  cardName: { color: theme.ink, fontFamily: theme.serif, fontSize: 18, textAlign: 'center' }, grantText: { color: theme.muted, fontSize: 11, textAlign: 'center', marginTop: 6, lineHeight: 16 },
  source: { color: theme.muted, fontSize: 10, lineHeight: 15, marginTop: 8 },
  status: { marginTop: 0, marginHorizontal: 10, marginBottom: 8 }, pendingCard: { width: '100%', maxWidth: slotWidth, backgroundColor: theme.paper, borderRadius: 6 },
  reassignment: { padding: 18, backgroundColor: '#F4E5DB', borderRadius: 5, gap: 8 }, reassignmentTitle: { color: theme.danger, fontWeight: '600' }, reassignmentText: { color: theme.ink, fontSize: 13 },
});
