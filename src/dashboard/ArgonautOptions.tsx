import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { AFFLICTIONS } from '../domain/afflictions';
import type { AfflictionId } from '../domain/afflictions';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign';
import { conditionConflict, conditionRecords, supportsCondition } from '../domain/conditions';
import type { Argonaut, ConditionRecord } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { ConditionEditor } from './ConditionEditor';
import { TitanPicker } from './TitanPicker';
import { titanDisplayName } from '../domain/titan-selection';

export function ArgonautOptions({ argonaut, onClose, onRules }: {
  argonaut: Argonaut; onClose: () => void; onRules: () => void;
}) {
  const { dispatch, party } = useParty(), catalogue = getCatalogue(), cycle = campaignCycle(party), spoilers = useSpoilers();
  const records = conditionRecords(argonaut);
  const [addingCustom, setAddingCustom] = useState(false);
  const [choosingTitan, setChoosingTitan] = useState(false);
  const titanFace = argonaut.titan && catalogue.getFace(argonaut.titan.definitionId, argonaut.titan.faceId);
  const [removal, setRemoval] = useState<{ kind: 'condition'; record: ConditionRecord } | { kind: 'affliction'; id: AfflictionId; name: string } | null>(null);
  const choices = (() => {
    const unique: ConditionRecord[] = [];
    for (const card of catalogue.search({ campaignCycle: cycle })) {
      const face = card.faces.find(face => supportsCondition(face) && isFaceAvailableInCycle(face, cycle));
      if (!face || spoilers.hidden(card)) continue;
      const record: ConditionRecord = { id: `choice:${card.id}`, name: face.name, reference: { definitionId: card.id, faceId: face.id }, source: '', duration: '', amount: 1 };
      if (!conditionConflict(unique, record, catalogue)) unique.push(record);
    }
    return unique;
  })();
  const extra = records.filter(record => !choices.some(choice => conditionConflict([record], { ...choice, id: '' }, catalogue)));
  if (choosingTitan) return <TitanPicker selected={argonaut.titan} onClose={() => setChoosingTitan(false)} onSelect={reference => {
    dispatch({ type: 'titan', argonautId: argonaut.id, titan: reference ? argonaut.titan?.definitionId === reference.definitionId
      ? { ...argonaut.titan, faceId: reference.faceId }
      : { id: `${argonaut.id}:titan`, ...reference, exhausted: false, enabledEffectIds: [], counters: {} } : null });
    setChoosingTitan(false);
  }} />;
  if (removal) return <RemovalConfirmation title={`Remove ${removal.kind}`} itemType={removal.kind} subject={removal.kind === 'condition' ? removal.record.name : removal.name}
    onCancel={() => setRemoval(null)} onConfirm={() => {
      if (removal.kind === 'condition') dispatch({ type: 'remove-condition', argonautId: argonaut.id, id: removal.record.id });
      else dispatch({ type: 'remove-affliction', argonautId: argonaut.id, partyId: party.id, id: removal.id, confirmed: true });
      setRemoval(null);
    }} />;
  if (addingCustom) return <ConditionEditor records={records} onClose={() => setAddingCustom(false)} onRemove={() => setAddingCustom(false)} onSave={condition => {
    dispatch({ type: 'condition', argonautId: argonaut.id, condition }); setAddingCustom(false);
  }} />;
  return <Sheet visible title="Argonaut Options" subtitle={argonaut.name || 'Selected Argonaut'} onClose={onClose}>
    <Text accessibilityRole="header" style={styles.heading}>Titan</Text>
    <Button quiet label={titanFace ? `Change Titan: ${titanDisplayName(titanFace)} · ${titanFace.cycle}` : 'Choose Titan'} onPress={() => setChoosingTitan(true)} />
    <Text accessibilityRole="header" style={styles.heading}>Conditions</Text>
    <View style={styles.choices}>{choices.map(choice => {
      const current = conditionConflict(records, { ...choice, id: '' }, catalogue);
      const definition = choice.reference && catalogue.get(choice.reference.definitionId);
      const names = definition?.faces.filter(supportsCondition).map(face => face.name);
      return <Choice key={choice.reference!.definitionId} label={current?.name || [...new Set(names)].join(' / ') || choice.name} selected={Boolean(current)} onPress={() => {
        if (current) setRemoval({ kind: 'condition', record: current });
        else dispatch({ type: 'condition', argonautId: argonaut.id, condition: { ...choice, id: `condition:${argonaut.id}:${choice.reference!.definitionId}` } });
      }} />;
    })}{extra.map(record => <Choice key={record.id} label={record.name} selected onPress={() => setRemoval({ kind: 'condition', record })} />)}</View>
    <Button quiet label="Add custom or other condition" onPress={() => setAddingCustom(true)} />
    <Text accessibilityRole="header" style={styles.heading}>Afflictions</Text>
    <View style={styles.choices}>{AFFLICTIONS.filter(affliction => affliction.cycle <= cycle || argonaut.afflictions?.includes(affliction.id)).map(affliction => {
      const selected = argonaut.afflictions?.includes(affliction.id) ?? false;
      return <Choice key={affliction.id} label={affliction.name} selected={selected} onPress={() => {
        if (selected) setRemoval({ kind: 'affliction', id: affliction.id, name: affliction.name });
        else dispatch({ type: 'add-affliction', argonautId: argonaut.id, partyId: party.id, id: affliction.id });
      }} />;
    })}</View>
    <Button quiet label="Rules assistance" onPress={onRules} />
  </Sheet>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Button quiet label={label} role="checkbox" selected={selected} onPress={onPress} style={styles.choice}>
    <View style={[styles.check, selected && styles.checked]}><Text style={styles.tick}>{selected ? '✓' : ''}</Text></View>
    <Text style={styles.label}>{label}</Text>
  </Button>;
}
const styles = StyleSheet.create({
  heading: { color: theme.ink, fontFamily: theme.serif, fontSize: 20 }, choices: { gap: 4 },
  choice: { borderWidth: 0, flexDirection: 'row', justifyContent: 'flex-start', gap: 10, paddingHorizontal: 4, paddingVertical: 6 },
  check: { width: 22, height: 22, borderWidth: 1, borderColor: theme.muted, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: theme.charcoal, borderColor: theme.charcoal }, tick: { color: theme.white, fontSize: 16 }, label: { color: theme.ink, fontSize: 14, flex: 1 },
});
