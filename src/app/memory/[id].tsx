import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { MemoryEditor } from '../../memories/MemoryEditor';
import { useParty } from '../../state/PartyProvider';
import { getCatalogue } from '../../catalogue';
import { loadoutState } from '../../domain/loadout';

export default function MemoryScreen() {
  const params = useLocalSearchParams<{ id: string; kind?: string; index?: string }>(), { party } = useParty();
  const argonaut = party.argonauts.find(member => member.id === params.id), index = Number(params.index);
  const kind = params.kind === 'mnemos' || params.kind === 'fated-mnemos' ? params.kind : null;
  const count = kind && argonaut ? Math.max(loadoutState(argonaut, getCatalogue()).positions.filter(position => position.kind === kind).length,
    kind === 'mnemos' ? argonaut.mnemosIds.length : argonaut.fatedMnemosIds.length) : 0;
  return argonaut && kind && Number.isSafeInteger(index) && index >= 0 && index < count
    ? <MemoryEditor key={`${argonaut.id}:${kind}:${index}`} argonaut={argonaut} kind={kind} index={index} />
    : <View style={{ padding: 24, gap: 20 }}><Text>Memory position unavailable.</Text><Button label="Return to Argo" onPress={() => router.replace('/argo')} /></View>;
}
