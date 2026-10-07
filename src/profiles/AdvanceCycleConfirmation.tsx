import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { nextCampaignCycle } from '../domain/campaign';
import type { CampaignCycle } from '../domain/campaign';
import { theme } from '../theme/tokens';

export function AdvanceCycleConfirmation({ campaignName, cycle, disabled = false, onConfirm, onCancel }: {
  campaignName: string; cycle: CampaignCycle; disabled?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const [accepted, setAccepted] = useState(false), next = nextCampaignCycle(cycle);
  if (next === null) return null;
  return <Sheet visible title="Advance cycle" subtitle={`${campaignName} · Cycle ${cycle} → Cycle ${next}`} onClose={onCancel}>
    <Text accessibilityRole="alert" style={styles.text}>Advancing moves the whole campaign to Cycle {next}. You cannot return to an earlier cycle or skip a cycle.</Text>
    <Text style={styles.text}>Cards and token types for the next cycle become available. Gear, stats and token counts are kept.</Text>
    <Text style={styles.text}>Diplomacy values and diplomacy notes reset for the new cycle’s factions.</Text>
    <Text style={styles.text}>Dead and Crippled Titans are removed. Living Argo-bred Titans and their Patterns are retained. Dreamwalkers become the next cycle’s type with its printed tables, and the occupied roster is reset to 10. If more than 10 living Argo-bred Titans remain, they are all kept.</Text>
    <Button quiet role="checkbox" label="I understand that advancing the cycle cannot be undone" selected={accepted} disabled={disabled}
      onPress={() => setAccepted(value => !value)} style={styles.checkRow}>
      <View style={[styles.check, accepted && styles.accepted]}><Text style={styles.tick}>{accepted ? '✓' : ''}</Text></View>
      <Text style={styles.checkLabel}>I understand that advancing the cycle cannot be undone.</Text>
    </Button>
    <View style={styles.actions}><Button quiet label="Cancel" onPress={onCancel} />
      <Button label={`Advance to Cycle ${next}`} disabled={disabled || !accepted} onPress={() => { if (accepted && !disabled) onConfirm(); }} />
    </View>
  </Sheet>;
}
const styles = StyleSheet.create({
  text: { color: theme.ink, fontSize: 14, lineHeight: 22 }, checkRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 12 },
  check: { width: 24, height: 24, borderWidth: 1, borderColor: theme.muted, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  accepted: { backgroundColor: theme.charcoal, borderColor: theme.charcoal }, tick: { color: theme.white, fontSize: 18 },
  checkLabel: { flex: 1, color: theme.ink, fontSize: 14, lineHeight: 21 }, actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
});
