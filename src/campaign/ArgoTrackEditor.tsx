import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import type { ArgoTrack, ArgoTrackDefinition } from '../domain/argo';
import { argoLimitEditable } from '../domain/argo';
import { campaignStyles as styles } from './CampaignPage';

export function ArgoTrackEditor({ definition, track, onClose, onSave }: {
  definition: ArgoTrackDefinition; track: ArgoTrack; onClose: () => void;
  onSave: (value: number, limit: number | null, reference: string) => void;
}) {
  const [value, setValue] = useState(String(track.value)), [limit, setLimit] = useState(track.limit === undefined || track.limit === null ? '' : String(track.limit));
  const [reference, setReference] = useState(track.reference ?? '');
  const editableLimit = argoLimitEditable(definition), effectiveLimit = editableLimit ? (limit.trim() ? Number(limit) : null) : track.limit ?? null;
  const validValue = /^-?\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) && (definition.signed || Number(value) >= 0);
  const validLimit = !editableLimit || !limit.trim() || /^\d+$/.test(limit.trim()) && Number.isSafeInteger(Number(limit));
  const exceeded = validValue && validLimit && effectiveLimit !== null && Number(value) > effectiveLimit;
  return <Sheet visible title={`Edit ${definition.name}`} onClose={onClose}>
    {definition.milestone && definition.id !== 'inwards' && <>
      <Text style={styles.body}>Card number & side</Text>
      <TextInput accessibilityLabel={`${definition.name} card number and side`} placeholder="e.g. 1A" value={reference} onChangeText={setReference} maxLength={40} style={styles.input} />
    </>}
    <Text style={styles.body}>Current value</Text>
    <TextInput accessibilityLabel={`${definition.name} current value`} value={value} onChangeText={setValue} inputMode={definition.signed ? 'text' : 'numeric'} selectTextOnFocus style={styles.input} />
    {definition.id === 'inwards' && <Text style={styles.meta}>Setting Progress to 2 resets it to 0 and adds 1 Argo Knowledge, up to the current cycle’s Knowledge limit.</Text>}
    {editableLimit ? <>
      <Text style={styles.body}>{definition.milestone ? 'Progress target' : 'Limit'} · optional</Text>
      <TextInput accessibilityLabel={`${definition.name} limit`} placeholder="No limit" value={limit} onChangeText={setLimit} inputMode="numeric" selectTextOnFocus style={styles.input} />
      <Text style={styles.meta}>Adjust the limit or target to match your current cards, extensions and campaign rules. Leave it blank for an unbounded track.</Text>
    </> : <>
      <Text style={styles.body}>Limit: {effectiveLimit}</Text>
      <Text style={styles.meta}>{definition.limitSource === 'cycle' ? 'Set by the campaign cycle.' : definition.limitSource === 'technology' ? 'Set by active technology.' : 'Fixed campaign limit.'}</Text>
    </>}
    {(!validValue || !validLimit) && <Text accessibilityRole="alert" style={styles.warning}>Enter whole numbers{definition.signed ? '; the limit must be zero or greater.' : ' of zero or greater.'}</Text>}
    {exceeded && <Text accessibilityRole="alert" style={styles.warning}>The value cannot exceed the limit of {effectiveLimit}. {editableLimit ? 'Lower the value or adjust the limit.' : 'Lower the value.'}</Text>}
    <View style={[styles.row, { justifyContent: 'flex-end' }]}><Button quiet label="Cancel" onPress={onClose} /><Button label="Save track" disabled={!validValue || !validLimit || exceeded || Boolean(definition.readOnly)} onPress={() => { if (validValue && validLimit && !exceeded && !definition.readOnly) onSave(Number(value), effectiveLimit, reference); }} /></View>
  </Sheet>;
}
