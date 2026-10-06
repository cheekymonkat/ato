import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { theme } from '../theme/tokens';
export function InventorySettings({ enabled, onChange, disabled = false, label }: {
  enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean; label: string;
}) {
  return <View style={styles.section}>
    <Text style={styles.text}>Campaign inventory</Text>
    <Button quiet role="checkbox" selected={enabled} disabled={disabled}
      label={`${label}: Use campaign inventory for equipment and Titan selection`}
      onPress={() => onChange(!enabled)}>
      <Text style={styles.text}>{enabled ? '✓ ' : ''}Use campaign inventory for equipment and Titan selection</Text>
    </Button>
    <Text style={styles.detail}>{enabled ? 'Selections require an available acquired copy recorded in Cargo or an acquired Titan recorded on Argo. Dreamwalker variants remain available by cycle.' : 'You can select Gear without recording acquired copies. Printed Gear copy limits still apply across all Argonauts.'}</Text>
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 12 }, text: { color: theme.ink, fontSize: 15, lineHeight: 22 },
  detail: { color: theme.muted, fontSize: 13, lineHeight: 19 },
});
