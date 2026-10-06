import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RequirementStatus } from '../../domain/technologies';
import { CardIcon } from './CardIcon';
import { GateStatusDot } from './GateStatusDot';

export function TechnologyRequirements({ status, root = true }: { status: RequirementStatus; root?: boolean }) {
  if (status.children) return <View style={styles.group}>
    {status.children.length === 0 && <Text style={styles.text}>—</Text>}
    {status.children.map((child, index) => <Fragment key={index}>
      {index > 0 && (!root || status.operator === 'or') && <Text style={styles.operator}>{status.operator === 'or' ? 'OR' : 'AND'}</Text>}
      <TechnologyRequirements status={child} root={false} />
    </Fragment>)}
    {root && needsManualCheck(status) && <Text style={styles.legend}>? Verify in the game (not blocking)</Text>}
  </View>;
  const threshold = /^@?Argo\s*(Knowledge|Fate)\s+(\d+\+)$/i.exec(status.text.trim());
  const state = !status.tracked ? 'review' : status.met ? 'met' : 'unmet';
  const label = !status.tracked ? 'Verify manually; not blocking research' : status.met ? 'Requirement met' : 'Requirement unmet';
  return <View accessible accessibilityLabel={`${status.text.replace(/^@/, '')}. ${label}`} style={styles.row}>
    <View style={styles.content}>{threshold ? <View style={styles.threshold}>
      <CardIcon name={threshold[1].toLowerCase() === 'knowledge' ? 'ArgoKnowledge' : 'ArgoFate'} size={18} />
      <Text style={styles.text}>{threshold[2]}</Text>
    </View> : <Text style={styles.text}>{status.text}</Text>}</View>
    <GateStatusDot status={state} inline cross />
  </View>;
}
function needsManualCheck(status: RequirementStatus): boolean {
  return status.children ? status.children.some(needsManualCheck) : !status.tracked;
}
const styles = StyleSheet.create({
  group: { gap: 7, width: '100%' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, maxWidth: '100%' }, content: { flexShrink: 1 },
  threshold: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' },
  text: { textAlign: 'center', color: '#000000', fontSize: 13, lineHeight: 19 }, operator: { textAlign: 'center', color: '#4D4B46', fontSize: 10, fontWeight: '700' }, legend: { textAlign: 'center', color: '#4D4B46', fontSize: 10, lineHeight: 15, marginTop: 3 },
});
