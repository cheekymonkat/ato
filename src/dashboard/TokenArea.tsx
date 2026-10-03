import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Counter } from '../components/Counter';
import { CardIcon } from '../components/cards/CardIcon';
import type { Argonaut } from '../domain/party';
import { campaignCycle, tokenCount, tokenTypesForCycle, isTokenName } from '../domain/tokens';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { SectionHeading } from './EquipmentArea';
import { TokenRules } from './TokenRules';

export function TokenArea({ argonaut }: { argonaut: Argonaut }) {
  const { party, dispatch } = useParty(), cycle = campaignCycle(party);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const other = Object.entries(argonaut.tokens).filter(([name]) => !isTokenName(name));
  return <View testID="token-section">
    <SectionHeading title="Tokens" />
    <View style={styles.panel}>
      <Text style={styles.label}>Campaign cycle {cycle}</Text>
      <View style={styles.counters}>{tokenTypesForCycle(cycle).map(({ name }) => <Counter key={name} compact
        icon={<CardIcon name={name} size={22} />} name={name} value={tokenCount(argonaut, name)} max={Number.MAX_SAFE_INTEGER}
        onDecrease={() => dispatch({ type: 'token', argonautId: argonaut.id, token: name, delta: -1 })}
        onIncrease={() => dispatch({ type: 'token', argonautId: argonaut.id, token: name, delta: 1 })} />)}</View>
      {other.length > 0 && <Text style={styles.other}>{other.map(([name, count]) => `${name} ${count}`).join(' · ')}</Text>}
      <Button quiet label="Reset this Argonaut’s tokens"
        disabled={!Object.values(argonaut.tokens).some(value => value !== 0)} onPress={() => dispatch({ type: 'reset-tokens', argonautId: argonaut.id })} />
      <Button quiet label="Token reference" onPress={() => setReferenceOpen(true)} />
    </View>
    {referenceOpen && <TokenRules onClose={() => setReferenceOpen(false)} />}
  </View>;
}
const styles = StyleSheet.create({
  panel: { backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 6, padding: 12, gap: 8 },
  label: { color: theme.muted, fontSize: 12, fontWeight: '600' },
  counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  other: { color: theme.muted, fontSize: 12, lineHeight: 18 },
});
