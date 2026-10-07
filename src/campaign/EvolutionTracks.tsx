import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../components/Button';
import type { CycleEvolution, EvolutionEdit } from '../domain/evolution';
import { canMarkEvolutionNode, levelNumeral, primordialPath } from '../domain/evolution-rules';
import type { EvolutionRules } from '../domain/evolution-rules';
import { theme } from '../theme/tokens';

const ROW_HEIGHT = 48, x = { left: 48, shared: 150, right: 252 };
export function EvolutionTracks({ rules, state, selectedId, onSelect, onEdit }: {
  rules: EvolutionRules; state: CycleEvolution; selectedId: string;
  onSelect: (id: string) => void; onEdit: (edit: EvolutionEdit) => void;
}) {
  const height = (Math.max(...rules.nodes.map(node => node.row)) + 1) * ROW_HEIGHT;
  const paths = rules.regular.map(track => primordialPath(rules, track.printedId));
  const connections = [...new Set(paths.flatMap(path => path.slice(1).map((node, index) => {
    const previous = path[index];
    return `M ${x[previous.lane]} ${previous.row * ROW_HEIGHT + 24} L ${x[node.lane]} ${node.row * ROW_HEIGHT + 24}`;
  })))];
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.title}>Primordials</Text>
    <View style={styles.headings}>{rules.regular.map((track, index) => {
      const path = paths[index], last = path.findLastIndex(node => state.marked.includes(node.id));
      const level = path[last < 0 ? 0 : last].level;
      return <View key={track.printedId} style={styles.heading}>
        <Button quiet selected={selectedId === track.printedId} label={`View ${track.name} battle setup`} onPress={() => onSelect(track.printedId)} style={[styles.nameButton, selectedId === track.printedId && styles.selectedName]}>
          <Text style={styles.name}>{track.name}</Text><Text style={styles.level}>Level {levelNumeral(level)}{last < 0 ? ' · Unencountered' : ''}</Text>
        </Button>
        <Text style={styles.count}>{path.filter(node => state.marked.includes(node.id)).length}/{path.length} boxes marked</Text>
      </View>;
    })}</View>
    <View testID="evolution-diagram" style={[styles.diagram, { height }]}>
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height={height} viewBox={`0 0 300 ${height}`} preserveAspectRatio="none" aria-hidden>
          {connections.map(path => <Path key={path} d={path} stroke={theme.line} strokeWidth={2} fill="none" />)}
        </Svg>
      </View>
      {rules.nodes.map(node => {
        const marked = state.marked.includes(node.id), shared = node.lane === 'shared', disabled = !marked && !canMarkEvolutionNode(rules, state.marked, node.id);
        const name = shared ? 'Shared' : rules.regular[node.lane === 'left' ? 0 : 1].name;
        return <Pressable key={node.id} testID={`evolution-node-${node.id}`} accessibilityRole="checkbox"
          accessibilityLabel={`${name} Level ${levelNumeral(node.level)}, box ${node.row + 1}`} accessibilityState={{ checked: marked, disabled }} disabled={disabled}
          accessibilityHint={disabled ? 'Select a connected diamond above this one first' : marked ? 'Clears this box and any later boxes that lose their connected path' : shared ? 'Changes both Primordial tracks' : 'Changes this Primordial track'}
          onPress={() => onEdit({ kind: 'node', nodeId: node.id, marked: !marked })}
          style={[styles.node, { top: node.row * ROW_HEIGHT + 2, left: node.lane === 'left' ? '16%' : shared ? '50%' : '84%' }]}>
          <View style={[styles.diamond, shared && styles.shared, marked && styles.marked, disabled && styles.unavailable]}>
            <Text style={[styles.numeral, marked && styles.markedText]}>{levelNumeral(node.level)}</Text>
          </View>
        </Pressable>;
      })}
    </View>
    <Text style={styles.caption}>Start at a top diamond and follow its connecting lines. Centre diamonds advance both Primordials. Clearing a box also clears later boxes that lose their path.</Text>
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: '#F1EFE7', borderColor: theme.line, borderWidth: 1, borderRadius: 7, padding: 12, gap: 10, minWidth: 0 },
  title: { color: theme.ink, fontFamily: theme.serif, fontSize: 20 }, headings: { flexDirection: 'row', gap: 8 }, heading: { flex: 1, minWidth: 0, gap: 6 },
  nameButton: { minHeight: 76, paddingHorizontal: 5, paddingVertical: 8, gap: 4 }, name: { fontSize: 14, color: theme.ink, fontWeight: '700', textAlign: 'center' },
  selectedName: { backgroundColor: '#E4EEED', borderColor: '#347C7A' },
  level: { fontSize: 11, color: theme.muted, textAlign: 'center' }, count: { fontSize: 10, color: theme.muted, fontVariant: ['tabular-nums'], textAlign: 'center' },
  diagram: { width: '100%' }, node: { position: 'absolute', width: 44, height: 44, marginLeft: -22, alignItems: 'center', justifyContent: 'center' },
  diamond: { width: 29, height: 29, transform: [{ rotate: '45deg' }], backgroundColor: theme.paper, borderWidth: 1.5, borderColor: '#706D65', alignItems: 'center', justifyContent: 'center' },
  shared: { borderColor: '#347C7A', borderWidth: 2 }, marked: { backgroundColor: '#263C3F', borderColor: '#263C3F' },
  unavailable: { opacity: 0.3 },
  numeral: { color: theme.ink, fontSize: 12, fontWeight: '700', transform: [{ rotate: '-45deg' }] }, markedText: { color: theme.white },
  caption: { color: theme.muted, fontSize: 11, lineHeight: 17 },
});
