import { StyleSheet, Switch, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Sheet } from '../components/Sheet';
import { SwipeGuard } from '../components/SwipeSurface';
import { gateLabel } from '../domain/card-presentation';
import type { Argonaut } from '../domain/party';
import { assignedGateCards, checkGate, gateValues, GATE_STATUS_LABELS, loadoutReview, skillBreakdown } from '../domain/rules-assistance';
import { campaignCycle, tokenTypesForCycle } from '../domain/tokens';
import { useParty } from '../state/PartyProvider';
import { useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { adjustedStat, combatAdjustments } from '../domain/combat-modifiers';
import { slotRestrictionLabel } from '../domain/slots';

const slotNames = { hand: 'Hands', armor: 'Armor', support: 'Support', attachment: 'Attachments', mnemos: 'Mnemos', 'fated-mnemos': 'Fated Mnemos' };
const signed = (value: number) => value > 0 ? `+${value}` : String(value);

export function RulesAssistanceSheet({ argonaut, onClose }: { argonaut: Argonaut; onClose: () => void }) {
  const { party, dispatch } = useParty(), spoilers = useSpoilers(), catalogue = getCatalogue();
  const review = loadoutReview(argonaut, catalogue), stats = skillBreakdown(argonaut, catalogue), values = gateValues(argonaut, catalogue);
  const nameOf = (instanceId: string) => {
    const instance = argonaut.instances.find(item => item.id === instanceId);
    const card = instance && catalogue.get(instance.definitionId);
    return card && spoilers.hidden(card) ? 'Unrevealed Gear' : instance && catalogue.getFace(instance.definitionId, instance.faceId)?.name || 'Unavailable Gear';
  };
  const grantName = (definitionId: string, faceId: string) => {
    const card = catalogue.get(definitionId);
    return card && spoilers.hidden(card) ? 'Unrevealed card' : catalogue.getFace(definitionId, faceId)?.name || 'Unavailable card';
  };
  const cards = assignedGateCards(argonaut, catalogue).filter(entry => !spoilers.hidden(entry.card));
  const titanCard = argonaut.titan && catalogue.get(argonaut.titan.definitionId);
  const showTitanRule = titanCard && !spoilers.hidden(titanCard);
  const combat = combatAdjustments(argonaut, catalogue);
  return <Sheet visible title="Rules assistance" subtitle={argonaut.name || 'Argonaut'} wide onClose={onClose}>
    <SwipeGuard><View style={styles.toggleRow}>
      <View style={styles.toggleLabel}><Text style={styles.heading}>Highlight card gates</Text>
        <Text style={styles.body}>Applies to Gear, Titans, memories and selected Patterns for all four Argonauts, using each one’s own counters and equipment.</Text></View>
      <Switch accessibilityLabel="Highlight card gates for this campaign" value={party.rulesAssistance === true}
        onValueChange={enabled => dispatch({ type: 'rules-assistance', partyId: party.id, argonautId: argonaut.id, enabled })}
        trackColor={{ false: theme.line, true: '#416EAA' }} />
    </View></SwipeGuard>
    <Text style={styles.body}>✓ Threshold met · − Threshold unmet · ? Manual check</Text>
    <Text style={styles.body}>Checks explicit requirements such as 5+ against your Triskelion, token counts or equipped Gear traits. Ambrosia and Bleeding use tokens; Labyrinth uses Gear with that printed trait. Each Gear card counts once, including exhausted cards; discarded cards and cards needing reassignment do not contribute traits.</Text>
    <Text style={styles.body}>Costs, timing, readiness and effects that change printed traits still need your decision. Memory panels appear when their nodes unlock them; their printed combat gates are checked separately.</Text>

    <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Combat modifiers</Text>
      <Text style={styles.body}>Precision tokens {signed(argonaut.combatModifiers?.precision ?? 0)} · Speed tokens {signed(argonaut.combatModifiers?.speed ?? 0)}</Text>
      <Text style={styles.body}>Red values include your modifier tokens and direct passive Gear or Pattern bonuses and penalties. Weapon Precision bonuses apply to that Weapon; non-weapon Precision bonuses apply to all Weapons. Gear and Pattern Speed effects adjust the selected Titan. Gated bonuses update when their requirement is met, independently of gate highlighting.</Text>
      {[...combat].flatMap(([face, modifiers]) => {
        const name = face.kind === 'titan' ? 'Speed' : 'Precision';
        const printed = face.kind === 'titan' ? face.data.speed : face.kind === 'gear' ? face.data.offensiveStatistics.precision : undefined;
        const modifier = face.kind === 'titan' ? modifiers.speed : modifiers.precision;
        if (!printed) return [];
        const value = adjustedStat(printed, modifier);
        return <View key={`${face.printedIds.join(',')}:${face.id}`} style={styles.notice}>
          <Text style={styles.label}>{face.name} · {name} {value.text}</Text>
          <Text style={styles.body}>Printed {printed}{modifier?.contributions.length ? ` · ${modifier.contributions.map(item => `${item.source} ${signed(item.amount)}`).join(' · ')}` : ' · No adjustments'}</Text>
        </View>;
      })}
      <Text style={styles.body}>Resolve action costs, triggered effects, conditional prose and temporary token expiry manually. Symbolic values keep their printed form with the adjustment beside it.</Text>
    </View>

    <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Skill contributions</Text>
      <Text style={styles.body}>Manual value + Argonaut portrait + memories = current stat. Mnemos bonuses and unresolved Fated penalties are included.</Text>
      {stats.map(row => <View key={row.skill} style={styles.statRow}>
        <View style={styles.statDetails}><Text style={styles.label}>{row.skill}</Text>
          <Text style={styles.body}>Manual {signed(row.manual)} · Portrait {signed(row.portrait)} · Memories {signed(row.memories)}</Text>
          {row.raw !== row.total && <Text style={styles.note}>Combined {signed(row.raw)}; displayed limit is −9 to 9.</Text>}</View>
        <Text style={styles.total}>{signed(row.total)}</Text>
      </View>)}
    </View>

    <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Loadout capacity</Text>
      {review.capacity.map(row => <View key={row.kind} style={styles.capacity}>
        <Text style={styles.label}>{slotNames[row.kind]}: {row.occupied} / {row.available} used</Text>
        <Text style={styles.body}>{row.baseline} base{row.available !== row.baseline ? ` + ${row.available - row.baseline} granted` : ''}</Text>
        {row.grants.map(position => <Text key={position.id} style={styles.note}>+1 from {grantName(position.source!.definitionId, position.source!.faceId)}{position.eligibility ? ` · ${slotRestrictionLabel(position.eligibility)}` : ''}</Text>)}
      </View>)}
      {showTitanRule && review.handRule && <Text style={styles.body}>{review.handRule}: three-handed Weapons can occupy two hands. Equipment selection offers this option while this Titan is assigned. Other effects of the ability stay manual.</Text>}
      {showTitanRule && review.unknownMight && <Text style={styles.body}>Unknown Might removes one Support slot while a three-handed Weapon uses two hands. Gear in a lost slot stays available under Needs reassignment. Removing or discarding that Weapon restores the slot.</Text>}
      {review.notices.map((notice, index) => <View key={`${notice.code}:${index}`} style={styles.notice}>
        <Text style={styles.label}>{notice.instanceIds.map(nameOf).join(' · ')}</Text><Text style={styles.warning}>{notice.message}</Text>
      </View>)}
      <Text style={styles.body}>Capacity shows recorded placements, including exhausted or discarded cards. Resolve any effects that change equipment manually. Review notices preserve your cards and placement exceptions.</Text>
    </View>

    <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Card gate checks</Text>
      <Text style={styles.body}>Rage {argonaut.counters.rage} · Fate {argonaut.counters.fate} · Danger {argonaut.counters.danger}</Text>
      <Text style={styles.body}>{tokenTypesForCycle(campaignCycle(party)).map(({ name }) => `${name} ${values.tokens![name]}`).join(' · ')}</Text>
      {!cards.length && <Text style={styles.body}>No assigned cards have visible printed gate requirements.</Text>}
      {cards.map(({ instance, face, name, gates }) => <View key={instance.id} style={styles.notice}>
        <Text style={styles.label}>{name} · {face.family}{instance.discarded ? ' · Discarded' : instance.exhausted ? ' · Exhausted' : ''}</Text>
        {gates.map((gate, index) => { const result = checkGate(gate, values); return <View key={index} style={styles.gateRow}>
          <Text style={[styles.label, { color: result.status === 'met' ? '#276B49' : result.status === 'unmet' ? theme.danger : '#72571D' }]}>{gateLabel(gate)} · {GATE_STATUS_LABELS[result.status]}</Text>
          <Text style={styles.body}>{result.explanation}</Text>
        </View>; })}
      </View>)}
    </View>
  </Sheet>;
}
const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, toggleLabel: { flex: 1, gap: 6 },
  section: { borderTopWidth: 1, borderColor: theme.line, paddingTop: 16, gap: 12 },
  heading: { fontFamily: theme.serif, fontSize: 20, color: theme.ink }, label: { fontSize: 13, fontWeight: '600', color: theme.ink },
  body: { color: theme.muted, fontSize: 12, lineHeight: 18 }, note: { color: theme.muted, fontSize: 11, lineHeight: 17 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, statDetails: { flex: 1, gap: 4 }, total: { color: theme.ink, fontSize: 22, minWidth: 36, textAlign: 'right' },
  capacity: { gap: 4 }, notice: { backgroundColor: theme.panel, padding: 12, borderRadius: 6, gap: 8 },
  warning: { color: theme.danger, fontSize: 12, lineHeight: 18 }, gateRow: { gap: 4 },
});
