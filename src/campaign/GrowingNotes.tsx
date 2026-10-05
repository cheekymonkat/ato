import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme/tokens';
export function GrowingNotes({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <View style={styles.field}>
    <Text aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.text, { opacity: 0, minHeight: 44, pointerEvents: 'none' }]}>{value + '\u200b'}</Text>
    <TextInput accessibilityLabel={label} placeholder="Add notes…" placeholderTextColor={theme.muted} multiline numberOfLines={1}
      scrollEnabled={false} submitBehavior="newline" textAlignVertical="top" value={value} onChangeText={onChange} style={[styles.text, styles.input]} />
  </View>;
}
const styles = StyleSheet.create({
  field: { backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 5, minWidth: 0 },
  text: { color: theme.ink, fontSize: 14, lineHeight: 22, padding: 10, includeFontPadding: false },
  input: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
});
