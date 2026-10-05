import { StyleSheet, Text } from 'react-native';
import { Button } from '../Button';
import { theme } from '../../theme/tokens';
import { CardIcon } from './CardIcon';
import { CardColours } from './CardColours';

/** Shared compact Gear-style controls, with the card name available to screen readers. */
export function CardActionButton({ action, cardName, onPress, disabled, icon, active }: {
  action: string; cardName?: string; onPress: () => void; disabled?: boolean; icon?: string; active?: boolean;
}) {
  return <Button quiet label={cardName ? `${action} ${cardName}` : action} style={[styles.button, icon && styles.iconButton]} disabled={disabled} selected={active} onPress={onPress}>
    {icon ? <CardColours exhausted={false}><CardIcon name={icon} size={22} tint={active ? '#B42332' : theme.ink} /></CardColours> : <Text style={styles.label}>{action}</Text>}
  </Button>;
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 10, paddingVertical: 8 },
  iconButton: { paddingHorizontal: 8 },
  label: { color: theme.ink, fontSize: 12, fontWeight: '600' },
});
