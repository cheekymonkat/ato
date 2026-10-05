import { StyleSheet, Text } from 'react-native';
import { getCatalogue } from '../catalogue';
import { argoBredConflicts } from '../domain/titan-selection';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';

/** Derived from all four Argonauts, so it also covers restored campaigns. */
export function ArgoBredWarning() {
  const { party } = useParty();
  const conflicts = argoBredConflicts(party, getCatalogue());
  if (!conflicts.length) return null;
  const details = conflicts.map(({ name, argonauts }) => {
    const owners = argonauts.map(argonaut => argonaut.name || `Argonaut ${party.order.indexOf(argonaut.id) + 1}`).join(', ');
    return `${name}: ${argonauts.length} selected by ${owners}.`;
  }).join('\n');
  return <Text testID="argo-bred-warning" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.warning}>
    {`Duplicate Argo-bred Titan type:\n${details}\nOnly one of each Argo-bred Titan type is allowed across the Argonauts. Different types can coexist; Dreamwalker types may repeat.`}
  </Text>;
}
const styles = StyleSheet.create({
  warning: { color: theme.danger, backgroundColor: '#F3E5E3', borderWidth: 1, borderColor: theme.danger, borderRadius: 6, padding: 12, fontSize: 13, lineHeight: 20 },
});
