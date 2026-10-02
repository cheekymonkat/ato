import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { theme } from '../theme/tokens';
import type { CardDefinition } from '../domain/cards';

export function TitanPicker({ selectedId, onSelect, onClose }: { selectedId?: string; onSelect: (definition: CardDefinition | null) => void; onClose: () => void }) {
  const [query, setQuery] = useState(''), [cycle, setCycle] = useState<string | undefined>();
  const results = getCatalogue().search({ family: 'Titan', query, cycle });
  return <Sheet wide visible title="Choose a Titan" subtitle="Assign a Titan to this Argonaut." onClose={onClose}>
    <TextInput accessibilityLabel="Search Titans" placeholder="Search Titans…" value={query} onChangeText={setQuery} autoCorrect={false} style={styles.input} />
    <View style={styles.filters}>{[undefined, 'Cycle I', 'Cycle II', 'Cycle III', 'Cycle IV', 'Cycle V'].map((value, index) =>
      <Button key={value || 'all'} quiet label={value || 'All cycles'} selected={cycle === value} onPress={() => setCycle(value)} style={cycle === value ? styles.activeFilter : undefined}>
        <Text style={[styles.filterLabel, cycle === value && styles.activeLabel]}>{index === 0 ? 'All' : ['I', 'II', 'III', 'IV', 'V'][index - 1]}</Text>
      </Button>)}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="Unassign Titan" onPress={() => onSelect(null)} style={styles.row}>
      <Text style={styles.name}>No Titan assigned</Text><Text style={styles.cycle}>Clear selection</Text>
    </Pressable>
    {results.map(definition => {
      const face = definition.faces[0], subtitle = face.data.subtitle;
      return <Pressable key={definition.id} accessibilityRole="button" accessibilityLabel={`${face.name}, ${face.cycle}`}
        accessibilityState={{ selected: selectedId === definition.id }} onPress={() => onSelect(definition)}
        style={({ pressed }) => [styles.row, selectedId === definition.id && styles.selected, pressed && { opacity: 0.6 }]}>
        <View style={{ flex: 1 }}><Text style={styles.name}>{face.name}</Text>
          {typeof subtitle === 'string' && subtitle !== 'None' && <Text style={styles.subtitle}>{subtitle}</Text>}</View>
        <Text style={styles.cycle}>{face.cycle}</Text>
      </Pressable>;
    })}
    {!results.length && <Text style={styles.empty}>No Titans match this search.</Text>}
  </Sheet>;
}
const styles = StyleSheet.create({
  input: { padding: 12, minHeight: 48, borderWidth: 1, borderColor: theme.line, borderRadius: 5, color: theme.ink, backgroundColor: theme.white, fontSize: 15 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, activeFilter: { backgroundColor: theme.charcoal },
  filterLabel: { color: theme.ink, fontSize: 13 }, activeLabel: { color: theme.white },
  row: { padding: 16, borderRadius: 5, borderWidth: 1, borderColor: theme.line, flexDirection: 'row', alignItems: 'center', gap: 16 },
  selected: { borderColor: theme.gold, backgroundColor: theme.panel }, name: { fontFamily: theme.serif, fontSize: 19, color: theme.ink },
  subtitle: { fontSize: 12, color: theme.muted, marginTop: 5 }, cycle: { fontSize: 11, color: theme.muted }, empty: { color: theme.muted, fontSize: 14, paddingVertical: 20 },
});
