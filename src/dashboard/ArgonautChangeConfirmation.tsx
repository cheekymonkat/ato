import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import type { SkillName } from '../domain/party';
import { theme } from '../theme/tokens';

export function ArgonautChangeConfirmation({ currentName, nextName, skill, onConfirm, onCancel }: {
  currentName: string; nextName: string; skill: SkillName | null; onConfirm: () => void; onCancel: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  return <Sheet visible title="Change Argonaut" subtitle={`${currentName} → ${nextName}`} onClose={onCancel}>
    <Text style={styles.text}>This resets Courage, Cunning, Endurance, Fury, Will and Wisdom to 0 and removes all Mnemos and Fated Mnemos cards, including their recorded nodes.</Text>
    <Text style={styles.text}>All conditions and tokens for this Argonaut are cleared, including tokens from later cycles.</Text>
    <Text style={styles.text}>{skill ? `Then ${nextName} receives their +1 ${skill} portrait bonus.` : `${nextName} starts with all six stats at 0.`}</Text>
    <Text style={styles.text}>Equipment, Titan, colour and Triskelion values are kept.</Text>
    <Button quiet role="checkbox" selected={accepted} label="I confirm resetting this Argonaut’s stats and removing all memories, conditions and tokens"
      onPress={() => setAccepted(value => !value)} style={styles.checkRow}>
      <View style={[styles.check, accepted && styles.accepted]}><Text style={styles.tick}>{accepted ? '✓' : ''}</Text></View>
      <Text style={styles.checkLabel}>I confirm resetting this Argonaut’s stats and removing all memories, conditions and tokens.</Text>
    </Button>
    <View style={styles.actions}><Button quiet label="Cancel" onPress={onCancel} />
      <Button label="Confirm Argonaut change" disabled={!accepted} onPress={() => { if (accepted) onConfirm(); }} />
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
