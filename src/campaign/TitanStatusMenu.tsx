import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import type { TitanStatus } from '../domain/party';
import { titanStatusLabel } from '../domain/titan-roster';
import { theme } from '../theme/tokens';

/** The status badge anchors a small action list, with deletion last. */
export function TitanStatusMenu({ name, status, statuses, full, onChange, onDelete }: {
  name: string; status: TitanStatus; statuses: TitanStatus[]; full: boolean;
  onChange: (status: TitanStatus) => void; onDelete: () => void;
}) {
  const trigger = useRef<View>(null), { width, height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const alternatives = statuses.filter(next => next !== status);
  const menuWidth = Math.min(200, width - 32), availableHeight = height - insets.top - insets.bottom - 32;
  const menuHeight = Math.min(44 * (alternatives.length + 1) + 10 + (status === 'dead' && full ? 26 : 0), availableHeight);
  const top = anchor ? Math.max(insets.top + 16, Math.min(anchor.top, height - insets.bottom - 16 - menuHeight)) : 0;
  const close = () => setAnchor(null);
  return <>
    <View ref={trigger} collapsable={false}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Change ${name} status`}
        accessibilityState={{ expanded: Boolean(anchor) }} onPress={() => trigger.current?.measureInWindow((x, y, w, h) =>
          setAnchor({ top: y + h + 4, right: width - x - w }))} style={styles.trigger}>
        <View style={styles.badge}><Text style={styles.badgeText}>{titanStatusLabel(status)}</Text><Text style={styles.arrow}>⌄</Text></View>
      </Pressable>
    </View>
    <Modal visible={Boolean(anchor)} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss Titan status menu" onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.menu, { width: menuWidth, maxHeight: availableHeight, top,
          right: Math.max(16, Math.min(anchor?.right ?? 16, width - menuWidth - 16)) }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.options}>
            {alternatives.map(next => {
              const disabled = status === 'dead' && full;
              return <Button key={next} quiet label={`Mark ${name} ${titanStatusLabel(next)}`} disabled={disabled} style={styles.option}
                onPress={() => { if (!disabled) { close(); onChange(next); } }}>
                <Text style={styles.optionText}>{titanStatusLabel(next)}</Text>
              </Button>;
            })}
            {status === 'dead' && full && <Text style={styles.hint}>Titan roster full</Text>}
            <View style={styles.delete}><Button quiet label={`Delete ${name}`} style={styles.option} onPress={() => { close(); onDelete(); }}>
              <Text style={styles.deleteText}>Delete</Text>
            </Button></View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#FFFFFF70', borderRadius: 4, padding: 5 },
  badgeText: { fontSize: 10, fontWeight: '700', color: theme.white }, arrow: { fontSize: 10, color: theme.white },
  overlay: { flex: 1 }, menu: { position: 'absolute', backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line,
    borderRadius: 6, elevation: 8, boxShadow: '0 8px 30px #29272333', overflow: 'hidden' },
  options: { padding: 4 }, option: { minHeight: 44, borderWidth: 0, borderRadius: 3, alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 12 },
  optionText: { color: theme.ink, fontSize: 14 }, hint: { color: theme.muted, fontSize: 11, paddingHorizontal: 12, paddingBottom: 8 },
  delete: { borderTopWidth: 1, borderTopColor: theme.line }, deleteText: { color: theme.danger, fontSize: 14 },
});
