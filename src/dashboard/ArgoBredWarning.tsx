import { StyleSheet, Text } from 'react-native';
import { getCatalogue } from '../catalogue';
import { argoBredArgonauts } from '../domain/titan-selection';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';

/** Derived from all four Argonauts, so it also covers restored campaigns. */
export function ArgoBredWarning() {
  const { party } = useParty();
  const selected = argoBredArgonauts(party, getCatalogue());
  if (selected.length <= 1) return null;
  const names = selected.map(argonaut => argonaut.name || `Argonaut ${party.order.indexOf(argonaut.id) + 1}`).join(', ');
  return <Text testID="argo-bred-warning" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.warning}>
    {`Argo-bred limit exceeded: ${selected.length} selected. Only 1 Argo-bred Titan is allowed among the Argonauts.\nSelected by: ${names}. Change the extra Titans or remove them.`}
  </Text>;
}
const styles = StyleSheet.create({
  warning: { color: theme.danger, backgroundColor: '#F3E5E3', borderWidth: 1, borderColor: theme.danger, borderRadius: 6, padding: 12, fontSize: 13, lineHeight: 20 },
});
