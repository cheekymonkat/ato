import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CardIcon } from '../components/cards/CardIcon';
import type { Argonaut } from '../domain/party';
import { campaignCycle, tokenCount, tokenTypesForCycle } from '../domain/tokens';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { modifierColours, tokenColours } from './status-colours';

export function TokenMenu({ argonaut, maxWidth }: { argonaut: Argonaut; maxWidth?: number }) {
  const { party, dispatch } = useParty(), { width, height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const trigger = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ right: number; top: number } | null>(null);
  const rows = [
    ...(['precision', 'speed'] as const).map(modifier => {
      const value = argonaut.combatModifiers?.[modifier] ?? 0;
      return { key: modifier, name: modifier === 'precision' ? 'Precision' : 'Movement', icon: modifier === 'precision' ? 'Precision' : 'Speed', value, colours: modifierColours(value),
        decrease: () => dispatch({ type: 'combat-modifier', argonautId: argonaut.id, modifier, delta: -1 }),
        increase: () => dispatch({ type: 'combat-modifier', argonautId: argonaut.id, modifier, delta: 1 }), min: -Number.MAX_SAFE_INTEGER };
    }),
    ...tokenTypesForCycle(campaignCycle(party)).map(({ name }) => ({ key: name, name, icon: name, value: tokenCount(argonaut, name), colours: tokenColours(name),
      decrease: () => dispatch({ type: 'token', argonautId: argonaut.id, token: name, delta: -1 }),
      increase: () => dispatch({ type: 'token', argonautId: argonaut.id, token: name, delta: 1 }), min: 0 })),
  ];
  const menuWidth = Math.min(300, width - 32, maxWidth ?? width), desiredHeight = 64 + rows.length * 54;
  const availableHeight = height - insets.top - insets.bottom - 32;
  const top = anchor ? Math.max(insets.top + 16, Math.min(anchor.top, height - insets.bottom - 16 - Math.min(desiredHeight, availableHeight))) : 0;
  const close = () => setAnchor(null);
  return <>
    <View ref={trigger} collapsable={false}>
      <Button quiet label="Token counters" onPress={() => trigger.current?.measureInWindow((x, y, w, h) => setAnchor({ right: Math.max(16, width - x - w), top: y + h + 6 }))}
        style={styles.trigger}><Text style={styles.triggerText}>Tokens ⌄</Text></Button>
    </View>
    <Modal visible={Boolean(anchor)} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss token counters" onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.menu, { width: menuWidth, maxHeight: availableHeight, top, right: Math.min(anchor?.right ?? 16, width - menuWidth - 16) }]}>
          <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Token counters</Text>
            <Button quiet label="Close token counters" onPress={close} style={styles.close}><Text style={styles.closeText}>×</Text></Button>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.rows}>
            {rows.map(row => <View key={row.key} testID={`token-counter-${row.key}`} style={styles.row}>
              <View style={styles.rowHeading}><View style={[styles.icon, { backgroundColor: row.colours.background }]}><CardIcon name={row.icon} size={20} invert={row.colours.invert} colour={row.colours.foreground} /></View>
                <Text style={styles.name}>{row.name}</Text></View>
              <View style={styles.controls}>
                <Button quiet label={`Decrease ${row.name}`} disabled={row.value <= row.min} onPress={row.decrease} style={styles.counterButton}><Text style={styles.sign}>−</Text></Button>
                <Text accessibilityLiveRegion="polite" accessibilityLabel={`${row.name}: ${row.value}`} style={styles.value}>{row.value}</Text>
                <Button quiet label={`Increase ${row.name}`} disabled={!Number.isSafeInteger(row.value + 1)} onPress={row.increase} style={styles.counterButton}><Text style={styles.sign}>+</Text></Button>
              </View>
            </View>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { backgroundColor: theme.paper, paddingHorizontal: 10 }, triggerText: { color: theme.ink, fontSize: 12 },
  overlay: { flex: 1 }, menu: { position: 'absolute', backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 6, padding: 8, elevation: 8,
    boxShadow: '0 8px 30px #29272333' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4 }, title: { color: theme.ink, fontFamily: theme.serif, fontSize: 20 },
  close: { borderWidth: 0, padding: 0 }, closeText: { color: theme.ink, fontSize: 24 }, rows: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: theme.line },
  rowHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  icon: { width: 30, height: 30, borderWidth: 1, borderColor: '#000000', borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  name: { color: theme.ink, fontSize: 12, flexShrink: 1 }, controls: { flexDirection: 'row', alignItems: 'center' },
  counterButton: { width: 44, padding: 0, borderWidth: 0, backgroundColor: theme.panel }, sign: { color: theme.ink, fontSize: 22 },
  value: { minWidth: 26, color: theme.ink, fontSize: 16, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
