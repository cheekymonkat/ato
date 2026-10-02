import { Redirect } from 'expo-router';
import { useParty } from '../state/PartyProvider';

export default function Index() {
  const { party } = useParty();
  return <Redirect href={{ pathname: '/argonaut/[id]', params: { id: party.activeArgonautId } }} />;
}
