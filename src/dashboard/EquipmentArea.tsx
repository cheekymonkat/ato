import { StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { GameIcon } from '../components/Icon';
import type { GameIconName } from '../components/Icon';
import type { Argonaut } from '../domain/party';
import type { CapacityPosition } from '../domain/slots';
import { findAssignmentsNeedingReassignment } from '../domain/slots';
import type { SlotKind } from '../domain/cards';
import { theme } from '../theme/tokens';

const labels: Record<SlotKind, string> = { hand: 'Weapon', armor: 'Armor', support: 'Support', attachment: 'Attachment', mnemos: 'Mnemos', 'fated-mnemos': 'Fated Mnemos' };
const icons: Record<SlotKind, GameIconName> = { hand: 'OneHanded', armor: 'Armor', support: 'Support', attachment: 'Attachment', mnemos: 'Mnemos', 'fated-mnemos': 'FatedMnemos' };

export function SectionHeading({ title, note }: { title: string; note?: string }) {
  return <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.heading}>{title}</Text>
    {note && <Text style={styles.note}>{note}</Text>}</View>;
}

function SlotCard({ position, index, argonaut, compact }: { position: CapacityPosition; index: number; argonaut: Argonaut; compact?: boolean }) {
  const catalogue = getCatalogue();
  const assignment = argonaut.equipment.find(entry => entry.positionIds.includes(position.id));
  const memoryId = position.kind === 'mnemos' ? argonaut.mnemosIds[index] : position.kind === 'fated-mnemos' ? argonaut.fatedMnemosIds[index] : undefined;
  const instance = argonaut.instances.find(item => item.id === (assignment?.instanceId || memoryId));
  const face = instance && catalogue.getFace(instance.definitionId, instance.faceId);
  const source = position.source && catalogue.get(position.source.definitionId)?.faces.find(face => face.id === position.source?.faceId);
  const label = `${labels[position.kind]}${position.kind === 'armor' ? '' : ` ${index + 1}`}`;
  const horizontal = compact && (position.kind === 'mnemos' || position.kind === 'fated-mnemos');
  return <View testID={`slot-${position.kind}-${index + 1}`} accessibilityLabel={`${label}, ${face?.name || 'empty'}${source ? `, granted by ${source.name}` : ''}`}
    style={[styles.card, compact && styles.compact, position.source && styles.granted, face && styles.equipped]}>
    <Text style={styles.slotLabel}>{label}</Text>
    <View style={[styles.cardBody, horizontal && styles.compactBody]}>
      <View style={styles.symbol}><GameIcon name={icons[position.kind]} size={compact ? 28 : 38} /></View>
      <View style={horizontal ? { flex: 1 } : { alignItems: 'center' }}>
        <Text style={[styles.empty, face && styles.cardName]}>{face?.name || (compact ? 'Unassigned' : 'Unequipped')}</Text>
        {source && <Text style={styles.grantText}>{position.eligibility ? `${position.eligibility.requiredTraits.join(', ')} Gear only` : 'Additional slot'}</Text>}
      </View>
    </View>
    {source && <Text style={styles.source}>Granted by {source.name}</Text>}
  </View>;
}

export function SlotRow({ kinds, positions, argonaut, compact = false, startIndex = 0 }: { kinds: SlotKind[]; positions: CapacityPosition[]; argonaut: Argonaut; compact?: boolean; startIndex?: number }) {
  const counters: Partial<Record<SlotKind, number>> = {};
  return <View style={styles.row}>{positions.filter(position => kinds.includes(position.kind)).map(position => {
    const index = counters[position.kind] ?? startIndex; counters[position.kind] = index + 1;
    return <SlotCard key={position.id} position={position} index={index} argonaut={argonaut} compact={compact} />;
  })}</View>;
}

export function EquipmentArea({ positions, argonaut }: { positions: CapacityPosition[]; argonaut: Argonaut }) {
  const needsReassignment = findAssignmentsNeedingReassignment(argonaut.equipment, positions);
  return <View style={styles.area}>
    <View><SectionHeading title="Equipment" note="Your Titan’s loadout" /><SlotRow kinds={['hand', 'armor']} positions={positions} argonaut={argonaut} /></View>
    <View><SectionHeading title="Support" note={`${positions.filter(position => position.kind === 'support').length} available slots`} /><SlotRow kinds={['support']} positions={positions} argonaut={argonaut} /></View>
    <View><SectionHeading title="Attachments" /><SlotRow kinds={['attachment']} positions={positions} argonaut={argonaut} compact /></View>
    {needsReassignment.length > 0 && <View style={styles.reassignment}><Text style={styles.reassignmentTitle}>Needs reassignment</Text>
      {needsReassignment.map(entry => {
        const item = argonaut.instances.find(instance => instance.id === entry.instanceId);
        return <Text key={entry.instanceId} style={styles.reassignmentText}>{item && getCatalogue().getFace(item.definitionId, item.faceId)?.name || entry.instanceId}</Text>;
      })}</View>}
  </View>;
}
const styles = StyleSheet.create({
  area: { gap: 24 }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 },
  heading: { fontFamily: theme.serif, fontSize: 20, color: theme.ink }, note: { color: theme.muted, fontSize: 11 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flex: 1, minWidth: 88, minHeight: 186, backgroundColor: '#EAE7DF', borderWidth: 1, borderStyle: 'dashed', borderColor: '#BEB9AE', borderRadius: 6, padding: 14 },
  compact: { minHeight: 112 }, granted: { backgroundColor: '#E8E4D7', borderColor: theme.gold, borderStyle: 'solid' }, equipped: { backgroundColor: theme.paper, borderStyle: 'solid' },
  slotLabel: { fontSize: 11, fontWeight: '600', color: theme.muted }, cardBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 13, paddingVertical: 16 },
  compactBody: { flexDirection: 'row', gap: 12, paddingVertical: 12 }, symbol: { opacity: 0.26 }, empty: { color: theme.muted, fontSize: 11 },
  cardName: { color: theme.ink, fontFamily: theme.serif, fontSize: 18, textAlign: 'center' }, grantText: { color: theme.muted, fontSize: 11, textAlign: 'center', marginTop: 6, lineHeight: 16 },
  source: { color: theme.muted, fontSize: 10, lineHeight: 15, marginTop: 8 },
  reassignment: { padding: 18, backgroundColor: '#F4E5DB', borderRadius: 5, gap: 8 }, reassignmentTitle: { color: theme.danger, fontWeight: '600' }, reassignmentText: { color: theme.ink, fontSize: 13 },
});
