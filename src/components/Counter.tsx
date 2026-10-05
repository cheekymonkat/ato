import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Button } from './Button';
import { theme } from '../theme/tokens';

export function Counter({ name, value, onDecrease, onIncrease, large = false, compact = false, dense = false, icon, min = 0, max, style }: {
  name: string; value: number; onDecrease: () => void; onIncrease: () => void; large?: boolean; compact?: boolean; dense?: boolean; icon?: ReactNode; min?: number; max?: number; style?: StyleProp<ViewStyle>;
}) {
  const decrease = <Button quiet label={`Decrease ${name}`} disabled={value <= min} onPress={onDecrease} style={styles.button}><Text style={styles.symbol}>−</Text></Button>;
  const increase = <Button quiet label={`Increase ${name}`} disabled={max !== undefined && value >= max} onPress={onIncrease} style={styles.button}><Text style={styles.symbol}>+</Text></Button>;
  if (compact) return <View style={[styles.compactCounter, dense && styles.denseCounter, style]}>
    <View style={styles.compactHeading}>
      {icon && <View style={styles.compactIcon}>{icon}</View>}
      <Text style={styles.name}>{name}</Text>
    </View>
    <View style={[styles.compactControls, dense && styles.denseControls]}>
      {decrease}
      <Text accessibilityLabel={`${name}: ${value}`} accessibilityLiveRegion="polite" numberOfLines={dense ? 1 : undefined} style={[styles.compactValue, dense && styles.denseValue]}>{value}</Text>
      {increase}
    </View>
    {large && value > 9 && <Text style={[styles.manual, styles.compactManual]}>Manual value</Text>}
  </View>;
  return <View style={[styles.counter, large && styles.large, style]}>
    <Text style={styles.name}>{name}</Text>
    <Text accessibilityLabel={`${name}: ${value}`} accessibilityLiveRegion="polite" style={[styles.value, large && styles.largeValue]}>{value}</Text>
    <View style={styles.controls}>
      {decrease}
      {increase}
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
  compactCounter: { flexGrow: 1, flexShrink: 1, flexBasis: 138, minWidth: 138, borderWidth: 1, borderColor: theme.line, borderRadius: 6, padding: 4 },
  compactHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 22 },
  compactControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 44 },
  compactIcon: { width: 22, alignItems: 'center', opacity: 0.65 },
  compactValue: { color: theme.ink, fontFamily: theme.serif, fontSize: 28, lineHeight: 36, minWidth: 32, textAlign: 'center' },
  compactManual: { alignSelf: 'center', marginTop: 0 },
  // Three skill columns fit a 375 px phone while retaining 44 px action targets.
  denseCounter: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 110, paddingHorizontal: 0, backgroundColor: theme.paper },
  denseControls: { gap: 0 }, denseValue: { minWidth: 20, fontSize: 24, letterSpacing: -0.5, flexShrink: 0 },
});
