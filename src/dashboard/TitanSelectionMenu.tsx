import { router } from 'expo-router';
import { inventoryAllowsTitan } from '../domain/inventory';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { Sheet } from '../components/Sheet';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign';
import type { Argonaut } from '../domain/party';
import { titanVariantDisplayName as titanDisplayName, titanOptionCards } from '../domain/titan-selection';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { ArgoBredWarning } from './ArgoBredWarning';

/** Compact title/cycle list matches the approved picker; selecting immediately updates the column. */
export function TitanSelectionMenu({ argonaut, onClose }: { argonaut: Argonaut; onClose: () => void }) {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), spoilers = useSpoilers();
  const [removing, setRemoving] = useState(false);
  const cycle = campaignCycle(party);
  const cards = titanOptionCards(catalogue.search({ family: 'Titan' }), cycle, argonaut.titan).filter(card => card.id === argonaut.titan?.definitionId || (!spoilers.hidden(card) || party.inventory?.titans.includes(card.id)) && card.faces.some(face => inventoryAllowsTitan(party, card.id, face.id, catalogue)));
  const selected = argonaut.titan && catalogue.getFace(argonaut.titan.definitionId, argonaut.titan.faceId);
  if (removing) return <RemovalConfirmation subject={selected ? titanDisplayName(selected) : 'the selected Titan'}
    detail="This removes the Titan from this Argonaut." onCancel={() => setRemoving(false)} onConfirm={() => {
      dispatch({ type: 'titan', argonautId: argonaut.id, titan: null }); onClose();
    }} />;
  return <Sheet visible title="Choose Titan" onClose={onClose}>
    <ArgoBredWarning />
    {party.inventory?.enforce && <><Text style={styles.cycle}>Showing acquired Titans and Dreamwalker variants through this campaign’s cycle.</Text><Button quiet label="Manage available Titans on Argo" onPress={() => { onClose(); router.push('/argo'); }} /></>}
    {cards.map(card => {
      const face = card.faces.find(face => face.kind === 'titan' && isFaceAvailableInCycle(face, cycle));
      if (!face) return null;
      const active = card.id === argonaut.titan?.definitionId;
      return <Button key={card.id} quiet role="radio" selected={card.id === argonaut.titan?.definitionId} label={`${titanDisplayName(face)} · ${face.cycle}`}
        onPress={() => {
          dispatch({ type: 'titan', argonautId: argonaut.id, titan: argonaut.titan?.definitionId === card.id ? { ...argonaut.titan, faceId: face.id }
            : { id: `${argonaut.id}:titan`, definitionId: card.id, faceId: face.id, exhausted: false, enabledEffectIds: [], counters: {} } });
          onClose();
        }} style={[styles.choice, active && styles.active]}>
        <Text style={[styles.name, active && styles.activeText]}>{titanDisplayName(face)}</Text><Text style={[styles.cycle, active && styles.activeText]}>{face.cycle}</Text>
      </Button>;
    })}
    {cards.length === 0 && <Text style={styles.cycle}>No Titans available in this campaign cycle.</Text>}
    {argonaut.titan && <View style={styles.remove}><Button quiet label="Remove Titan" onPress={() => setRemoving(true)} /></View>}
  </Sheet>;
}
const styles = StyleSheet.create({
  choice: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, backgroundColor: theme.paper },
  active: { backgroundColor: theme.charcoal }, activeText: { color: theme.white },
  name: { flexShrink: 1, color: theme.ink, fontSize: 16 }, cycle: { color: theme.muted, fontSize: 12 }, remove: { marginTop: 12 },
});
