import { Redirect, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogue } from '../catalogue';
import { PatternTable } from '../components/PatternTable';
import type { PatternKind } from '../domain/pattern-table';
import { theme } from '../theme/tokens';

const samples: { name: string; kind: PatternKind }[] = [
  { name: 'Iapetan Strain', kind: 'Trauma' }, { name: 'Mazewalker', kind: 'Kratos' },
  { name: 'Shade Training', kind: 'Trauma' }, { name: 'Pandoran Strain', kind: 'Kratos' },
  { name: 'Dawnburner', kind: 'Kratos' },
];

/** Isolated development review; production links return to the dashboard. */
export default function PatternPreview() {
  const { width } = useLocalSearchParams<{ width?: string }>();
  const reviewWidth = ['264', '320', '390'].includes(width || '') ? Number(width) : undefined;
  if (!__DEV__) return <Redirect href="/" />;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}><ScrollView contentContainerStyle={[styles.content, reviewWidth !== undefined && { width: reviewWidth, maxWidth: '100%' }]}>
    <Text accessibilityRole="header" style={styles.title}>Pattern table review</Text>
    <Text style={styles.note}>Development preview · original ranges, combined effects and variable row counts</Text>
    <View style={styles.samples}>{samples.map(sample => {
      const face = getCatalogue().byName(sample.name)[0]?.faces[0];
      const data = face?.kind === 'titan' || face?.kind === 'other' ? face.data : undefined;
      const table = data && (sample.kind === 'Trauma' ? data.traumaTable : data.kratosTable);
      return <View key={sample.name} style={styles.sample}>
        <Text accessibilityRole="header" style={styles.name}>{sample.name}</Text>
        {Array.isArray(table) && <PatternTable kind={sample.kind} table={table} />}
      </View>;
    })}</View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.canvas },
  content: { padding: 16, gap: 16, width: '100%', maxWidth: 1000, marginHorizontal: 'auto' },
  title: { fontSize: 28, fontFamily: theme.serif, color: theme.ink }, note: { color: theme.muted, fontSize: 13 },
  samples: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  sample: { flexGrow: 1, flexShrink: 1, flexBasis: 280, maxWidth: 460, gap: 12 },
  name: { fontSize: 18, color: theme.ink, fontFamily: theme.serif },
});
