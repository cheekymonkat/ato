import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ColourBrightness, ColourWheel } from '../components/ColourWheel';
import { Sheet } from '../components/Sheet';
import { hexToHsv, hsvToHex } from '../domain/colour-picker';
import type { HsvColour } from '../domain/colour-picker';
import { argonautColourBackground, textOnColour, theme } from '../theme/tokens';

export function ColourPicker({ colour, onSelect, onClose }: { colour: string; onSelect: (colour: string) => void; onClose: () => void }) {
  const [selection, setSelection] = useState(() => hexToHsv(colour));
  const selectedColour = hsvToHex(selection);
  const chooseWheel = useCallback((next: Pick<HsvColour, 'hue' | 'saturation'>) => setSelection(previous => ({
    ...previous, ...next, hue: next.saturation === 0 ? previous.hue : next.hue,
  })), []);
  const chooseBrightness = useCallback((value: number) => setSelection(previous => ({ ...previous, value })), []);
  const adjust = (key: keyof HsvColour, delta: number) => setSelection(previous => ({ ...previous,
    [key]: key === 'hue' ? (previous.hue + delta + 360) % 360 : Math.max(0, Math.min(1, previous[key] + delta)),
  }));
  return <Sheet visible title="Argonaut colour" subtitle="Drag around the wheel to choose a colour. Move towards the centre for softer colours." onClose={onClose}>
    <ColourWheel colour={selection} onChange={chooseWheel} />
    <View style={styles.previewRow}>
      <View testID="selected-colour-preview" style={[styles.preview, { backgroundColor: selectedColour }]}>
        <Text style={[styles.previewText, { color: textOnColour(selectedColour) }]}>Selected colour</Text>
      </View>
      <View testID="triskelion-colour-preview" style={[styles.preview, { backgroundColor: argonautColourBackground(selectedColour) }]}>
        <Text style={styles.previewText}>Triskelion tint</Text>
      </View>
    </View>
    <View style={styles.adjustments}>
      <Adjustment name="Hue" value={`${Math.round(selection.hue)}°`} onDecrease={() => adjust('hue', -1)} onIncrease={() => adjust('hue', 1)} />
      <Adjustment name="Saturation" value={`${Math.round(selection.saturation * 100)}%`} minimum={selection.saturation === 0} maximum={selection.saturation === 1}
        onDecrease={() => adjust('saturation', -0.01)} onIncrease={() => adjust('saturation', 0.01)} />
      <Adjustment name="Brightness" value={`${Math.round(selection.value * 100)}%`} minimum={selection.value === 0} maximum={selection.value === 1}
        onDecrease={() => adjust('value', -0.01)} onIncrease={() => adjust('value', 0.01)} />
      <ColourBrightness colour={selection} onChange={chooseBrightness} />
    </View>
    <View style={styles.actions}>
      <View style={styles.action}><Button quiet label="Cancel" onPress={onClose} /></View>
      <View style={styles.action}><Button label="Use colour" onPress={() => onSelect(selectedColour)} /></View>
    </View>
  </Sheet>;
}

function Adjustment({ name, value, onDecrease, onIncrease, minimum = false, maximum = false }: {
  name: string; value: string; onDecrease: () => void; onIncrease: () => void; minimum?: boolean; maximum?: boolean;
}) {
  return <View style={styles.adjustment}>
    <Text style={styles.label}>{name}</Text>
    <View style={styles.controls}>
      <Button quiet label={`Decrease ${name.toLowerCase()}`} disabled={minimum} onPress={onDecrease} style={styles.step}><Text style={styles.sign}>−</Text></Button>
      <Text accessibilityLabel={`${name}: ${value}`} style={styles.value}>{value}</Text>
      <Button quiet label={`Increase ${name.toLowerCase()}`} disabled={maximum} onPress={onIncrease} style={styles.step}><Text style={styles.sign}>+</Text></Button>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  previewRow: { flexDirection: 'row', gap: 8 }, preview: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 5, borderWidth: 1, borderColor: theme.line, padding: 8 },
  previewText: { color: theme.ink, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  adjustments: { gap: 4 }, adjustment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  label: { color: theme.ink, fontSize: 12, flex: 1 }, controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  step: { width: 44, padding: 0, borderWidth: 0, backgroundColor: theme.panel }, sign: { color: theme.ink, fontSize: 22 },
  value: { minWidth: 42, textAlign: 'center', color: theme.ink, fontSize: 13, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1 },
});
