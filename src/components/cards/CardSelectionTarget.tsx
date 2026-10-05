import { useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { PressableProps } from 'react-native';
import { theme } from '../../theme/tokens';

/** Whole-card selection can contain keyword links and ability buttons.
 * On web, a separate keyboard button leaves those actions outside its DOM subtree.
 * The content group handles pointer selection; child actions stop propagation.
 */
export function CardSelectionTarget({ label, hint, onPress, children, style }: {
  label: string; hint?: string; onPress: () => void; children: ReactNode; style?: PressableProps['style'];
}) {
  const [focused, setFocused] = useState(false);
  if (Platform.OS !== 'web') return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={hint} onPress={onPress} style={style}>{children}</Pressable>;
  return <View style={[styles.container, focused && styles.focused]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onPress={event => { event.stopPropagation(); onPress(); }} style={styles.keyboardTarget} />
    <Pressable role="group" accessibilityLabel={label} tabIndex={-1}
      onPress={onPress} style={style}>{children}</Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { minWidth: 0, position: 'relative' },
  keyboardTarget: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  focused: { outlineStyle: 'solid', outlineWidth: 2, outlineColor: theme.gold, outlineOffset: 2 },
});
