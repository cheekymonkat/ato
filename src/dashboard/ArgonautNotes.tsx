import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SwipeGuard } from '../components/SwipeSurface';
import type { Argonaut } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { SectionHeading } from './EquipmentArea';

export function ArgonautNotes({ argonaut }: { argonaut: Argonaut }) {
  const { party, dispatch } = useParty();
  const text = argonaut.notes ?? '';
  return <View testID="argonaut-notes" style={styles.section}>
    <SectionHeading title="Notes" />
    <SwipeGuard><View style={styles.field}>
      {/* Matching text measures wrapping and trailing blank lines without a height cap. */}
      <Text aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        pointerEvents="none" style={[styles.text, styles.measure]}>{text + '\u200b'}</Text>
      <TextInput accessibilityLabel="Notes" accessibilityHint="Free text saved for this Argonaut. The field grows as you type."
        placeholder="Add notes…" placeholderTextColor={theme.muted}
        multiline numberOfLines={1} scrollEnabled={false} submitBehavior="newline" textAlignVertical="top"
        value={text} onChangeText={text => dispatch({ type: 'notes', partyId: party.id, argonautId: argonaut.id, text })}
        style={[styles.text, styles.input]} />
    </View></SwipeGuard>
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 24, minWidth: 0 },
  field: { backgroundColor: theme.paper, borderColor: theme.line, borderWidth: 1, borderRadius: 5, minWidth: 0 },
  text: { color: theme.ink, fontSize: 14, lineHeight: 22, paddingHorizontal: 10, paddingVertical: 10, includeFontPadding: false },
  measure: { opacity: 0, minHeight: 42 },
  input: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
});
