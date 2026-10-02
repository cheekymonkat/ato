import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../theme/tokens';
import { SwipeGuard } from './SwipeSurface';

export function Button({ label, onPress, disabled = false, children, style, quiet = false, role = 'button', selected }: {
  label: string; onPress: () => void; disabled?: boolean; children?: ReactNode;
  style?: StyleProp<ViewStyle>; quiet?: boolean; role?: AccessibilityRole; selected?: boolean;
}) {
  return <SwipeGuard><Pressable accessibilityRole={role} accessibilityLabel={label}
    accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, quiet && styles.quiet, style, disabled && styles.disabled, pressed && styles.pressed]}>
    {children || <Text style={[styles.label, quiet && styles.quietLabel]}>{label}</Text>}
  </Pressable></SwipeGuard>;
}
const styles = StyleSheet.create({
  button: { minHeight: 44, minWidth: 44, borderRadius: 5, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.charcoal, alignItems: 'center', justifyContent: 'center' },
  quiet: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.line },
  label: { color: theme.white, fontSize: 14, fontWeight: '600' }, quietLabel: { color: theme.ink },
  pressed: { opacity: 0.65 }, disabled: { opacity: 0.35 },
});
