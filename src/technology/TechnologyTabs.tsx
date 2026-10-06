import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/tokens';

export function TechnologyTabs<T extends string>({ label, options, selected, onSelect }: {
  label: string; options: readonly { id: T; label: string }[]; selected: T; onSelect: (id: T) => void;
}) {
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.tabs}>
    {options.map(option => <Pressable key={option.id} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected: selected === option.id }}
      onPress={() => onSelect(option.id)} style={({ pressed }) => [styles.tab, selected === option.id && styles.selected, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.label, selected === option.id && styles.selectedLabel]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tab: { flexGrow: 1, flexBasis: 110, minHeight: 48, borderWidth: 1, borderColor: theme.line, borderRadius: 6, backgroundColor: theme.paper, padding: 12, justifyContent: 'center', alignItems: 'center' },
  selected: { backgroundColor: theme.charcoal, borderColor: theme.gold, borderBottomWidth: 3 }, label: { color: theme.ink, fontSize: 14, textAlign: 'center' }, selectedLabel: { color: theme.white, fontWeight: '700' },
});
