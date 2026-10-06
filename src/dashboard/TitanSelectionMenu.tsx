import { router } from 'expo-router';
import { inventoryAllowsTitan } from '../domain/inventory';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { TitanStatusConfirmation } from '../campaign/TitanStatusConfirmation';
import { Button } from '../components/Button';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { Sheet } from '../components/Sheet';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign';
import type { Argonaut, TitanRecord } from '../domain/party';
import { titanVariantDisplayName as titanDisplayName, titanOptionCards } from '../domain/titan-selection';
import { useParty } from '../state/PartyProvider';
import type { PartyAction } from '../state/party-reducer';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { ArgoBredWarning } from './ArgoBredWarning';
import { availableRosterTitans, legacyTitanRoster, rosterTitanName, rosterTitanType, sameReference } from '../domain/titan-roster';

type HealthChangeRequest = (titan: TitanRecord, status: 'crippled' | 'dead') => void;

/** Compact title/cycle list matches the approved picker; selecting immediately updates the column. */
export function TitanSelectionMenu({ argonaut, onClose }: { argonaut: Argonaut; onClose: () => void }) {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), spoilers = useSpoilers();
  const [removing, setRemoving] = useState(false);
  const [changing, setChanging] = useState<{ name: string; status: 'crippled' | 'dead'; action: Extract<PartyAction, { type: 'titan-roster' }> } | null>(null);
  const cycle = campaignCycle(party);
  const requestStatus: HealthChangeRequest = (titan, status) => setChanging({ name: rosterTitanName(titan, catalogue), status,
    action: { type: 'titan-roster', partyId: party.id, argonautId: argonaut.id, expectedCycle: cycle,
      edit: { operation: 'status', id: titan.id, status, expected: titan } } });
  if (changing) return <TitanStatusConfirmation key={`${argonaut.id}:${changing.status}`} name={changing.name} status={changing.status}
    onCancel={() => setChanging(null)} onConfirm={() => { dispatch(changing.action); setChanging(null); onClose(); }} />;
  if (party.titanRoster) return <RosterTitanSelection argonaut={argonaut} onClose={onClose} onRequestStatus={requestStatus} />;
  const cards = titanOptionCards(catalogue.search({ family: 'Titan' }), cycle, argonaut.titan).filter(card => card.id === argonaut.titan?.definitionId || (!spoilers.hidden(card) || party.inventory?.titans.includes(card.id)) && card.faces.some(face => inventoryAllowsTitan(party, card.id, face.id, catalogue)));
  const selected = argonaut.titan && catalogue.getFace(argonaut.titan.definitionId, argonaut.titan.faceId);
  if (removing) return <RemovalConfirmation subject={selected ? titanDisplayName(selected) : 'the selected Titan'}
    detail="This removes the Titan from this Argonaut." onCancel={() => setRemoving(false)} onConfirm={() => {
      dispatch({ type: 'titan', argonautId: argonaut.id, titan: null }); onClose();
    }} />;
  return <Sheet visible title="Choose Titan" onClose={onClose}>
    <Text style={styles.cycle}>One Titan per Argonaut. Each Argo-bred type can be selected once across the party; Dreamwalker variants may repeat.</Text>
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
    {argonaut.titan && <View style={styles.remove}>
      <TitanHealthActions argonaut={argonaut} onRequestStatus={requestStatus} />
      <Button quiet label="Remove Titan" onPress={() => setRemoving(true)} />
    </View>}
  </Sheet>;
}
function RosterTitanSelection({ argonaut, onClose, onRequestStatus }: { argonaut: Argonaut; onClose: () => void; onRequestStatus: HealthChangeRequest }) {
  const { party, dispatch } = useParty(), catalogue = getCatalogue();
  const [removing, setRemoving] = useState(false);
  const titans = availableRosterTitans(party, catalogue, argonaut.id);
  const selected = titans.find(titan => titan.id === argonaut.titan?.rosterId) ?? argonaut.titan;
  if (removing) return <RemovalConfirmation subject={selected ? rosterTitanName(selected, catalogue) : 'the selected Titan'}
    detail="This releases the Titan for another Argonaut. It remains Alive in the campaign roster with its Patterns."
    onCancel={() => setRemoving(false)} onConfirm={() => { dispatch({ type: 'titan', partyId: party.id, expectedCycle: campaignCycle(party), argonautId: argonaut.id, titan: null }); onClose(); }} />;
  return <Sheet visible title="Choose Titan" onClose={onClose}>
    <Text style={styles.cycle}>Alive Titans from the campaign roster. One Titan per Argonaut; each individual can be assigned once.</Text>
    <ArgoBredWarning />
    {titans.map((record, index) => {
      const active = record.id === argonaut.titan?.rosterId, name = rosterTitanName(record, catalogue);
      const typeName = rosterTitanType(record, catalogue);
      const trauma = record.patterns.trauma && catalogue.getFace(record.patterns.trauma.definitionId, record.patterns.trauma.faceId)?.name;
      const kratos = record.patterns.kratos && catalogue.getFace(record.patterns.kratos.definitionId, record.patterns.kratos.faceId)?.name;
      return <Button key={record.id} quiet role="radio" selected={active} label={`${name} · Titan ${index + 1}`} style={[styles.choice, active && styles.active]}
        onPress={() => {
          dispatch({ type: 'titan', partyId: party.id, expectedCycle: campaignCycle(party), argonautId: argonaut.id, titan: active ? argonaut.titan : {
            id: `${argonaut.id}:titan`, rosterId: record.id, definitionId: record.definitionId, faceId: record.faceId, exhausted: false, enabledEffectIds: [], counters: {},
          } }); onClose();
        }}>
        <View style={{ flex: 1, gap: 5 }}><Text style={[styles.name, active && styles.activeText]}>{name}</Text>
          {name !== typeName && <Text style={[styles.cycle, active && styles.activeText]}>{typeName}</Text>}
          <Text style={[styles.cycle, active && styles.activeText]}>{trauma || kratos ? `Trauma: ${trauma || 'Default'} · Kratos: ${kratos || 'Default'}` : 'Printed Titan tables'}</Text></View>
        <Text style={[styles.cycle, active && styles.activeText]}>#{index + 1}</Text>
      </Button>;
    })}
    {!titans.length && <Text style={styles.cycle}>No unassigned Alive Titans. Add or restore a Titan in Manage Titans.</Text>}
    <Button quiet label="Manage Titans on Argo" onPress={() => { onClose(); router.push('/argo'); }} />
    {argonaut.titan && <View style={styles.remove}>
      <TitanHealthActions argonaut={argonaut} onRequestStatus={onRequestStatus} />
      <Button quiet label="Remove Titan" onPress={() => setRemoving(true)} />
    </View>}
  </Sheet>;
}
/** The dashboard and Manage Titans change the same individual roster record. */
function TitanHealthActions({ argonaut, onRequestStatus }: { argonaut: Argonaut; onRequestStatus: HealthChangeRequest }) {
  const { party } = useParty(), catalogue = getCatalogue(), cycle = campaignCycle(party);
  const id = argonaut.titan?.rosterId ?? `legacy:${argonaut.id}`;
  const record = legacyTitanRoster(party, catalogue).find(titan => titan.id === id);
  if (!argonaut.titan || !record || record.status !== 'alive' || !sameReference(record, argonaut.titan)) return null;
  return <View style={styles.healthActions}>
    {cycle >= 2 && <Button quiet label="Mark Titan Crippled" onPress={() => onRequestStatus(record, 'crippled')} />}
    <Button quiet label="Mark Titan Dead" onPress={() => onRequestStatus(record, 'dead')}><Text style={styles.deadText}>Mark Titan Dead</Text></Button>
  </View>;
}
const styles = StyleSheet.create({
  choice: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, backgroundColor: theme.paper },
  active: { backgroundColor: theme.charcoal }, activeText: { color: theme.white },
  name: { flexShrink: 1, color: theme.ink, fontSize: 16 }, cycle: { color: theme.muted, fontSize: 12 }, remove: { marginTop: 12, gap: 8 },
  healthActions: { gap: 8 }, deadText: { color: theme.danger, fontSize: 14, fontWeight: '600' },
});
