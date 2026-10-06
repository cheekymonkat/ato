import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { CardIcon } from '../components/cards/CardIcon';
import { Sheet } from '../components/Sheet';
import { campaignCycle } from '../domain/campaign';
import { currentMilestone, sameMilestone } from '../domain/milestones';
import type { MilestoneKind, MilestoneSide } from '../domain/milestones';
import type { MilestoneToken } from '../domain/milestone-rules';
import { milestoneTokenMaximum } from '../domain/milestone-rules';
import type { CardReference } from '../domain/party';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { campaignStyles } from './CampaignPage';

export function ArgoMilestoneCard({ kind }: { kind: MilestoneKind }) {
  const { party, dispatch } = useParty(), current = currentMilestone(party, kind, getCatalogue());
  const [choosing, setChoosing] = useState(false), [editing, setEditing] = useState<{ token: MilestoneToken; reference: CardReference } | null>(null), [value, setValue] = useState('');
  const title = kind === 'story' ? 'Story' : 'Doom';
  const owner = { partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: campaignCycle(party), kind, expectedReference: current.reference };
  function select(side: MilestoneSide) {
    dispatch({ type: 'milestone-select', ...owner, reference: side.reference }); setChoosing(false); setEditing(null);
  }
  const editRule = current.side?.tokens.find(rule => rule.token === editing?.token);
  const editMaximum = editRule && milestoneTokenMaximum(editRule);
  const valid = /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) &&
    (editMaximum === undefined || Number(value) <= editMaximum);
  return <View style={styles.tile}>
    <View style={styles.selector}>
      <Button quiet label={`Previous ${title} card`} disabled={current.index <= 0} onPress={() => select(current.sequence[current.index - 1])} style={styles.arrow}><Text style={styles.symbol}>‹</Text></Button>
      <Button quiet label={`Choose ${title} card`} onPress={() => setChoosing(true)} style={styles.selection}><Text style={styles.label}>{title} {current.side?.label ?? '—'} ▾</Text></Button>
      <Button quiet label={`Next ${title} card`} disabled={current.index < 0 || current.index >= current.sequence.length - 1} onPress={() => select(current.sequence[current.index + 1])} style={styles.arrow}><Text style={styles.symbol}>›</Text></Button>
    </View>
    {current.side ? <>
      <Button quiet label={`View ${title} card ${current.side.label}: ${current.side.face.name}`} onPress={() => {
        router.push({ pathname: '/cards/[id]', params: { id: current.side!.card.id, face: current.side!.face.id } });
      }} style={styles.titleButton}><Text accessibilityRole="header" style={styles.title}>{current.side.face.name} ↗</Text></Button>
      {current.side.tokens.map(rule => {
        const count = current.tokens[rule.token] ?? rule.initial, reached = rule.direction === 'decrease' ? count <= rule.target : count >= rule.target;
        return <View key={rule.token} style={styles.token}>
          <View style={styles.tokenHeading}><CardIcon name={rule.token} size={18} /><Text style={styles.label}>{rule.token}</Text></View>
          <View style={styles.controls}>
            <Button quiet label={`Decrease ${title} ${rule.token}`} disabled={count <= 0} onPress={() => dispatch({ type: 'milestone-token', ...owner, token: rule.token, delta: -1 })} style={styles.arrow}><Text style={styles.symbol}>−</Text></Button>
            <Button quiet label={`Edit ${title} ${rule.token}`} onPress={() => { setEditing({ token: rule.token, reference: current.reference! }); setValue(String(count)); }} style={styles.valueButton}>
              <Text accessibilityLiveRegion="polite" style={[styles.value, reached && styles.reached]}>{count}<Text style={styles.target}>{rule.direction === 'decrease' ? ' → ' : ' / '}{rule.direction === 'decrease' ? rule.target : milestoneTokenMaximum(rule)}</Text></Text>
            </Button>
            <Button quiet label={`Increase ${title} ${rule.token}`} disabled={count >= (milestoneTokenMaximum(rule) ?? Number.MAX_SAFE_INTEGER)} onPress={() => dispatch({ type: 'milestone-token', ...owner, token: rule.token, delta: 1 })} style={styles.arrow}><Text style={styles.symbol}>+</Text></Button>
          </View>
          {rule.direction === 'increase' && milestoneTokenMaximum(rule) !== rule.target && <Text style={styles.meta}>Required: {rule.comparison === 'at-least' ? 'at least ' : ''}{rule.target}</Text>}
          {rule.checkpoints.length > 1 && <Text style={styles.meta}>Checkpoints: {rule.checkpoints.join(' · ')}</Text>}
        </View>;
      })}
    </> : <Text style={styles.meta}>Choose a card to restore this campaign reference.</Text>}
    {choosing && <Sheet visible title={`Choose ${title} card`} subtitle={`Cycle ${campaignCycle(party)} · cards in order`} onClose={() => setChoosing(false)}>
      {current.sequence.map(side => <Button key={`${side.card.id}:${side.face.id}`} quiet
        label={`${title} ${side.label} · ${side.face.name}`} selected={sameMilestone(current.reference, side.reference)} onPress={() => select(side)} />)}
    </Sheet>}
    {editing && editRule && sameMilestone(current.reference, editing.reference) && <Sheet visible title={`Edit ${title} ${editing.token}`} subtitle={`${current.side?.label} · ${current.side?.face.name}`} onClose={() => setEditing(null)}>
      <Text style={campaignStyles.body}>{editRule.direction === 'decrease' ? 'Remove tokens to reach' : 'Target'}: {editRule.comparison === 'at-least' ? 'at least ' : ''}{editRule.target}</Text>
      {editMaximum !== undefined && <Text style={campaignStyles.meta}>{editRule.maximum === undefined ? 'Counter limit' : 'Maximum'}: {editMaximum}</Text>}
      <TextInput accessibilityLabel={`${title} ${editing.token} current value`} value={value} onChangeText={setValue} inputMode="numeric" selectTextOnFocus style={campaignStyles.input} />
      {!valid && <Text accessibilityRole="alert" style={campaignStyles.warning}>Enter a whole number of zero or greater{editMaximum === undefined ? '.' : `, up to ${editMaximum}.`}</Text>}
      <View style={campaignStyles.row}><Button quiet label="Cancel" onPress={() => setEditing(null)} /><Button label="Save tokens" disabled={!valid} onPress={() => {
        if (valid) { dispatch({ type: 'milestone-token-edit', ...owner, expectedReference: editing.reference, token: editing.token, value: Number(value) }); setEditing(null); }
      }} /></View>
    </Sheet>}
  </View>;
}
const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexShrink: 1, flexBasis: 255, minWidth: 220, backgroundColor: theme.paper, borderRadius: 5, borderWidth: 1, borderColor: theme.line, padding: 8, gap: 8 },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 4 }, selection: { flex: 1, borderWidth: 0 },
  arrow: { width: 44, minHeight: 44, padding: 0, borderWidth: 0 }, symbol: { fontSize: 24, color: theme.muted },
  label: { color: theme.ink, fontSize: 13, fontWeight: '600' }, titleButton: { borderWidth: 0, paddingHorizontal: 4 },
  title: { fontFamily: theme.serif, fontSize: 18, textAlign: 'center', color: '#32565A' },
  token: { gap: 2 }, tokenHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, valueButton: { flex: 1, maxWidth: 180, minHeight: 44, padding: 0, borderWidth: 0 },
  value: { fontSize: 29, fontFamily: theme.serif, color: theme.ink, fontVariant: ['tabular-nums'] }, target: { fontSize: 14, color: theme.muted }, reached: { color: '#32565A' },
  meta: { color: theme.muted, fontSize: 11, textAlign: 'center' },
});
