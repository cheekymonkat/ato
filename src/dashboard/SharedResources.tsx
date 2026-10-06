import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Counter } from '../components/Counter';
import { Sheet } from '../components/Sheet';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { getCatalogue } from '../catalogue';
import { argoResourceDefinition, argoTrack } from '../domain/argo';

export function SharedResources({ owner }: { owner: string }) {
  const { party, dispatch } = useParty(), [open, setOpen] = useState(false), [name, setName] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const entries = Object.entries(party.resources).filter(([label]) => argoResourceDefinition(label)?.id !== 'knowledge'), clean = name.trim();
  function resourceTrack(label: string) {
    const definition = argoResourceDefinition(label);
    return definition ? argoTrack(party, definition, getCatalogue()) : undefined;
  }
  const adding = resourceTrack(clean), atLimit = adding?.limit != null && adding.value >= adding.limit;
  const knowledge = argoResourceDefinition(clean)?.id === 'knowledge';
  const canAdd = Boolean(clean && !Object.hasOwn(party.resources, clean) && !atLimit && !knowledge);
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.title}>Shared resources</Text>
    <Text style={styles.meta}>{entries.map(([label, amount]) => `${label} ${amount}`).join(' · ') || 'No shared resources'}</Text>
    <Button quiet label="Manage shared resources" onPress={() => setOpen(true)} />
    {open && (removing !== null ? <RemovalConfirmation title="Remove resource" subject={removing}
      detail="This removes the resource and its amount from the shared campaign pool." onCancel={() => setRemoving(null)}
      onConfirm={() => { dispatch({ type: 'remove-resource', argonautId: owner, name: removing }); setRemoving(null); }} />
      : <Sheet visible title="Shared resources" subtitle="One party-wide pool, shared by all four Argonauts." onClose={() => setOpen(false)}>
      {entries.map(([label, amount]) => {
        const track = resourceTrack(label);
        return <View key={label} style={styles.resource}>
          <View style={{ flexDirection: 'row' }}><Counter compact name={label} value={track?.value ?? amount} max={track?.limit ?? Number.MAX_SAFE_INTEGER}
            onDecrease={() => dispatch({ type: 'resource', argonautId: owner, name: label, delta: -1 })}
            onIncrease={() => dispatch({ type: 'resource', argonautId: owner, name: label, delta: 1 })} /></View>
          <Button quiet label={`Remove shared resource ${label}`} onPress={() => setRemoving(label)} />
        </View>;
      })}
      <TextInput accessibilityLabel="Shared resource name" placeholder="Resource name" value={name} onChangeText={setName} maxLength={80} style={styles.input} />
      {knowledge && <Text style={styles.meta}>Argo Knowledge is managed on the Argo page.</Text>}
      <Button label="Add shared resource" disabled={!canAdd} onPress={() => {
        if (canAdd) { dispatch({ type: 'resource', argonautId: owner, name: clean, delta: 1 }); setName(''); }
      }} />
      <Button quiet label="Reset shared resource amounts"
        disabled={!entries.some(([, value]) => value !== 0)} onPress={() => dispatch({ type: 'reset-resources', argonautId: owner })} />
    </Sheet>)}
  </View>;
}
const styles = StyleSheet.create({ panel: { padding: 12, gap: 8, borderWidth: 1, borderColor: theme.line, borderRadius: 6, backgroundColor: theme.paper }, title: { color: theme.ink, fontFamily: theme.serif, fontSize: 18 }, meta: { color: theme.muted, fontSize: 12, lineHeight: 18 }, resource: { gap: 8 }, input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.line, borderRadius: 5, color: theme.ink, fontSize: 16 } });
