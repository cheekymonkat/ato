import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { MEMORY_GATEWAYS, memoryNodeLimit, memoryProgress } from '../domain/memories';
import type { MemoryKind } from '../domain/memories';
import type { CardInstance } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';

export function NodeTracker({ argonautId, instance, label, kind }: { argonautId: string; instance: CardInstance; label: string; kind: MemoryKind }) {
  const { dispatch } = useParty(), recorded = memoryProgress(instance).node, nodes = recorded ?? 0;
  const limit = memoryNodeLimit(kind), overflow = nodes > limit;
  const change = (delta: -1 | 1) => dispatch({ type: 'memory-node', argonautId, instanceId: instance.id, delta });
  return <View testID={`node-tracker-${instance.id}`} style={styles.tracker}>
    <Text accessibilityLiveRegion="polite" style={styles.count}>Nodes {nodes} / {limit}{recorded === null ? ' · unrecorded' : ''}</Text>
    <View style={styles.row}>
      <Button quiet label={`Remove node from ${label}`} disabled={nodes === 0 || overflow} onPress={() => change(-1)} style={styles.button}><Text style={styles.symbol}>−</Text></Button>
      <View accessible accessibilityLabel={`${label}: ${nodes} of ${limit} nodes${kind === 'mnemos' ? '; red gateways after nodes 3 and 7' : ''}`} style={styles.dots}>
        {Array.from({ length: limit }, (_, index) => [
          <View key={`node-${index}`} accessible={false} style={[styles.dot, index < nodes && styles.filled]} />,
          ...(kind === 'mnemos' && MEMORY_GATEWAYS.some(gateway => gateway === index + 1)
            ? [<View key={`gateway-${index}`} accessible={false} style={[styles.dot, styles.gateway]} />] : []),
        ]).flat()}
      </View>
      <Button quiet label={`Add node to ${label}`} disabled={nodes >= limit} onPress={() => change(1)} style={styles.button}><Text style={styles.symbol}>+</Text></Button>
    </View>
    {kind === 'mnemos' && <Text style={styles.legend}>Red dots: Breakthrough gateways</Text>}
    {overflow && <><Text style={styles.warning}>Saved count exceeds the {limit}-node track. It has been kept.</Text>
      <Button quiet label={`Set ${label} to ${limit} nodes`} onPress={() => dispatch({ type: 'memory-state', argonautId, instanceId: instance.id, progress: { node: limit } })} />
    </>}
  </View>;
}
const styles = StyleSheet.create({
  tracker: { gap: 4, width: '100%', maxWidth: 326.4, alignSelf: 'center' }, count: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' }, button: { width: 44, paddingHorizontal: 0, paddingVertical: 0 }, symbol: { color: theme.ink, fontSize: 22 },
  dots: { flex: 1, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' },
  dot: { flex: 1, maxWidth: 10, aspectRatio: 1, borderWidth: 1, borderColor: theme.ink, borderRadius: 99, backgroundColor: theme.paper }, filled: { backgroundColor: theme.ink },
  gateway: { backgroundColor: '#9B2315', borderColor: '#9B2315' }, legend: { color: theme.muted, fontSize: 10, textAlign: 'center' },
  warning: { color: theme.danger, fontSize: 12, lineHeight: 18 },
});
