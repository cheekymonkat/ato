import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { useParty } from '../state/PartyProvider';
import { campaignStyles as styles } from './CampaignPage';
export function InventorySettings() {
  const { party, dispatch } = useParty();
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.heading}>Campaign inventory</Text>
    <Text style={styles.body}>{party.inventory ? 'Acquired Gear and Titans are saved for this campaign.' : 'Your existing Gear copies and selected Titans will seed the inventory when you add a copy, acquire a Titan or enable tracking.'}</Text>
    <Button quiet role="checkbox" selected={party.inventory?.enforce === true}
      label={`${party.inventory?.enforce ? '✓ ' : ''}Use campaign inventory for equipment and Titan selection`}
      onPress={() => dispatch({ type: 'inventory-mode', partyId: party.id, argonautId: party.activeArgonautId, enabled: !party.inventory?.enforce })} />
    <Text style={styles.meta}>{party.inventory?.enforce ? 'New selections require an available acquired copy. Dreamwalker variants remain available by cycle. Existing loadouts are kept.' : 'Selection is unrestricted while you review the acquired counts. Turning tracking off keeps your inventory records.'}</Text>
  </View>;
}
