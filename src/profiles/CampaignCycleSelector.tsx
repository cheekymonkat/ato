import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { CAMPAIGN_CYCLES } from '../domain/campaign';
import type { CampaignCycle } from '../domain/campaign';
import { theme } from '../theme/tokens';

export function CampaignCycleSelector({ value, onChange, disabled = false, label }: {
  value: CampaignCycle; onChange: (cycle: CampaignCycle) => void; disabled?: boolean; label: string;
}) {
  return <View style={styles.row}>{CAMPAIGN_CYCLES.map(cycle => <Button key={cycle} quiet role="radio"
    label={`${label}: Cycle ${cycle}`} selected={value === cycle} disabled={disabled} onPress={() => onChange(cycle)}
    style={value === cycle && styles.selected}><Text style={styles.label}>Cycle {cycle}</Text></Button>)}</View>;
}
const styles = StyleSheet.create({
  label: { color: theme.ink, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selected: { backgroundColor: theme.panel, borderColor: theme.gold },
});
