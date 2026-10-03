import { StyleSheet, Text, View } from 'react-native';
import { CardIcon } from '../components/cards/CardIcon';
import { Sheet } from '../components/Sheet';
import { theme } from '../theme/tokens';

const guidance = [
  ['Ambrosia', 'Cycles 1–5. At 1–4 tokens there is no inherent effect, but cards or attacks may check the amount. The base limit is 4; at 5+ the Titan dies.'],
  ['Despair', 'Cycles 1–5. If you have Despair and are not adjacent to another Titan: 1 token gives −1 Precision; 2 gives −3 Precision; 3 prevents combat actions; 4+ kills the Titan unless an effect changes its limit. Dealing a wound to a Primordial discards 1 Despair token.'],
  ['Bleeding', 'Cycles 3–5. Track Bleeding tokens here. Cards with a Bleeding gate check this count. Apply encounter effects and limits manually.'],
  ['Midas', 'Cycles 4–5. At 1–3 tokens, place them on individual Gear cards; affected cards lose their special rules. At 4+ the Titan turns completely to gold and dies. This tracker records the total; Gear placement remains manual.'],
  ['Pain', 'Cycles 4–5. Tracks negative status or encounter-specific injuries and thresholds. There is no universal flat stat penalty.'],
  ['Oxygen', 'Cycle 5. Detailed rules have not yet been supplied.'],
  ['Aether', 'Cycle 5. Detailed rules have not yet been supplied.'],
] as const;
export function TokenRules({ onClose }: { onClose: () => void }) {
  return <Sheet visible title="Token reference" subtitle="Apply effects and limit modifiers manually." onClose={onClose}>
    {guidance.map(([name, text]) => <View key={name} style={styles.item}>
      <View style={styles.heading}><CardIcon name={name} size={22} /><Text style={styles.name}>{name}</Text></View>
      <Text style={styles.text}>{text}</Text>
    </View>)}
  </Sheet>;
}
const styles = StyleSheet.create({ item: { gap: 8 }, heading: { flexDirection: 'row', gap: 8, alignItems: 'center' }, name: { color: theme.ink, fontWeight: '600', fontSize: 16 }, text: { color: theme.ink, lineHeight: 21, fontSize: 14 } });
