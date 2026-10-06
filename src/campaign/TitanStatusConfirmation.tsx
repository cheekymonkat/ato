import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { titanStatusLabel } from '../domain/titan-roster';
import { theme } from '../theme/tokens';

/** Replace the selector/roster sheet while confirming a health change. */
export function TitanStatusConfirmation({ name, status, onConfirm, onCancel }: {
  name: string; status: 'crippled' | 'dead'; onConfirm: () => void; onCancel: () => void;
}) {
  const [accepted, setAccepted] = useState(false), label = titanStatusLabel(status);
  return <Sheet visible title={`Mark Titan ${label}`} onClose={onCancel}>
    <Text style={styles.text}>Mark {name} as {label.toLowerCase()}?</Text>
    <Text style={styles.text}>This Titan will move to the {label} tab and be unavailable for selection. Any Argonaut assignment will be cleared. Its Patterns will be kept.</Text>
    <Button quiet role="checkbox" label={`I confirm marking ${name} ${label}`} selected={accepted}
      onPress={() => setAccepted(value => !value)} style={styles.checkRow}>
      <View style={[styles.check, accepted && styles.accepted]}><Text style={styles.tick}>{accepted ? '✓' : ''}</Text></View>
      <Text style={styles.checkLabel}>I confirm marking this Titan {label.toLowerCase()}.</Text>
    </Button>
    <View style={styles.actions}>
      <Button quiet label="Cancel" onPress={onCancel} />
      <Button label={`Confirm ${label}`} disabled={!accepted} onPress={() => { if (accepted) onConfirm(); }} />
    </View>
  </Sheet>;
}
const styles = StyleSheet.create({
  text: { color: theme.ink, fontSize: 14, lineHeight: 22 },
  checkRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 12 },
  check: { width: 24, height: 24, borderWidth: 1, borderColor: theme.muted, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  accepted: { backgroundColor: theme.charcoal, borderColor: theme.charcoal }, tick: { color: theme.white, fontSize: 18 },
  checkLabel: { flex: 1, color: theme.ink, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
});
