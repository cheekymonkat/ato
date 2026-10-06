import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import type { MenuIconName } from '../components/Icon';
import type { ArgoRecordId } from '../domain/argo';
import { campaignCycle } from '../domain/campaign';
import type { KnownCardFamily } from '../domain/cards';
import { technologyCycle } from '../domain/technologies';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { campaignStyles as styles } from './CampaignPage';
import { GrowingNotes } from './GrowingNotes';

export const ARGO_REFERENCES: readonly { id: ArgoRecordId; name: string; icon: MenuIconName; prompt: string; families?: readonly KnownCardFamily[] }[] = [
  { id: 'adventures', name: 'Adventures', icon: 'Adventures', prompt: 'Record adventure numbers, choices and outcomes.', families: ['Exploration'] },
  { id: 'titans', name: 'Titans', icon: 'Titans', prompt: 'Manage available Titans.' },
  { id: 'glyphs', name: 'Glyphs', icon: 'CrypticLanguages', prompt: 'Record discovered glyphs, translations and language progress.' },
  { id: 'evolution', name: 'Evolution', icon: 'Evolution', prompt: 'Record evolution levels, unlocked benefits and milestones.' },
  { id: 'diplomacy', name: 'Diplomacy', icon: 'Diplomacy', prompt: 'Record factions, diplomacy values and changes.' },
  { id: 'choice-matrix', name: 'Choice Matrix', icon: 'ChoiceMatrix', prompt: 'Record choice codes and the decisions made by this expedition.' },
  { id: 'fated-events', name: 'Fated Events', icon: 'FatedEvents', prompt: 'Record fated events, triggers and resolutions.' },
  { id: 'godforms', name: 'Godforms & Summons', icon: 'GodformsAndSummons', prompt: 'Record available Godforms and summons.', families: ['Godform', 'Nymph'] },
  { id: 'decks', name: 'Decks', icon: 'Story', prompt: 'Record deck changes and current cards.', families: ['Story', 'Doom', 'Exploration', 'Clue', 'Trauma', 'Kratos'] },
  { id: 'mnestis', name: 'Mnestis Theater', icon: 'MnestisTheatre', prompt: 'Record completed scenes and Mnestis Theater progress.' },
];

/** Reference notebooks are useful now; card libraries supplement them where the catalogue has that family. */
export function ArgoReferences({ id, onClose, initialFamily }: { id: ArgoRecordId; onClose: () => void; initialFamily?: KnownCardFamily }) {
  const reference = ARGO_REFERENCES.find(entry => entry.id === id)!;
  const { party, dispatch } = useParty(), spoilers = useSpoilers(), catalogue = getCatalogue(), cycle = campaignCycle(party);
  const [tab, setTab] = useState<'records' | 'cards'>(initialFamily ? 'cards' : 'records');
  const [family, setFamily] = useState<KnownCardFamily>(initialFamily ?? reference.families?.[0] ?? 'Story');
  const [query, setQuery] = useState('');
  const tabButton = (name: string, selected: boolean, onPress: () => void) => <Button key={name} quiet role="tab" selected={selected} label={name} onPress={onPress}
    style={selected ? { backgroundColor: theme.charcoal, borderColor: theme.gold } : undefined}><Text style={{ color: selected ? theme.white : theme.ink, fontSize: 13, fontWeight: '600' }}>{name}</Text></Button>;
  const cards = tab === 'cards' ? catalogue.search({ family, campaignCycle: cycle, query }).sort((a, b) => technologyCycle(b) - technologyCycle(a) || a.faces[0].name.localeCompare(b.faces[0].name)) : [];
  return <Sheet visible wide title={reference.name} subtitle={`Campaign reference · Cycle ${cycle}`} onClose={onClose}>
    {reference.families && <View style={styles.row}>{tabButton('Records', tab === 'records', () => setTab('records'))}{tabButton('Cards', tab === 'cards', () => setTab('cards'))}</View>}
    {tab === 'records' ? <>
      <Text style={styles.body}>{reference.prompt}</Text>
      <GrowingNotes label={`${reference.name} records`} value={party.argo?.records[id] ?? ''} onChange={text => dispatch({ type: 'argo-record', partyId: party.id, argonautId: party.activeArgonautId, id, text })} />
    </> : <>
      <View style={styles.row}>{reference.families?.map(name => tabButton(name, family === name, () => { setFamily(name); setQuery(''); }))}</View>
      <TextInput accessibilityLabel={`Search ${family} cards`} placeholder="Search by title or ID…" value={query} onChangeText={setQuery} style={styles.input} />
      {cards.length === 0 && <Text style={styles.meta}>No matching cards.</Text>}
      {cards.map((card, index) => {
        const hidden = spoilers.hidden(card), cardCycle = technologyCycle(card), face = card.faces[0];
        const heading = index === 0 || technologyCycle(cards[index - 1]) !== cardCycle;
        return <View key={card.id} style={{ gap: 8 }}>
          {heading && <Text accessibilityRole="header" style={[styles.eyebrow, { marginTop: 12 }]}>{cardCycle ? `CYCLE ${cardCycle}` : 'OTHER CARDS'}</Text>}
          <Button quiet label={hidden ? `Reveal ${family} · ${face.cycle} · ${card.printedIds.join(', ')}` : face.name} onPress={() => {
            if (hidden) { spoilers.reveal(card.id); return; }
            onClose(); router.push({ pathname: '/cards/[id]', params: { id: card.id } });
          }} style={{ alignItems: 'flex-start' }} />
        </View>;
      })}
    </>}
  </Sheet>;
}
