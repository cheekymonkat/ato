import { useState } from 'react';
import { Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { CompactDropdown } from '../components/CompactDropdown';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign';
import { supportsPattern } from '../domain/references';
import { titanOptionCards, titanVariantDisplayName } from '../domain/titan-selection';
import type { CardReference, TitanRecord } from '../domain/party';
import { emptyTitanPatterns, livingTitanCount, patternIssue, rosterPatternName, rosterTitanName, titanCapacity } from '../domain/titan-roster';
import { useParty } from '../state/PartyProvider';
import { campaignStyles as styles } from './CampaignPage';

export function TitanRosterEditor({ record, onClose }: { record: TitanRecord | null; onClose: () => void }) {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), cycle = campaignCycle(party);
  const [id] = useState(() => record?.id ?? `titan:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`);
  const [selected, setSelected] = useState<CardReference | null>(record);
  const [patterns, setPatterns] = useState(record?.patterns ?? emptyTitanPatterns());
  const [choosing, setChoosing] = useState<'titan' | 'trauma' | 'kratos' | null>(null);
  const face = selected ? catalogue.getFace(selected.definitionId, selected.faceId) : undefined;
  const issue = patternIssue(party, id, patterns, catalogue);
  const full = !record && livingTitanCount(party.titanRoster?.titans ?? []) >= titanCapacity(party, catalogue);
  const titanCards = titanOptionCards(catalogue.search({ family: 'Titan' }), cycle);
  const titanOptions = [{ value: '', label: 'Choose a Titan type', disabled: true }, ...titanCards.map(card => ({ value: card.id,
    label: titanVariantDisplayName(card.faces[0]) }))];
  const optionsFor = (kind: 'trauma' | 'kratos') => {
    const options = catalogue.search({ family: 'Pattern', campaignCycle: cycle })
      .flatMap(card => card.faces.filter(face => isFaceAvailableInCycle(face, cycle) && supportsPattern(face, kind === 'trauma' ? 'Trauma' : 'Kratos'))
        .map(face => {
          const reason = patternIssue(party, id, { ...patterns, [kind]: { definitionId: card.id, faceId: face.id } }, catalogue);
          return { value: `${card.id}:${face.id}`, label: face.name, disabled: Boolean(reason), detail: reason };
        })).sort((a, b) => a.label.localeCompare(b.label));
    const current = patterns[kind];
    if (current && !options.some(option => option.value === `${current.definitionId}:${current.faceId}`)) options.unshift({
      value: `${current.definitionId}:${current.faceId}`, label: rosterPatternName(current, face, catalogue), disabled: true, detail: 'Saved Pattern unavailable in this cycle',
    });
    return [{ value: '', label: 'Titan default' }, ...options];
  };
  const toggle = (field: 'titan' | 'trauma' | 'kratos') => setChoosing(current => current === field ? null : field);
  return <Sheet visible title={record ? 'Edit Titan Patterns' : 'Add Titan'} subtitle="Patterns belong to this individual Titan, including while unassigned." onClose={onClose}>
    {record ? <Text style={styles.heading}>{rosterTitanName(record, catalogue)}</Text> : <View style={{ gap: 6 }}>
      <Text style={styles.body}>Titan type</Text>
      <CompactDropdown label="Titan type" value={selected?.definitionId ?? ''} options={titanOptions} expanded={choosing === 'titan'} onToggle={() => toggle('titan')}
        onChange={value => { const card = catalogue.get(value); if (card) setSelected({ definitionId: value, faceId: card.faces[0].id }); setChoosing(null); }} />
    </View>}
    <Text style={styles.meta}>Titan default uses its printed table. Unavailable Pattern copies are disabled.</Text>
    {(['trauma', 'kratos'] as const).map(kind => <View key={kind} style={{ gap: 6 }}>
      <Text style={styles.body}>{kind === 'trauma' ? 'Trauma' : 'Kratos'} Pattern</Text>
      <CompactDropdown label={`${kind === 'trauma' ? 'Trauma' : 'Kratos'} Pattern`} value={patterns[kind] ? `${patterns[kind]!.definitionId}:${patterns[kind]!.faceId}` : ''}
        options={optionsFor(kind)} expanded={choosing === kind} onToggle={() => toggle(kind)} onChange={value => {
          const split = value.lastIndexOf(':'), ref = value ? { definitionId: value.slice(0, split), faceId: value.slice(split + 1) as 'front' | 'back' } : null;
          if (!patternIssue(party, id, { ...patterns, [kind]: ref }, catalogue)) setPatterns({ ...patterns, [kind]: ref });
          setChoosing(null);
        }} />
    </View>)}
    {(issue || full) && <Text accessibilityRole="alert" style={styles.warning}>{issue ?? 'The Titan roster is full. Free a place before adding a Titan.'}</Text>}
    <View style={[styles.row, { justifyContent: 'flex-end' }]}><Button quiet label="Cancel" onPress={onClose} />
      <Button label={record ? 'Save Patterns' : 'Add Titan'} disabled={!selected || Boolean(issue) || full} onPress={() => {
        if (!selected || issue || full) return;
        dispatch({ type: 'titan-roster', partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: cycle,
          edit: record ? { operation: 'patterns', id, patterns, expected: record } : { operation: 'add', record: { id, ...selected, status: 'alive', patterns } } });
        onClose();
      }} />
    </View>
  </Sheet>;
}
