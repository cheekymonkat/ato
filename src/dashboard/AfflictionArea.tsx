import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { CardActionButton } from '../components/cards/CardActionButton';
import { CardActionRow } from '../components/cards/CardActionRow';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { Sheet } from '../components/Sheet';
import { SwipeGuard } from '../components/SwipeSurface';
import { AFFLICTIONS, afflictionRecords } from '../domain/afflictions';
import type { AfflictionId } from '../domain/afflictions';
import { campaignCycle } from '../domain/campaign';
import type { Argonaut } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { SectionHeading } from './EquipmentArea';

export function AfflictionArea({ argonaut }: { argonaut: Argonaut }) {
  const { party, dispatch } = useParty(), records = afflictionRecords(argonaut), cycle = campaignCycle(party);
  const [adding, setAdding] = useState(false), [removing, setRemoving] = useState<AfflictionId | null>(null);
  const removal = records.find(record => record.id === removing);
  const choices = AFFLICTIONS.filter(affliction => affliction.cycle <= cycle && !argonaut.afflictions?.includes(affliction.id));
  return <View testID="affliction-section">
    <SectionHeading title="Afflictions" />
    <View style={styles.panel}>
      {records.length === 0 && <Text style={styles.meta}>No afflictions</Text>}
      {records.map(record => <View key={record.id} style={styles.record}>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.name}>{record.name}</Text><Text style={styles.meta}>Cycle {record.cycle}</Text></View>
        <Text style={styles.description}>{record.description}</Text>
        <SwipeGuard><CardActionRow><CardActionButton action="Remove" cardName={record.name} onPress={() => setRemoving(record.id)} /></CardActionRow></SwipeGuard>
      </View>)}
      <SwipeGuard><Button label="Add affliction" disabled={!choices.length} onPress={() => setAdding(true)} /></SwipeGuard>
    </View>
    {removal ? <RemovalConfirmation title="Remove affliction" itemType="affliction" subject={removal.name}
      onCancel={() => setRemoving(null)} onConfirm={() => {
        dispatch({ type: 'remove-affliction', partyId: party.id, argonautId: argonaut.id, id: removal.id, confirmed: true }); setRemoving(null);
      }} /> : adding && <Sheet visible title="Add affliction" onClose={() => setAdding(false)}>
      <Text style={styles.meta}>Available through campaign Cycle {cycle}. Effects are resolved manually.</Text>
      {choices.map(affliction => <View key={affliction.id} style={styles.choice}>
        <Text style={styles.meta}>Cycle {affliction.cycle}</Text>
        <Button quiet label={affliction.name} onPress={() => {
          dispatch({ type: 'add-affliction', partyId: party.id, argonautId: argonaut.id, id: affliction.id }); setAdding(false);
        }} />
      </View>)}
      {!choices.length && <Text style={styles.meta}>All available afflictions have been added.</Text>}
    </Sheet>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: 12, gap: 12, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 6 },
  record: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.line },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { flexGrow: 1, flexShrink: 1, color: theme.ink, fontWeight: '600', fontSize: 16 },
  description: { color: theme.ink, fontSize: 13, lineHeight: 21 },
  meta: { color: theme.muted, fontSize: 12, lineHeight: 20 }, choice: { gap: 4 },
});
