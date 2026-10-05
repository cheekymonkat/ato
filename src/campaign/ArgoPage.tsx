import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { campaignCycle } from '../domain/campaign';
import { inventoryFor } from '../domain/inventory';
import { isDreamwalker, titanOptionCards, titanVariantDisplayName } from '../domain/titan-selection';
import { ArgoBredWarning } from '../dashboard/ArgoBredWarning';
import { SharedResources } from '../dashboard/SharedResources';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { CampaignPage, campaignStyles as styles } from './CampaignPage';
import { GrowingNotes } from './GrowingNotes';
import { InventorySettings } from './InventorySettings';

export function ArgoPage() {
  const { party } = useParty();
  return <ArgoBody key={party.id} />;
}
function ArgoBody() {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), spoilers = useSpoilers();
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const inventory = inventoryFor(party, catalogue), cycle = campaignCycle(party);
  const cards = titanOptionCards(catalogue.search({ family: 'Titan' }), cycle);
  // Keep selected and previously acquired Titans reviewable after lowering the campaign cycle.
  for (const id of inventory.titans) { const card = catalogue.get(id); if (card && !cards.some(entry => entry.id === id) && !isDreamwalker(card.faces[0])) cards.push(card); }
  return <CampaignPage title="Argo" subtitle="Manage the expedition’s shared inventory, Titans and notes.">
    <View style={styles.row}><Button quiet label="Campaign settings & backups" onPress={() => router.push('/profiles')} /><Button quiet label="Open Cargo" onPress={() => router.replace('/cargo')} /></View>
    <InventorySettings />
    <View style={styles.panel}><Text accessibilityRole="header" style={styles.heading}>Available Titans</Text>
      <Text style={styles.body}>Dreamwalkers are available automatically through the campaign’s cycle. Mark Argo-bred Titans as acquired to make them selectable when inventory tracking is enabled.</Text>
      <ArgoBredWarning />
      {cards.map(card => {
        const face = card.faces.find(face => face.kind === 'titan'); if (!face) return null;
        const acquired = inventory.titans.includes(card.id), dreamwalker = isDreamwalker(face);
        const hidden = !acquired && spoilers.hidden(card), inUse = party.argonauts.filter(member => member.titan?.definitionId === card.id);
        return <View key={card.id} style={styles.row}>
          <Button quiet role="checkbox" selected={dreamwalker || acquired} disabled={dreamwalker || acquired && inUse.length > 0}
            label={hidden ? `Reveal Titan · ${face.cycle}` : `${dreamwalker || acquired ? '✓ ' : ''}${titanVariantDisplayName(face)} · ${face.cycle}`}
            onPress={() => {
              if (hidden) { spoilers.reveal(card.id); return; }
              if (acquired) setRemoving({ id: card.id, name: titanVariantDisplayName(face) });
              else dispatch({ type: 'inventory-titan', partyId: party.id, argonautId: party.activeArgonautId, definitionId: card.id, acquired: true });
            }} />
          <Text style={styles.meta}>{dreamwalker ? 'Always available' : inUse.length ? `Selected by ${inUse.map(member => member.name).join(', ')}` : acquired ? 'Acquired' : 'Not acquired'}</Text>
        </View>;
      })}
      {inventory.titans.filter(id => catalogue.get(id)?.family !== 'Titan').map(id => <View key={id} style={styles.row}><Text style={styles.warning}>Unavailable Titan: {id}</Text><Button quiet label="Remove unavailable Titan record" disabled={party.argonauts.some(member => member.titan?.definitionId === id)} onPress={() => setRemoving({ id, name: 'the unavailable Titan record' })} /></View>)}
      <Text style={styles.meta}>A selected Titan must be removed or changed on its Argonaut before its acquired record can be removed.</Text>
    </View>
    <SharedResources owner={party.activeArgonautId} />
    <Text accessibilityRole="header" style={styles.heading}>Campaign notes</Text>
    <GrowingNotes key={party.id} label="Campaign notes" value={party.campaignNotes ?? ''} onChange={text => dispatch({ type: 'campaign-notes', partyId: party.id, argonautId: party.activeArgonautId, text })} />
    {removing && <RemovalConfirmation subject={removing.name} detail="This removes the Titan from the campaign’s acquired list." onCancel={() => setRemoving(null)} onConfirm={() => {
      dispatch({ type: 'inventory-titan', partyId: party.id, argonautId: party.activeArgonautId, definitionId: removing.id, acquired: false, confirmed: true }); setRemoving(null);
    }} />}
  </CampaignPage>;
}
