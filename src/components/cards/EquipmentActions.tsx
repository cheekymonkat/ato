import { StyleSheet, Text, View } from 'react-native';
import type { CardDefinition } from '../../domain/cards';
import type { CardInstance } from '../../domain/party';
import { canDiscardCard, canExhaustCard } from '../../domain/ability-costs';
import { useParty } from '../../state/PartyProvider';
import { useSpoilers } from '../../state/SpoilerProvider';
import { theme } from '../../theme/tokens';
import { Button } from '../Button';
import { CardActionButton } from './CardActionButton';
import { CardActionRow } from './CardActionRow';

/** Immediate actions stay outside the card's edit tap target. Removal lives in the editor. */
export function EquipmentActions({ argonautId, instance, definition }: { argonautId: string; instance: CardInstance; definition?: CardDefinition }) {
  const { dispatch } = useParty(), spoilers = useSpoilers();
  const hidden = definition && spoilers.hidden(definition);
  const face = definition?.faces.find(face => face.id === instance.faceId);
  const name = hidden ? 'unrevealed card' : face?.name || 'card';
  const nextFace = definition?.faces.find(face => face.id !== instance.faceId);
  return <View style={styles.actions}>
    <CardActionRow>
      {!instance.discarded && (instance.exhausted || !hidden && canExhaustCard(face)) && <CardActionButton action={instance.exhausted ? 'Ready' : 'Exhaust'} cardName={name}
        onPress={() => dispatch({ type: 'equipment-exhausted', argonautId, instanceId: instance.id, exhausted: !instance.exhausted })} />}
      {(instance.discarded || !hidden && canDiscardCard(face)) && <CardActionButton action={instance.discarded ? 'Restore' : 'Discard'} cardName={name}
        onPress={() => dispatch({ type: 'equipment-discarded', argonautId, instanceId: instance.id, discarded: !instance.discarded })} />}
      {!hidden && nextFace && <CardActionButton action="Flip" cardName={name}
        onPress={() => dispatch({ type: 'equipment-face', argonautId, instanceId: instance.id, faceId: nextFace.id })} />}
    </CardActionRow>
    {!hidden && face?.slotEffects.filter(effect => effect.activation === 'optional-loadout' || effect.conditions.length).map(effect => <View key={effect.id} style={styles.effect}>
      <Text style={styles.details}>Additional {effect.slot} capacity: {effect.amount}</Text>
      {effect.activation === 'optional-loadout' && <Button quiet
        label={`${instance.enabledEffectIds.includes(effect.id) ? 'Disable' : 'Enable'} additional ${effect.slot}`}
        onPress={() => dispatch({ type: 'equipment-effect', argonautId, instanceId: instance.id, effectId: effect.id, enabled: !instance.enabledEffectIds.includes(effect.id) })} />}
      {effect.conditions.length > 0 && <>
        <Text style={styles.details}>{effect.conditions.map(condition => `${condition.gate} ${condition.value || ''}`).join(' and ')}</Text>
        <Button quiet label={instance.satisfiedEffectIds?.includes(effect.id) ? 'Mark conditions inactive' : 'Confirm conditions satisfied'}
          onPress={() => dispatch({ type: 'equipment-effect', argonautId, instanceId: instance.id, effectId: effect.id, enabled: !instance.satisfiedEffectIds?.includes(effect.id), condition: true })} />
      </>}
      {effect.consequences.map((consequence, index) => <Text key={index} style={styles.warning}>{consequence}</Text>)}
      <Text style={styles.details}>Player-confirmed choice. Token and other consequences remain manual.</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  actions: { gap: 10, padding: 10, paddingTop: 0 },
  effect: { gap: 8, borderTopWidth: 1, borderColor: theme.line, paddingTop: 10 },
  details: { color: theme.muted, fontSize: 11, lineHeight: 17 }, warning: { color: theme.danger, fontSize: 12, lineHeight: 18 },
});
