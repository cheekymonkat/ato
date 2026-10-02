import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { theme } from '../theme/tokens';

export function OverflowDialog({ name, value, onConfirm, onClose }: { name: string; value: number; onConfirm: (value: number) => void; onClose: () => void }) {
  const [input, setInput] = useState(String(value + 1));
  const nextValue = Number(input), valid = /^\d+$/.test(input) && Number.isSafeInteger(nextValue) && nextValue > 9;
  return <Sheet visible title={`${name} beyond 9`} subtitle="Track the value manually and resolve any gameplay consequences yourself." onClose={onClose}>
    <Text style={styles.text}>{name} is currently {value}. Enter the value you want to track.</Text>
    <TextInput accessibilityLabel={`${name} manual value`} value={input} onChangeText={setInput} keyboardType="number-pad" style={styles.input} />
    <View style={styles.actions}><Button quiet label={`Keep ${value}`} onPress={onClose} />
      <Button label="Confirm value" onPress={() => onConfirm(nextValue)} disabled={!valid} /></View>
  </Sheet>;
}
const styles = StyleSheet.create({
  text: { color: theme.muted, fontSize: 14, lineHeight: 22 }, input: { padding: 14, minHeight: 50, borderWidth: 1, borderColor: theme.line, borderRadius: 5, fontSize: 24, color: theme.ink },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' },
});
