import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardIcon } from '../components/cards/CardIcon';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { SwipeGuard } from '../components/SwipeSurface';
import { afflictionRecords } from '../domain/afflictions';
import type { AfflictionId } from '../domain/afflictions';
import { conditionRecords } from '../domain/conditions';
import type { Argonaut } from '../domain/party';
import { isTokenName, TOKEN_TYPES, tokenCount } from '../domain/tokens';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { ConditionEditor } from './ConditionEditor';
import { AFFLICTION_COLOURS, CONDITION_COLOURS, modifierColours, tokenColours } from './status-colours';
import { TokenMenu } from './TokenMenu';
import { TokenDetails } from './TokenRules';
import type { StatusColours } from './status-colours';

export function StatusBar({ argonaut }: { argonaut: Argonaut }) {
  const { dispatch, party } = useParty();
  const [rowWidth, setRowWidth] = useState<number | undefined>(undefined);
  const [tokenName, setTokenName] = useState<string | null>(null);
  const [conditionId, setConditionId] = useState<string | null>(null);
  const [afflictionId, setAfflictionId] = useState<AfflictionId | null>(null), [removing, setRemoving] = useState(false);
  const conditions = conditionRecords(argonaut), condition = conditions.find(record => record.id === conditionId);
  const afflictions = afflictionRecords(argonaut), affliction = afflictions.find(record => record.id === afflictionId);
  return <View testID="argonaut-status-bar" onLayout={event => {
    if (event.nativeEvent.layout.width > 0) setRowWidth(event.nativeEvent.layout.width);
  }} style={styles.row}>
    <View style={styles.labels}>
      {conditions.map(record => <View key={record.id} style={styles.labelContainer}><SwipeGuard><Pressable accessibilityRole="button" accessibilityLabel={`View condition ${record.name}`} onPress={() => setConditionId(record.id)}
        testID={`condition-label-${record.id}`} style={[styles.label, { backgroundColor: CONDITION_COLOURS.background }]}>
        <Text style={[styles.text, { color: CONDITION_COLOURS.foreground }]}>{record.name}</Text>
      </Pressable></SwipeGuard></View>)}
      {afflictions.map(record => <View key={record.id} style={styles.labelContainer}><SwipeGuard><Pressable accessibilityRole="button" accessibilityLabel={`View affliction ${record.name}`} onPress={() => { setAfflictionId(record.id); setRemoving(false); }}
        testID={`affliction-label-${record.id}`} style={[styles.label, { backgroundColor: AFFLICTION_COLOURS.background }]}>
        <Text style={[styles.text, { color: AFFLICTION_COLOURS.foreground }]}>{record.name}</Text>
      </Pressable></SwipeGuard></View>)}
      {(['precision', 'speed'] as const).map(modifier => {
        const value = argonaut.combatModifiers?.[modifier] ?? 0, colours = modifierColours(value), name = modifier === 'precision' ? 'Precision' : 'Movement';
        return value !== 0 && <TokenBadge key={modifier} testID={`modifier-notification-${modifier}`} name={name} icon={modifier === 'precision' ? 'Precision' : 'Speed'}
          value={`${value > 0 ? '+' : ''}${value}`} colours={colours} onPress={() => setTokenName(name)} />;
      })}
      {TOKEN_TYPES.map(({ name }) => {
        const count = tokenCount(argonaut, name), colours = tokenColours(name);
        return count > 0 && <TokenBadge key={name} testID={`token-notification-${name}`} name={name} icon={name}
          value={String(count)} colours={colours} onPress={() => setTokenName(name)} />;
      })}
      {Object.entries(argonaut.tokens).filter(([name, count]) => !isTokenName(name) && count > 0).map(([name, count]) => <TokenBadge key={name}
        name={name} value={`${name} ${count}`} colours={tokenColours(name)} onPress={() => setTokenName(name)} />)}
    </View>
    <TokenMenu argonaut={argonaut} maxWidth={rowWidth} />
    {tokenName && <TokenDetails name={tokenName} value={tokenName === 'Precision' ? argonaut.combatModifiers?.precision ?? 0
      : tokenName === 'Movement' ? argonaut.combatModifiers?.speed ?? 0 : argonaut.tokens[tokenName] ?? 0} onClose={() => setTokenName(null)} />}
    {condition && <ConditionEditor selected={condition} records={conditions} onClose={() => setConditionId(null)} onRemove={() => {
      dispatch({ type: 'remove-condition', argonautId: argonaut.id, id: condition.id }); setConditionId(null);
    }} onSave={record => { dispatch({ type: 'condition', argonautId: argonaut.id, condition: record }); setConditionId(null); }} />}
    {affliction && (removing ? <RemovalConfirmation title="Remove affliction" itemType="affliction" subject={affliction.name} onCancel={() => setRemoving(false)} onConfirm={() => {
      dispatch({ type: 'remove-affliction', argonautId: argonaut.id, partyId: party.id, id: affliction.id, confirmed: true }); setAfflictionId(null); setRemoving(false);
    }} /> : <Sheet visible title={affliction.name} subtitle={`Cycle ${affliction.cycle}`} onClose={() => setAfflictionId(null)}>
      <Text style={styles.description}>{affliction.description}</Text>
      <Button quiet label="Remove affliction" onPress={() => setRemoving(true)} />
    </Sheet>)}
  </View>;
}
function TokenBadge({ name, icon, value, colours, onPress, testID }: {
  name: string; icon?: string; value: string; colours: StatusColours; onPress: () => void; testID?: string;
}) {
  return <View style={styles.labelContainer}><SwipeGuard><Pressable accessibilityRole="button" accessibilityLabel={`View ${name} details: ${value}`}
    accessibilityLiveRegion="polite" testID={testID} onPress={onPress} style={[styles.label, { backgroundColor: colours.background }]}>
    {icon && <CardIcon name={icon} size={18} invert={colours.invert} colour={colours.foreground} />}
    <Text style={[styles.text, { color: colours.foreground }]}>{value}</Text>
  </Pressable></SwipeGuard></View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12, marginBottom: 16 },
  labels: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  labelContainer: { maxWidth: '100%', flexShrink: 1 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, borderWidth: 1, borderColor: '#000000', borderRadius: 3, paddingVertical: 6, paddingHorizontal: 8, maxWidth: '100%' },
  text: { fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1, fontVariant: ['tabular-nums'] }, description: { color: theme.ink, fontSize: 14, lineHeight: 22 },
});
