import { StyleSheet, Text } from 'react-native';
import { Button } from '../Button';
import { theme } from '../../theme/tokens';

/** Shared compact Gear-style controls, with the card name available to screen readers. */
export function CardActionButton({ action, cardName, onPress, disabled }: {
  action: string; cardName?: string; onPress: () => void; disabled?: boolean;
}) {
  return <Button quiet label={cardName ? `${action} ${cardName}` : action} style={styles.button} disabled={disabled} onPress={onPress}>
    <Text style={styles.label}>{action}</Text>
  </Button>;
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 10, paddingVertical: 8 },
  label: { color: theme.ink, fontSize: 12, fontWeight: '600' },
});
