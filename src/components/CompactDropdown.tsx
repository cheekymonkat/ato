import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/tokens';

export interface DropdownOption { value: string; label: string; disabled?: boolean; detail?: string }
export interface CompactDropdownProps {
  label: string; value: string; options: DropdownOption[]; onChange: (value: string) => void;
  expanded: boolean; onToggle: () => void; disabled?: boolean;
}
/** Browser-native select; a short inline list with touch-sized rows on iOS/Android. */
export function CompactDropdown({ label, value, options, onChange, expanded, onToggle, disabled = false }: CompactDropdownProps) {
  const selected = options.find(option => option.value === value);
  const choose = (next: string) => {
    const option = options.find(option => option.value === next);
    if (!disabled && option && !option.disabled) onChange(next);
  };
  if (Platform.OS === 'web') return <select aria-label={label} value={value} disabled={disabled}
    onChange={event => choose(event.currentTarget.value)} style={{ width: '100%', minHeight: 44, padding: '10px 12px',
      border: `1px solid ${theme.line}`, borderRadius: 5, backgroundColor: theme.paper, color: theme.ink, fontSize: 16, fontFamily: 'inherit' }}>
    {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>
      {option.label}{option.disabled && option.detail ? ` — ${option.detail}` : ''}
    </option>)}
  </select>;
  return <View style={styles.field}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label ?? 'Choose'}`}
      accessibilityState={{ expanded, disabled }} disabled={disabled} onPress={onToggle} style={[styles.trigger, disabled && styles.disabled]}>
      <Text style={styles.value}>{selected?.label ?? 'Choose'}</Text><Text style={styles.arrow}>{expanded ? '▴' : '▾'}</Text>
    </Pressable>
    {expanded && !disabled && <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.list}>
      {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
        accessibilityHint={option.detail} accessibilityState={{ checked: option.value === value, disabled: Boolean(option.disabled) }}
        disabled={option.disabled} onPress={() => choose(option.value)} style={[styles.option, option.value === value && styles.selected, option.disabled && styles.disabled]}>
        <Text style={styles.optionText}>{option.label}</Text>
        {option.disabled && option.detail && <Text style={styles.detail}>{option.detail}</Text>}
      </Pressable>)}
    </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({
  field: { gap: 4 }, trigger: { minHeight: 44, borderWidth: 1, borderColor: theme.line, borderRadius: 5, backgroundColor: theme.paper, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { flex: 1, color: theme.ink, fontSize: 16 }, arrow: { color: theme.muted, fontSize: 16 },
  list: { maxHeight: 220, borderWidth: 1, borderColor: theme.line, borderRadius: 5, backgroundColor: theme.paper },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.line, gap: 4 },
  optionText: { color: theme.ink, fontSize: 14 }, detail: { color: theme.muted, fontSize: 11 }, selected: { backgroundColor: theme.panel }, disabled: { opacity: 0.45 },
});
