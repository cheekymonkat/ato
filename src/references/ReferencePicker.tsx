import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { CardActionButton } from '../components/cards/CardActionButton';
import { CardActionRow } from '../components/cards/CardActionRow';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { Sheet } from '../components/Sheet';
import { secretLabel } from '../domain/card-presentation';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign';
import { useParty } from '../state/PartyProvider';
import type { CardDefinition, CardFace } from '../domain/cards';
import type { CardReference, MemoryProgress } from '../domain/party';
import type { PatternKind } from '../domain/pattern-table';
import { supportsPattern } from '../domain/references';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';

export function ReferencePicker({ family, tableKind, selected, onSelect, onClose, unavailable, selectedMemoryProgress }: {
  family: 'Titan' | 'Pattern' | 'Mnemos' | 'Fated Mnemos'; tableKind?: PatternKind;
  selected?: CardReference | null; onSelect: (reference: CardReference | null) => void; onClose: () => void;
  unavailable?: (reference: CardReference) => string | undefined;
  selectedMemoryProgress?: MemoryProgress;
}) {
  const catalogue = getCatalogue(), spoilers = useSpoilers(), { party } = useParty(), cycle = campaignCycle(party);
  const [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const [candidate, setCandidate] = useState<CardReference | null>(selected || null);
  const [searching, setSearching] = useState(!selected);
  const [removing, setRemoving] = useState(false);
  const eligible = (face: CardFace) => isFaceAvailableInCycle(face, cycle) && face.family === family && (!tableKind || supportsPattern(face, tableKind));
  const matches = catalogue.search({ family, query, campaignCycle: cycle }).filter(card => card.faces.some(face => eligible(face)));
  const card = candidate && catalogue.get(candidate.definitionId), face = candidate && catalogue.getFace(candidate.definitionId, candidate.faceId);
  const hidden = card && spoilers.hidden(card);
  const blocked = candidate && unavailable?.(candidate);
  const otherFace = card?.faces.find(side => side.id !== face?.id && eligible(side));
  const lastPage = Math.max(0, Math.ceil(matches.length / 6) - 1), currentPage = Math.min(page, lastPage);
  const label = tableKind ? `${tableKind} Pattern` : family;
  const memory = family === 'Mnemos' || family === 'Fated Mnemos';
  const safeName = (definition: CardDefinition, side: CardFace) => spoilers.hidden(definition) ? secretLabel(definition) : side.name;
  const selectedCard = selected && catalogue.get(selected.definitionId), selectedFace = selected && catalogue.getFace(selected.definitionId, selected.faceId);
  const removeButton = selected && <CardActionButton action={family === 'Pattern' ? 'Use Titan default' : 'Remove'}
    cardName={family === 'Pattern' ? undefined : selectedCard && selectedFace ? safeName(selectedCard, selectedFace) : 'unavailable card'}
    onPress={() => setRemoving(true)} />;
  if (removing && selected) return <RemovalConfirmation
    subject={selectedCard && selectedFace ? safeName(selectedCard, selectedFace) : 'the unavailable card'}
    detail={family === 'Pattern' ? 'This removes the Pattern override and uses the Titan default.' : memory ? 'This removes the memory and its recorded nodes from this Argonaut.' : 'This removes the selected Titan from this Argonaut.'}
    onCancel={() => setRemoving(false)} onConfirm={() => onSelect(null)} />;
  return <Sheet wide visible title={`Choose ${label}`} subtitle="Select a card to review its full details." onClose={onClose}
    scrollKey={searching ? `results:${currentPage}` : 'review'}>
    {!searching && card && face ? <>
      <ReferenceCard card={card} face={face} memoryProgress={candidate?.definitionId === selected?.definitionId ? selectedMemoryProgress : undefined} />
      <CardActionRow>
        {otherFace && !hidden && <CardActionButton action="Flip" cardName={face.name} onPress={() => setCandidate({ definitionId: card.id, faceId: otherFace.id })} />}
        <CardActionButton action="Change card" onPress={() => setSearching(true)} />
        {removeButton}
      </CardActionRow>
      {!isFaceAvailableInCycle(face, cycle) && <Text style={styles.warning}>This card is unavailable in campaign Cycle {cycle}. Existing assignments are retained.</Text>}
      {blocked && <Text style={styles.warning}>{blocked}</Text>}
      <Button label={memory ? 'Equip card' : `Use this ${label}`} disabled={Boolean(hidden) || Boolean(blocked) || !eligible(face)} onPress={() => onSelect(candidate)} />
    </> : <>
      {candidate && <Button quiet label="Back to selection" onPress={() => setSearching(false)} />}
      <TextInput accessibilityLabel={`Search ${label} by name or printed ID`} placeholder="Search name or ID" value={query} autoCorrect={false}
        onChangeText={value => { setQuery(value); setPage(0); }} style={styles.input} />
      <Text style={styles.meta}>Available through campaign Cycle {cycle}. Change the cycle on the campaign page.</Text>
      <Text accessibilityLiveRegion="polite" style={styles.meta}>{matches.length} matching cards · Page {currentPage + 1} of {lastPage + 1}</Text>
      {matches.slice(currentPage * 6, (currentPage + 1) * 6).map(definition => {
        const side = definition.faces.find(face => eligible(face))!;
        const reason = unavailable?.({ definitionId: definition.id, faceId: side.id });
        const choose = () => { setCandidate({ definitionId: definition.id, faceId: side.id }); setSearching(false); };
        return <View key={definition.id} style={styles.result}>
          {reason && <Text style={styles.warning}>{reason}</Text>}
          {spoilers.hidden(definition) ? <ReferenceCard card={definition} face={side} />
            : <Pressable accessibilityRole="button" accessibilityLabel={`Select ${safeName(definition, side)}`} accessibilityState={{ disabled: Boolean(reason) }}
              disabled={Boolean(reason)} onPress={choose} style={reason && styles.unavailable}>
              <ReferenceCard card={definition} face={side} revealable={false} />
            </Pressable>}
        </View>;
      })}
      {matches.length === 0 && <Text style={styles.meta}>No matching cards. Change the search or update the cycle on the campaign page.</Text>}
      {lastPage > 0 && <View style={styles.row}>
        <Button quiet label="Previous page" disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} />
        <Button quiet label="Next page" disabled={currentPage === lastPage} onPress={() => setPage(currentPage + 1)} />
      </View>}
    </>}
    {(searching || !card || !face) && <CardActionRow>{removeButton}</CardActionRow>}
  </Sheet>;
}
const styles = StyleSheet.create({
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.line, borderRadius: 5, fontSize: 16, color: theme.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, meta: { color: theme.muted, fontSize: 12, lineHeight: 20 },
  result: { gap: 8, borderBottomWidth: 1, borderColor: theme.line, paddingBottom: 16 },
  warning: { color: theme.danger, fontSize: 12, lineHeight: 20 }, unavailable: { opacity: 0.6 },
});
