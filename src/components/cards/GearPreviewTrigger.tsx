import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { Sheet } from '../Sheet';
import { GearPreviewContent } from './GearPreviewContent';
import type { GearPreviewProps } from './GearPreviewContent';

/** Native touch fallback; web uses the anchored hover implementation. */
export function GearPreviewTrigger(props: GearPreviewProps) {
  const [open, setOpen] = useState(false), { width } = useWindowDimensions();
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Preview ${props.label}`} onPress={() => setOpen(true)}>
      <Text style={styles.link}>{props.label}</Text>
    </Pressable>
    {open && <Sheet visible title="Gear preview" maxWidth={368} onClose={() => setOpen(false)}>
      <GearPreviewContent {...props} width={Math.min(320, width - 88)} onReference={(id, name) => { setOpen(false); props.onReference?.(id, name); }} />
    </Sheet>}
  </>;
}
const styles = StyleSheet.create({ link: { color: '#89E2EC', textDecorationLine: 'underline', fontSize: 13, lineHeight: 19 } });
