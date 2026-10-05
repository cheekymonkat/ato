import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { GearResults } from '../components/cards/GearResults';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign';
import type { CardDefinition, CardFace } from '../domain/cards';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';

const pageSize = 12;
export function GearLibrary({ initialQuery = '', initialPage = 0 }: { initialQuery?: string; initialPage?: number }) {
  const [query, setQuery] = useState(initialQuery), [page, setPage] = useState(initialPage);
  const { party } = useParty(), spoilers = useSpoilers(), { width } = useWindowDimensions();
  const cycle = campaignCycle(party);
  const cards = useMemo(() => getCatalogue().search({ family: 'Gear', query, campaignCycle: cycle }), [query, cycle]);
  const lastPage = Math.max(0, Math.ceil(cards.length / pageSize) - 1), currentPage = Math.min(page, lastPage);
  const cardWidth = Math.min(270, width - 32);
  const faceForCard = (card: CardDefinition) => {
    const term = query.trim().toLowerCase();
    return card.faces.find(face => isFaceAvailableInCycle(face, cycle) && face.name.toLowerCase().includes(term)) || card.faces.find(face => isFaceAvailableInCycle(face, cycle))!;
  };
  const inspect = (card: CardDefinition, face: CardFace) => router.push({ pathname: '/cards/[id]', params: { id: card.id, face: face.id } });
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
    <View style={styles.header}><Button quiet label="Back to Argonaut" onPress={() => router.replace({ pathname: '/argonaut/[id]', params: { id: party.activeArgonautId } })} />
      <Button quiet label={spoilers.hideSecrets ? 'Reveal all secret cards' : 'Hide secret cards'} onPress={spoilers.toggle} /></View>
    <View><Text accessibilityRole="header" style={styles.title}>Gear catalogue</Text><Text style={styles.subtitle}>Browse cards, inspect abilities and turn reversible Gear.</Text></View>
    <TextInput accessibilityLabel="Search Gear by name or printed ID" placeholder="Search Gear by name or ID" value={query} onChangeText={value => { setQuery(value); setPage(0); router.setParams({ q: value, p: '0' }); }} style={styles.search} />
    <Text style={styles.subtitle}>Available through campaign Cycle {cycle}. Change the cycle on the campaign page.</Text>
    <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{cards.length} cards{cards.length > pageSize ? ` · Page ${currentPage + 1} of ${lastPage + 1}` : ''}</Text>
    {cards.length === 0 && <Text style={styles.empty}>No Gear matches this search.</Text>}
    <GearResults cards={cards.slice(currentPage * pageSize, (currentPage + 1) * pageSize)} width={cardWidth} faceForCard={faceForCard} onSelect={inspect} />
    {lastPage > 0 && <View style={styles.paging}><Button quiet label="Previous page" disabled={currentPage === 0} onPress={() => { setPage(currentPage - 1); router.setParams({ p: String(currentPage - 1) }); }} />
      <Text style={styles.subtitle}>{currentPage + 1} / {lastPage + 1}</Text><Button quiet label="Next page" disabled={currentPage === lastPage} onPress={() => { setPage(currentPage + 1); router.setParams({ p: String(currentPage + 1) }); }} /></View>}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.canvas }, page: { padding: 16, paddingBottom: 40, gap: 20, maxWidth: theme.maxWidth, width: '100%', marginHorizontal: 'auto' },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, title: { fontFamily: theme.serif, fontSize: 32, color: theme.ink }, subtitle: { color: theme.muted, fontSize: 13, lineHeight: 20 },
  search: { minHeight: 48, borderRadius: 6, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper, padding: 12, fontSize: 16, color: theme.ink },
  empty: { padding: 20, textAlign: 'center', color: theme.muted }, paging: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16 },
});
