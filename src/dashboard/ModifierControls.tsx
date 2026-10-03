import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { CardIcon } from '../components/cards/CardIcon';
import type { Argonaut } from '../domain/party';
import type { CombatModifier } from '../domain/combat-modifiers';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';

export function ModifierControls({ argonaut }: { argonaut: Argonaut }) {
  const { dispatch } = useParty();
  return <View testID="combat-modifiers" style={styles.controls}>{(['precision', 'speed'] as CombatModifier[]).map(modifier => {
    const value = argonaut.combatModifiers?.[modifier] ?? 0, name = modifier === 'precision' ? 'Precision' : 'Speed';
    const change = (delta: -1 | 1) => dispatch({ type: 'combat-modifier', argonautId: argonaut.id, modifier, delta });
    return <View key={modifier} style={styles.counter}>
      <CardIcon name={name} size={22} />
      <Button quiet label={`Decrease ${name} modifier`} onPress={() => change(-1)} disabled={!Number.isSafeInteger(value - 1)} style={styles.button}><Text style={styles.sign}>−</Text></Button>
      <Text accessibilityLiveRegion="polite" accessibilityLabel={`${name} modifier ${value}`} style={styles.value}>{value}</Text>
      <Button quiet label={`Increase ${name} modifier`} onPress={() => change(1)} disabled={!Number.isSafeInteger(value + 1)} style={styles.button}><Text style={styles.sign}>+</Text></Button>
    </View>;
  })}</View>;
}
const styles = StyleSheet.create({
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 10, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 5 },
  value: { minWidth: 24, textAlign: 'center', color: theme.ink, fontSize: 15, fontWeight: '600' },
  sign: { color: theme.ink, fontSize: 20 }, button: { borderWidth: 0, paddingHorizontal: 0 },
});
