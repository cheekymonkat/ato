import { Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { titanLoadoutRules } from '../domain/hand-rules';
import type { Argonaut } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';

export function TitanLoadoutChoice({ argonaut }: { argonaut: Argonaut }) {
  const { dispatch } = useParty(), rules = titanLoadoutRules(argonaut, getCatalogue());
  if (!rules?.alternative || !argonaut.titan) return null;
  const titan = argonaut.titan, support = titan.loadoutMode === 'support';
  return <View style={{ gap: 6 }}>
    <Text style={{ color: theme.ink, fontSize: 12 }}>Six-Armed · Choose loadout capacity</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button quiet role="radio" selected={!support} label={`${rules.handSlots} weapon slots · ${rules.supportSlots} Support`}
        onPress={() => dispatch({ type: 'titan-loadout-mode', argonautId: argonaut.id, instanceId: titan.id, mode: 'weapons' })} />
      <Button quiet role="radio" selected={support} label={`${rules.alternative.handSlots} weapon slots · ${rules.alternative.supportSlots} Support`}
        onPress={() => dispatch({ type: 'titan-loadout-mode', argonautId: argonaut.id, instanceId: titan.id, mode: 'support' })} />
    </View>
  </View>;
}
