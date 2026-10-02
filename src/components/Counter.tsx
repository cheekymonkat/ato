import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { theme } from '../theme/tokens';

export function Counter({ name, value, onDecrease, onIncrease, large = false }: {
  name: string; value: number; onDecrease: () => void; onIncrease: () => void; large?: boolean;
}) {
  return <View style={[styles.counter, large && styles.large]}>
    <Text style={styles.name}>{name}</Text>
    <Text accessibilityLabel={`${name}: ${value}`} accessibilityLiveRegion="polite" style={[styles.value, large && styles.largeValue]}>{value}</Text>
    <View style={styles.controls}>
      <Button quiet label={`Decrease ${name}`} disabled={value === 0} onPress={onDecrease} style={styles.button}><Text style={styles.symbol}>−</Text></Button>
      <Button quiet label={`Increase ${name}`} onPress={onIncrease} style={styles.button}><Text style={styles.symbol}>+</Text></Button>
    </View>
    {large && value > 9 && <Text style={styles.manual}>Manual value</Text>}
  </View>;
}
const styles = StyleSheet.create({
  counter: { flex: 1, minWidth: 104, paddingTop: 13, paddingBottom: 8, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: theme.line, borderRadius: 6, backgroundColor: theme.paper },
  large: { minWidth: 96, borderWidth: 0, paddingHorizontal: 0, paddingTop: 8, backgroundColor: 'transparent' },
  name: { color: theme.muted, fontSize: 12, fontWeight: '600' },
  value: { color: theme.ink, fontFamily: theme.serif, fontSize: 30, lineHeight: 42, marginVertical: 3 },
  largeValue: { fontSize: 40, lineHeight: 50 }, controls: { flexDirection: 'row', gap: 4 },
  button: { paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0, width: 44 },
  symbol: { color: theme.ink, fontSize: 22 }, manual: { color: theme.danger, fontSize: 10, marginTop: 4 },
});
