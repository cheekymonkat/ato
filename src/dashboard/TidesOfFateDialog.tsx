import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { theme } from '../theme/tokens';

export function TidesOfFateDialog({ campaignName, onConfirm, onClose }: { campaignName: string; onConfirm: () => void; onClose: () => void }) {
  const [accepted, setAccepted] = useState(false);
  return <Sheet visible title="Tides of Fate" subtitle={`Campaign: ${campaignName}`} onClose={onClose}>
    <Text style={styles.text}>For all four Argonauts, this will remove conditions and tokens (including Precision and Speed modifiers), ready all exhausted or discarded Gear, memories and Titans, restore all Gear charges, and set Rage, Fate and Danger to 0.</Text>
    <Text style={styles.text}>Equipment assignments, memory nodes, stats, colours and shared resources are kept.</Text>
    <Button quiet label="I confirm applying Tides of Fate to all four Argonauts" role="checkbox" selected={accepted} onPress={() => setAccepted(value => !value)} style={styles.checkRow}>
      <View style={[styles.check, accepted && styles.accepted]}><Text style={styles.tick}>{accepted ? '✓' : ''}</Text></View>
      <Text style={styles.checkLabel}>I confirm applying Tides of Fate to all four Argonauts.</Text>
    </Button>
    <View style={styles.actions}><Button quiet label="Cancel" onPress={onClose} />
      <Button label="Apply Tides of Fate" disabled={!accepted} onPress={() => { if (accepted) onConfirm(); }} />
    </View>
  </Sheet>;
}
const styles = StyleSheet.create({
  text: { color: theme.ink, fontSize: 14, lineHeight: 22 },
  checkRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 12 }, check: { width: 24, height: 24, borderWidth: 1, borderColor: theme.muted, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  accepted: { backgroundColor: theme.charcoal, borderColor: theme.charcoal }, tick: { color: theme.white, fontSize: 18 }, checkLabel: { flex: 1, color: theme.ink, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
});
