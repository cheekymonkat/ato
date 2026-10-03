import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { CardActionButton } from '../components/cards/CardActionButton';
import { CardActionRow } from '../components/cards/CardActionRow';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign';
import { useParty } from '../state/PartyProvider';
import { conditionConflict, supportsCondition } from '../domain/conditions';
import type { CardReference, ConditionRecord } from '../domain/party';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';

export function ConditionEditor({ selected, records, onSave, onClose, onRemove }: {
  selected?: ConditionRecord; records: readonly ConditionRecord[]; onSave: (condition: ConditionRecord) => void; onClose: () => void; onRemove: () => void;
}) {
  const catalogue = getCatalogue(), spoilers = useSpoilers(), { party } = useParty(), cycle = campaignCycle(party);
  const eligible = (face: Parameters<typeof supportsCondition>[0]) => supportsCondition(face) && isFaceAvailableInCycle(face, cycle);
  const [searching, setSearching] = useState(!selected), [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const [reference, setReference] = useState<CardReference | null>(selected?.reference ?? null);
  const [name, setName] = useState(selected?.name ?? '');
  const [removing, setRemoving] = useState(false);
  const matches = catalogue.search({ query, campaignCycle: cycle }).filter(card => card.faces.some(eligible));
  const last = Math.max(0, Math.ceil(matches.length / 6) - 1), current = Math.min(page, last);
  const card = reference && catalogue.get(reference.definitionId), face = reference && catalogue.getFace(reference.definitionId, reference.faceId);
  const hidden = Boolean(card && spoilers.hidden(card));
  const originalCard = selected?.reference && catalogue.get(selected.reference.definitionId);
  const removalName = originalCard && spoilers.hidden(originalCard) ? 'the unrevealed condition' : selected?.name;
  const other = card?.faces.find(side => side.id !== face?.id && eligible(side));
  const draft: ConditionRecord = { id: selected?.id ?? '', name: face?.name ?? name.trim(), reference, amount: 1, source: selected?.source ?? '', duration: selected?.duration ?? '' };
  const conflict = conditionConflict(records, draft, catalogue);
  if (removing && selected) return <RemovalConfirmation subject={removalName || 'the condition'}
    onCancel={() => setRemoving(false)} onConfirm={onRemove} />;
  return <Sheet visible wide title={selected ? 'Edit condition' : 'Add condition'} onClose={onClose} scrollKey={searching ? `results:${current}` : 'edit'}>
    {searching ? <>
      <Button quiet label="Add custom condition" onPress={() => { setReference(null); setName(''); setSearching(false); }} />
      {selected && <Button quiet label="Back to selection" onPress={() => setSearching(false)} />}
      <TextInput accessibilityLabel="Search conditions by name or ID" placeholder="Search name or ID" value={query}
        onChangeText={value => { setQuery(value); setPage(0); }} autoCorrect={false} style={styles.input} />
      <Text style={styles.meta}>Available through campaign Cycle {cycle}. Change the cycle on the campaign page.</Text>
      <Text style={styles.meta}>{matches.length} matching cards · Page {current + 1} of {last + 1}</Text>
      {matches.slice(current * 6, (current + 1) * 6).map(definition => {
        const side = definition.faces.find(eligible)!;
        const held = conditionConflict(records, { ...draft, name: side.name, reference: { definitionId: definition.id, faceId: side.id } }, catalogue);
        return spoilers.hidden(definition) ? <ReferenceCard key={definition.id} card={definition} face={side} />
          : <View key={definition.id}><Pressable disabled={Boolean(held)} accessibilityState={{ disabled: Boolean(held) }} accessibilityRole="button" accessibilityLabel={`Select condition ${side.name}`} onPress={() => {
            setReference({ definitionId: definition.id, faceId: side.id }); setName(side.name); setSearching(false);
          }}><ReferenceCard card={definition} face={side} revealable={false} /></Pressable>{held && <Text style={styles.meta}>Already assigned to this Argonaut. Use Flip on the existing card to change sides.</Text>}</View>;
      })}
      {!matches.length && <Text style={styles.meta}>No matching conditions. You can add a custom condition.</Text>}
      {last > 0 && <View style={styles.row}><Button quiet label="Previous page" disabled={current === 0} onPress={() => setPage(current - 1)} />
        <Button quiet label="Next page" disabled={current === last} onPress={() => setPage(current + 1)} /></View>}
    </> : <>
      {card && face ? <ReferenceCard card={card} face={face} /> : reference ? <Text style={styles.meta}>Condition reference is unavailable. Recorded details are retained.</Text>
        : <TextInput accessibilityLabel="Condition name" placeholder="Condition name" value={name} maxLength={120} onChangeText={setName} style={styles.input} />}
      <CardActionRow>{other && !hidden && <CardActionButton action="Flip" cardName={face?.name} onPress={() => {
        setReference({ definitionId: card!.id, faceId: other.id }); setName(other.name);
      }} />}
      <CardActionButton action="Change card" onPress={() => setSearching(true)} />
      {selected && <CardActionButton action="Remove" cardName={removalName} onPress={() => setRemoving(true)} />}</CardActionRow>
      <Text style={styles.meta}>One of each condition type per Argonaut. Effects and expiry are resolved manually.</Text>
      {reference && !isFaceAvailableInCycle(face || undefined, cycle) && <Text style={styles.meta}>This card is unavailable in campaign Cycle {cycle}. Existing conditions are retained.</Text>}
      {conflict && <Text accessibilityRole="alert" style={styles.meta}>This Argonaut already has this condition type. Edit the existing condition instead.</Text>}
      <Button label="Save condition" disabled={!name.trim() || hidden || Boolean(conflict) || Boolean(reference && !eligible(face))} onPress={() => onSave({
        ...draft,
        id: selected?.id ?? `condition:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`,
      })} />
    </>}
  </Sheet>;
}
const styles = StyleSheet.create({ input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: theme.line, borderRadius: 5, fontSize: 16, color: theme.ink }, meta: { color: theme.muted, fontSize: 12, lineHeight: 20 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
