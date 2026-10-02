import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { getCatalogue } from '../../catalogue';
import { Dashboard } from '../../dashboard/Dashboard';
import { armourFixture } from '../../dashboard/model';
import { useParty } from '../../state/PartyProvider';

export default function ArgonautScreen() {
  const { id, fixture } = useLocalSearchParams<{ id: string; fixture?: string }>();
  const { party, dispatch } = useParty();
  const applied = useRef('');
  const argonaut = party.argonauts.find(member => member.id === id);
  const argonautId = argonaut?.id;
  const selectArgonaut = useCallback((nextId: string) => router.replace({ pathname: '/argonaut/[id]', params: { id: nextId } }), []);
  useEffect(() => {
    if (argonautId) dispatch({ type: 'select', argonautId });
  }, [argonautId, dispatch]);
  useEffect(() => {
    if (__DEV__ && argonaut && fixture && applied.current !== `${id}:${fixture}`) {
      const loadout = armourFixture(fixture, id, getCatalogue());
      if (loadout) { applied.current = `${id}:${fixture}`; dispatch({ type: 'preview-loadout', argonautId: id, ...loadout }); }
    }
  }, [id, fixture, argonaut, dispatch]);
  if (!argonaut) return <Redirect href={{ pathname: '/argonaut/[id]', params: { id: party.activeArgonautId } }} />;
  return <Dashboard key={id} argonaut={argonaut} onSelect={selectArgonaut} />;
}
