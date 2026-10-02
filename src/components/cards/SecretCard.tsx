import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../Button';
import type { CardDefinition } from '../../domain/cards';
import { secretLabel } from '../../domain/card-presentation';

export function SecretCard({ card, onReveal, compact = false }: { card: CardDefinition; onReveal?: () => void; compact?: boolean }) {
  return <View style={[styles.card, compact && styles.compact]}>
    <Text style={styles.title}>Spoiler warning</Text><Text style={styles.label}>{secretLabel(card)}</Text>
    {onReveal && <Button quiet label="Reveal this card" onPress={onReveal} style={styles.button}><Text style={styles.label}>Reveal this card</Text></Button>}
  </View>;
}
const styles = StyleSheet.create({
  card: { minHeight: 414, borderRadius: 10, backgroundColor: '#000000', padding: 20, alignItems: 'center', justifyContent: 'center', gap: 20 }, compact: { minHeight: 100, padding: 12, gap: 12 },
  title: { color: '#FFFFFF', fontSize: 24, textAlign: 'center' }, label: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' }, button: { borderColor: '#FFFFFF' },
});
