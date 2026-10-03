import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/** The same left-aligned, wrapping action strip below every card. */
export function CardActionRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
