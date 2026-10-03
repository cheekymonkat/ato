import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { ReferenceCard } from '../components/cards/ReferenceCard';
import { CardActionButton } from '../components/cards/CardActionButton';
import { CardActionRow } from '../components/cards/CardActionRow';
import { SwipeGuard } from '../components/SwipeSurface';
import { conditionRecords, conditionReverse } from '../domain/conditions';
import type { Argonaut, ConditionRecord } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { ConditionEditor } from './ConditionEditor';
import { SectionHeading } from './EquipmentArea';

export function ConditionArea({ argonaut }: { argonaut: Argonaut }) {
  const { dispatch, party } = useParty(), spoilers = useSpoilers(), records = conditionRecords(argonaut);
  const [editing, setEditing] = useState<{ owner: string; selected?: ConditionRecord } | null>(null);
  const editingOwner = editing && party.argonauts.find(member => member.id === editing.owner);
  return <View testID="condition-section">
    <SectionHeading title="Conditions" />
    <View style={styles.panel}>
      {records.length === 0 && <Text style={styles.meta}>No conditions</Text>}
      <View style={styles.cards}>
      {records.map(record => {
        const ref = record.reference, card = ref && getCatalogue().get(ref.definitionId), face = ref && getCatalogue().getFace(ref.definitionId, ref.faceId);
        const hidden = card && spoilers.hidden(card);
        const reverse = ref && conditionReverse(ref, getCatalogue());
        return <View key={record.id} style={styles.record}>
          <SwipeGuard><Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Edit hidden condition' : `Edit condition ${record.name}`}
            accessibilityHint="Opens card selection and removal" onPress={() => setEditing({ owner: argonaut.id, selected: record })}>
          {card && face ? <ReferenceCard card={card} face={face} revealable={false} /> : <>
            <Text style={styles.name}>{record.name}</Text>
            {ref && <Text style={styles.meta}>Reference unavailable</Text>}
          </>}
          </Pressable></SwipeGuard>
          {Boolean(record.source || record.duration) && <Text style={styles.meta}>{[!hidden && record.source ? `Source: ${record.source}` : '', record.duration ? `Duration: ${record.duration}` : ''].filter(Boolean).join(' · ')}</Text>}
          <CardActionRow>
            {!hidden && reverse && ref && <CardActionButton action="Flip" cardName={record.name}
              onPress={() => dispatch({ type: 'condition-flip', argonautId: argonaut.id, id: record.id, reference: ref })} />}
          </CardActionRow>
        </View>;
      })}
      </View>
      <Button label="Add condition" onPress={() => setEditing({ owner: argonaut.id })} />
    </View>
    {editing && editingOwner && <ConditionEditor records={conditionRecords(editingOwner)} selected={editing.selected} onClose={() => setEditing(null)} onRemove={() => {
      if (editing.selected) dispatch({ type: 'remove-condition', argonautId: editing.owner, id: editing.selected.id });
      setEditing(null);
    }} onSave={condition => {
      dispatch({ type: 'condition', argonautId: editing.owner, condition }); setEditing(null);
    }} />}
  </View>;
}
const styles = StyleSheet.create({ panel: { padding: 12, gap: 12, backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 6 }, cards: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }, record: { flexBasis: 240, flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: 262, gap: 8 }, name: { color: theme.ink, fontWeight: '600', fontSize: 16 }, meta: { color: theme.muted, fontSize: 12, lineHeight: 20 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
