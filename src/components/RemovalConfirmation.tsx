import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { theme } from '../theme/tokens';

/** Render in place of an existing sheet so native platforms never stack modals. */
export function RemovalConfirmation({ subject, detail, title = 'Remove card', itemType, onConfirm, onCancel }: {
  subject: string; detail?: string; title?: string; itemType?: string; onConfirm: () => void; onCancel: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  return <Sheet visible title={title} onClose={onCancel}>
    <Text style={styles.text}>Remove {subject}?</Text>
    {detail && <Text style={styles.text}>{detail}</Text>}
    <Button quiet label={`I confirm removing ${subject}`} role="checkbox" selected={accepted}
      onPress={() => setAccepted(value => !value)} style={styles.checkRow}>
      <View style={[styles.check, accepted && styles.accepted]}><Text style={styles.tick}>{accepted ? '✓' : ''}</Text></View>
      <Text style={styles.checkLabel}>I confirm removing this {itemType ?? (title === 'Remove resource' ? 'resource' : 'card')}.</Text>
    </Button>
    <View style={styles.actions}>
      <Button quiet label="Cancel" onPress={onCancel} />
      <Button label="Confirm removal" disabled={!accepted} onPress={() => { if (accepted) onConfirm(); }} />
    </View>
  </Sheet>;
}
const styles = StyleSheet.create({
  text: { color: theme.ink, fontSize: 14, lineHeight: 22 },
  checkRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 12 },
  check: { width: 24, height: 24, borderWidth: 1, borderColor: theme.muted, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  accepted: { backgroundColor: theme.charcoal, borderColor: theme.charcoal },
  tick: { color: theme.white, fontSize: 18 }, checkLabel: { flex: 1, color: theme.ink, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
});
