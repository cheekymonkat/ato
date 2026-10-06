import { StyleSheet, Text } from 'react-native';
import type { GateStatus } from '../../domain/rules-assistance';
import { useCardColours } from './CardColours';

/** Shared compact status marker for Gear gates and Technology prerequisites. */
export function GateStatusDot({ status, inline = false, cross = false }: { status: GateStatus; inline?: boolean; cross?: boolean }) {
  const paint = useCardColours();
  return <Text accessible={false} style={[styles.dot, !inline && styles.corner, {
    backgroundColor: paint.colour(status === 'met' ? '#276B49' : status === 'unmet' ? '#8A3835' : '#72571D'),
  }]}>{status === 'met' ? '✓' : status === 'unmet' ? cross ? '×' : '−' : '?'}</Text>;
}
const styles = StyleSheet.create({
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: '#FFFFFF', color: '#FFFFFF', fontSize: 9, lineHeight: 10, fontWeight: '700', textAlign: 'center', flexShrink: 0 },
  corner: { position: 'absolute', right: -3, top: -3 },
});
