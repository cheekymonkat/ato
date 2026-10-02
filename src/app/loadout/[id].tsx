import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { EquipmentEditor } from '../../loadout/EquipmentEditor';
import { Button } from '../../components/Button';
import { useParty } from '../../state/PartyProvider';

export default function LoadoutScreen() {
  const params = useLocalSearchParams<{ id: string; position?: string; instance?: string; definition?: string; face?: string; q?: string; cycle?: string }>();
  const { party } = useParty();
  const argonaut = party.argonauts.find(member => member.id === params.id);
  return argonaut ? <EquipmentEditor key={`${params.id}:${params.instance || params.position || ''}`} argonaut={argonaut} params={params} /> : <View style={{ padding: 24, gap: 20 }}>
    <Text>Argonaut unavailable.</Text><Button label="Return to party" onPress={() => router.replace('/')} />
  </View>;
}
