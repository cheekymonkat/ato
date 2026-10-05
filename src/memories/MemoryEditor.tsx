import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { GateAssistance } from '../components/cards/GateAssistance';
import { CardActionButton } from '../components/cards/CardActionButton';
import { CardActionRow } from '../components/cards/CardActionRow';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { fatedMemorySide } from '../domain/memory-presentation';
import { loadoutState } from '../domain/loadout';
import { canDiscardMemory, memoryAt, memoryConflict, memoryFamily, memoryProgress } from '../domain/memories';
import type { MemoryKind } from '../domain/memories';
import type { Argonaut } from '../domain/party';
import { ReferencePicker } from '../references/ReferencePicker';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { NodeTracker } from './NodeTracker';

export function MemoryEditor({ argonaut, kind, index }: { argonaut: Argonaut; kind: MemoryKind; index: number }) {
  const catalogue = getCatalogue(), { party, dispatch } = useParty(), spoilers = useSpoilers();
  const item = memoryAt(argonaut, kind, index), card = item && catalogue.get(item.definitionId), face = item && catalogue.getFace(item.definitionId, item.faceId);
  const [choosing, setChoosing] = useState(!item);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [newId] = useState(() => `${argonaut.id}:memory:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  const capacity = loadoutState(argonaut, catalogue).positions.filter(position => position.kind === kind).length;
  const hidden = card && spoilers.hidden(card), progress = item && memoryProgress(item);
  const actionName = hidden ? 'unrevealed card' : (face?.kind === 'fated-mnemos' ? fatedMemorySide(face, progress).name : face?.name) || 'card';
  const target = { argonautId: argonaut.id, kind, index };
  const unavailable = (reference: { definitionId: string }) => {
    const owner = memoryConflict(party, reference.definitionId, target);
    return owner ? `Already assigned to ${owner.argonautName || 'Argonaut'} (${memoryFamily(owner.kind)} ${owner.index + 1}). Remove it there before assigning here.` : undefined;
  };
  const otherFace = card?.faces.find(side => side.id !== item?.faceId && side.kind === kind);
  const back = () => router.replace({ pathname: '/argonaut/[id]', params: { id: argonaut.id } });
  const remove = () => { dispatch({ type: 'remove-memory', argonautId: argonaut.id, kind, index }); back(); };
  if (removing) return <RemovalConfirmation subject={removing.name} detail="This removes the memory and its recorded nodes from this Argonaut."
    onCancel={() => setRemoving(null)} onConfirm={() => { if (item?.id === removing.id) remove(); else setRemoving(null); }} />;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}><ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.page}>
    <Button quiet label="Back to Argonaut" onPress={back} />
    <Text accessibilityRole="header" style={styles.title}>{memoryFamily(kind)} {index + 1}</Text>
    <Text style={styles.meta}>{argonaut.name}</Text>
    {index >= capacity && <Text style={styles.warning}>This memory is outside current capacity. Remove it or keep its recorded progress.</Text>}
    {item && unavailable(item) && <Text style={styles.warning}>{unavailable(item)}</Text>}
    {card && face ? <GateAssistance enabled={party.rulesAssistance === true} argonaut={argonaut}><ReferenceCard card={card} face={face} exhausted={Boolean(item?.discarded)} memoryProgress={progress} instance={item} onAbilityExhausted={item ? (abilityId, exhausted) => dispatch({ type: 'ability-exhausted', argonautId: argonaut.id, instanceId: item.id, definitionId: item.definitionId, faceId: item.faceId, abilityId, exhausted }) : undefined} /></GateAssistance>
      : <Text style={styles.meta}>{item ? 'The saved memory reference is unavailable. Its progress has been kept.' : 'Choose a memory for this position.'}</Text>}
    {item && <NodeTracker argonautId={argonaut.id} instance={item} label={`${memoryFamily(kind)} ${index + 1}`} kind={kind} />}
    {item?.discarded && <Text style={styles.meta}>Discarded</Text>}
    <CardActionRow>{item && <>
      {(item.discarded || !hidden && canDiscardMemory(face, memoryProgress(item))) && <CardActionButton action={item.discarded ? 'Restore' : 'Discard'} cardName={actionName} onPress={() => dispatch({ type: 'memory-state', argonautId: argonaut.id, instanceId: item.id, discarded: !item.discarded })} />}
      {!hidden && otherFace && <CardActionButton action="Flip" cardName={actionName} onPress={() => dispatch({ type: 'memory-state', argonautId: argonaut.id, instanceId: item.id, faceId: otherFace.id })} />}
    </>}
      <CardActionButton action={item ? 'Change card' : 'Choose card'} disabled={index >= capacity} onPress={() => setChoosing(true)} />
      {item && <CardActionButton action="Remove" cardName={actionName} onPress={() => setRemoving({ id: item.id, name: actionName })} />}
    </CardActionRow>
  </ScrollView>
    {choosing && <ReferencePicker family={memoryFamily(kind)} selected={item} selectedMemoryProgress={progress} unavailable={unavailable} onClose={() => setChoosing(false)} onSelect={reference => {
      if (!reference) { remove(); return; }
      if (unavailable(reference)) return;
      dispatch({ type: 'memory', argonautId: argonaut.id, request: { kind, index, ...reference, instanceId: item?.definitionId === reference.definitionId ? item.id : newId } });
      back();
    }} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.canvas }, page: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontFamily: theme.serif, color: theme.ink }, meta: { fontSize: 13, color: theme.muted, lineHeight: 21 },
  warning: { color: theme.danger, fontSize: 13, lineHeight: 21 },
});
