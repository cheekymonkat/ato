import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { Counter } from '../components/Counter';
import { GearCard } from '../components/cards/GearCard';
import { GearResults } from '../components/cards/GearResults';
import { SecretCard } from '../components/cards/SecretCard';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { Sheet } from '../components/Sheet';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign';
import type { CardDefinition } from '../domain/cards';
import { gearStock, inventoryFor, inventoryNotices, physicalGearLimit } from '../domain/inventory';
import { useParty } from '../state/PartyProvider';
import { CampaignCardVisibility, useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { CampaignPage, campaignStyles as styles } from './CampaignPage';

export function CargoPage() {
  const { party } = useParty();
  const inventory = inventoryFor(party, getCatalogue());
  return <CampaignCardVisibility definitionIds={Object.keys(inventory.gear).filter(id => inventory.gear[id] > 0)}>
    <CargoBody key={party.id} />
  </CampaignCardVisibility>;
}
function CargoBody() {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), spoilers = useSpoilers(), { width } = useWindowDimensions();
  const [query, setQuery] = useState(''), [page, setPage] = useState(0), [adding, setAdding] = useState(false);
  const [search, setSearch] = useState(''), [searchPage, setSearchPage] = useState(0), [selected, setSelected] = useState<{ id: string; face: string } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const inventory = inventoryFor(party, catalogue), cycle = campaignCycle(party), cardWidth = Math.max(160, Math.min(250, width - 100));
  const owned = Object.keys(inventory.gear).filter(id => inventory.gear[id] > 0 &&
    (!query.trim() || [id, ...(catalogue.get(id)?.faces.map(face => face.name) ?? []), ...(catalogue.get(id)?.printedIds ?? [])].join(' ').toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => (catalogue.get(a)?.faces[0].name ?? a).localeCompare(catalogue.get(b)?.faces[0].name ?? b));
  const matches = catalogue.search({ family: 'Gear', query: search, campaignCycle: cycle });
  const pageCount = Math.max(1, Math.ceil(owned.length / 12)), currentPage = Math.min(page, pageCount - 1);
  const searchPageCount = Math.max(1, Math.ceil(matches.length / 12)), currentSearchPage = Math.min(searchPage, searchPageCount - 1);
  const card = selected && catalogue.get(selected.id), face = card?.faces.find(face => face.id === selected?.face), hidden = card && spoilers.hidden(card);
  const notices = inventoryNotices(party, catalogue);
  function openCatalogue() { setAdding(true); setSelected(null); setAdded(null); }
  function adjust(id: string, delta: -1 | 1, confirmed = false) {
    dispatch({ type: 'inventory-quantity', partyId: party.id, argonautId: party.activeArgonautId, definitionId: id, delta, confirmed });
  }
  function canAcquire(card: CardDefinition) {
    const limit = physicalGearLimit(card, catalogue);
    return card.faces.some(face => isFaceAvailableInCycle(face, cycle)) && (limit === null || gearStock(party, card.id, catalogue).owned < limit);
  }
  const faceForCard = (card: CardDefinition) => card.faces.find(face => isFaceAvailableInCycle(face, cycle) && face.name.toLowerCase().includes(search.trim().toLowerCase()))
    ?? card.faces.find(face => isFaceAvailableInCycle(face, cycle)) ?? card.faces[0];
  return <CampaignPage title="Cargo" subtitle="Acquired Gear is shared across all four Argonauts. Removing equipment from a loadout returns its copy here.">
    <View style={styles.row}><Button label="Add acquired Gear" onPress={openCatalogue} /><Button quiet label="Browse catalogue" onPress={openCatalogue} /></View>
    {notices.length > 0 && <View style={styles.panel}><Text style={styles.heading}>Inventory review</Text>{notices.map(notice => <Text key={notice} style={styles.warning}>{notice}</Text>)}</View>}
    <TextInput accessibilityLabel="Search acquired Gear" value={query} onChangeText={value => { setQuery(value); setPage(0); }} placeholder="Search acquired Gear by name or ID" style={styles.input} />
    <Text accessibilityLiveRegion="polite" style={styles.meta}>{owned.length} acquired Gear types · Page {currentPage + 1} of {pageCount}</Text>
    <View style={local.grid}>{owned.slice(currentPage * 12, (currentPage + 1) * 12).map(id => {
      const card = catalogue.get(id), face = card?.faces[0], stock = gearStock(party, id, catalogue), limit = card && physicalGearLimit(card, catalogue);
      const assigned = party.argonauts.filter(member => member.instances.some(instance => instance.definitionId === id));
      return <View key={id} style={[styles.panel, local.item, { width: cardWidth + 32 }]}>
        {face?.kind === 'gear' ? <GearCard face={face} width={cardWidth} preview /> : <Text style={styles.warning}>Unavailable Gear: {id}</Text>}
        <Text style={styles.body}>{stock.allocated} allocated · {stock.available} available</Text>
        <Counter compact name="Acquired copies" value={stock.owned} min={stock.allocated}
          max={card && canAcquire(card) ? undefined : stock.owned}
          onDecrease={() => { if (stock.owned === 1) setRemoving({ id, name: face?.name ?? 'the unavailable Gear record' }); else adjust(id, -1); }} onIncrease={() => adjust(id, 1)} />
        <Text style={styles.meta}>Printed supply: {limit == null ? 'verify manually' : `${limit} ${limit === 1 ? 'copy' : 'copies'}`}</Text>
        {assigned.map(member => <Button key={member.id} quiet label={`View ${member.name} · ${member.instances.filter(instance => instance.definitionId === id).length} allocated`}
          onPress={() => router.replace({ pathname: '/argonaut/[id]', params: { id: member.id } })} />)}
        {card && card.faces.length > 1 && <Button quiet label="View both faces" onPress={() => router.push({ pathname: '/cards/[id]', params: { id: card.id } })} />}
      </View>;
    })}</View>
    {owned.length === 0 && <Text style={styles.body}>{query ? 'No acquired Gear matches this search.' : 'No acquired Gear yet. Add the copies your campaign has unlocked.'}</Text>}
    {pageCount > 1 && <View style={styles.row}><Button quiet label="Previous page" disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} /><Button quiet label="Next page" disabled={currentPage >= pageCount - 1} onPress={() => setPage(currentPage + 1)} /></View>}
    <Sheet visible={adding} wide maxWidth={900} scrollKey={selected?.id ?? `results:${currentSearchPage}`} title="Add acquired Gear" subtitle={`Available through Cycle ${cycle}`} onClose={() => setAdding(false)}>
      {card && face ? <>
        <Text style={styles.body}>{gearStock(party, card.id, catalogue).owned} acquired · {gearStock(party, card.id, catalogue).allocated} allocated</Text>
        <Text style={styles.meta}>Printed supply: {physicalGearLimit(card, catalogue) ?? 'verify manually'}</Text>
        <Button label="Add one acquired copy" disabled={Boolean(hidden) || !canAcquire(card)} onPress={() => { adjust(card.id, 1); setAdded(face.name); }} />
        {added && <Text accessibilityLiveRegion="polite" style={styles.body}>Added {added} to Cargo.</Text>}
        {hidden && <Text style={styles.meta}>Reveal this card below before adding an acquired copy.</Text>}
        {!canAcquire(card) && <Text style={styles.meta}>All printed copies are already recorded, or the card is outside this cycle.</Text>}
        {hidden ? <SecretCard card={card} onReveal={() => spoilers.reveal(card.id)} /> : face.kind === 'gear' && <View style={{ alignItems: 'center' }}><GearCard face={face} width={cardWidth} preview /></View>}
        {card.faces.filter(side => side.id !== face.id).map(side => <Button key={side.id} quiet label="View other face" onPress={() => setSelected({ id: card.id, face: side.id })} />)}
        <Button quiet label="Choose another Gear card" onPress={() => { setSelected(null); setAdded(null); }} />
      </> : <>
        <Text style={styles.body}>Search the catalogue, select a card, then choose “Add one acquired copy” to record it in Cargo.</Text>
        <TextInput accessibilityLabel="Search Gear to acquire" value={search} onChangeText={value => { setSearch(value); setSearchPage(0); }} placeholder="Search name or ID" style={styles.input} />
        <Text style={styles.meta}>{matches.length} matching cards · Page {currentSearchPage + 1} of {searchPageCount}</Text>
        <GearResults selecting cards={matches.slice(currentSearchPage * 12, (currentSearchPage + 1) * 12)} width={cardWidth} faceForCard={faceForCard} onSelect={(card, face) => { setSelected({ id: card.id, face: face.id }); setAdded(null); }} />
        {matches.length === 0 && <Text style={styles.body}>No matching Gear in this cycle.</Text>}
        {searchPageCount > 1 && <View style={styles.row}><Button quiet label="Previous results" disabled={currentSearchPage === 0} onPress={() => setSearchPage(currentSearchPage - 1)} /><Button quiet label="Next results" disabled={currentSearchPage >= searchPageCount - 1} onPress={() => setSearchPage(currentSearchPage + 1)} /></View>}
      </>}
    </Sheet>
    {removing && <RemovalConfirmation subject={`the last acquired copy of ${removing.name}`} detail="This removes the Gear from campaign inventory. Allocated copies must first be removed from their loadouts." onCancel={() => setRemoving(null)} onConfirm={() => { adjust(removing.id, -1, true); setRemoving(null); }} />}
  </CampaignPage>;
}
const local = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start', justifyContent: 'center' }, item: { maxWidth: '100%', flexShrink: 0, gap: 12, backgroundColor: theme.paper },
});
