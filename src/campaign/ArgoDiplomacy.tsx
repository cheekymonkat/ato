import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { campaignCycle } from '../domain/campaign';
import { cycleFactions, DIPLOMACY_MAX, diplomacyMinimum, diplomacyRelationship, diplomacyValues, relationshipRange, relationships, signedDiplomacy } from '../domain/diplomacy';
import type { Faction } from '../domain/diplomacy';
import { useParty } from '../state/PartyProvider';
import { diplomacyIcons } from '../theme/diplomacy-icons';
import { theme } from '../theme/tokens';
import { GrowingNotes } from './GrowingNotes';

const relationshipColour = (modifier: number) => modifier < 0 ? theme.danger : modifier > 0 ? '#325E51' : '#5E615B';

export function ArgoDiplomacy({ onClose }: { onClose: () => void }) {
  const { party, dispatch } = useParty(), cycle = campaignCycle(party), minimum = diplomacyMinimum(cycle), values = diplomacyValues(party);
  const owner = { partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: cycle };
  const [width, setWidth] = useState(0);
  const [editing, setEditing] = useState<{ faction: Faction; text: string; owner: typeof owner } | null>(null);
  const columns = width >= 804 ? 3 : width >= 536 ? 2 : 1;
  const cardWidth = width > 0 ? (width - (columns - 1) * 12) / columns : '100%';
  if (editing) {
    const value = Number(editing.text), valid = /^-?\d+$/.test(editing.text.trim()) && Number.isSafeInteger(value) && value >= minimum && value <= DIPLOMACY_MAX;
    return <Sheet visible title={`Edit ${editing.faction.name}`} subtitle="Diplomacy value" onClose={() => setEditing(null)}>
      <Text style={styles.caption}>Enter a whole number from {minimum} to {DIPLOMACY_MAX}.</Text>
      <TextInput autoFocus accessibilityLabel={`${editing.faction.name} diplomacy value`} value={editing.text}
        onChangeText={text => setEditing({ ...editing, text })} keyboardType={minimum < 0 ? 'numbers-and-punctuation' : 'number-pad'}
        style={styles.input} />
      {valid && <Text style={styles.preview}>{diplomacyRelationship(cycle, value)?.name}</Text>}
      <View style={styles.actions}><Button quiet label="Cancel" onPress={() => setEditing(null)} />
        <Button label="Save diplomacy" disabled={!valid} onPress={() => {
          if (!valid) return;
          dispatch({ type: 'diplomacy-edit', ...editing.owner, factionId: editing.faction.id, value }); setEditing(null);
        }} />
      </View>
    </Sheet>;
  }
  return <Sheet visible maxWidth={1000} title="Diplomacy" subtitle={`Cycle ${cycle} · Campaign factions`} onClose={onClose}>
    <View style={styles.introduction}><Text style={styles.caption}>Tap a value to edit. The highlighted range shows your current relationship.</Text>
      <Text style={styles.caption}>{cycle === 2 ? 'Values range from 0 to 20.' : 'Values range from −20 to 20.'} Diplomacy starts afresh each cycle.</Text></View>
    <View testID="diplomacy-grid" style={styles.grid} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {cycleFactions(cycle).map(faction => {
        const value = values[faction.id], current = diplomacyRelationship(cycle, value)!, colour = relationshipColour(current.modifier);
        return <View key={faction.id} testID={`diplomacy-${faction.id}`} style={[styles.card, { width: cardWidth }]}>
          <View style={styles.header}><View style={styles.icon} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><SvgXml xml={diplomacyIcons[faction.icon]} width={32} height={32} aria-hidden /></View>
            <Text accessibilityRole="header" style={styles.name}>{faction.name}</Text></View>
          <View style={styles.body}>
            <View style={styles.controls}>
              <Button quiet label={`Decrease ${faction.name} diplomacy`} disabled={value <= minimum} style={styles.step}
                onPress={() => dispatch({ type: 'diplomacy', ...owner, factionId: faction.id, delta: -1 })}><Text style={styles.symbol}>−</Text></Button>
              <Button quiet label={`Edit ${faction.name} diplomacy`} style={styles.valueButton} onPress={() => setEditing({ faction, text: String(value), owner })}>
                <Text accessibilityLabel={`${faction.name} diplomacy: ${value}`} accessibilityLiveRegion="polite" style={styles.value}>{signedDiplomacy(value)}</Text>
              </Button>
              <Button quiet label={`Increase ${faction.name} diplomacy`} disabled={value >= DIPLOMACY_MAX} style={styles.step}
                onPress={() => dispatch({ type: 'diplomacy', ...owner, factionId: faction.id, delta: 1 })}><Text style={styles.symbol}>+</Text></Button>
            </View>
            <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`${faction.name}: ${current.name}, relationship modifier ${signedDiplomacy(current.modifier)}`} style={[styles.relationship, { backgroundColor: colour }]}>
              <Text style={styles.relationshipName}>{current.name}</Text><Text style={styles.modifier}>Modifier {signedDiplomacy(current.modifier)}</Text>
            </View>
            <View style={styles.bands}>{relationships(cycle).map(band => {
              const selected = band === current;
              return <View key={band.name} testID={`diplomacy-band-${faction.id}-${band.name}`} accessible
                accessibilityLabel={`${band.name}: ${relationshipRange(band)}${selected ? ', current relationship' : ''}`}
                style={[styles.band, selected && { borderColor: colour, backgroundColor: '#E8EAE1' }]}>
                <Text style={[styles.bandName, selected && { color: colour, fontWeight: '700' }]}>{selected ? '✓ ' : ''}{band.name}</Text>
                <Text style={[styles.range, selected && { color: colour }]}>{relationshipRange(band)}</Text>
              </View>;
            })}</View>
            {current.name === 'Allied' && 'alliedReference' in faction && <Text style={styles.reference}>Story reference {faction.alliedReference}</Text>}
          </View>
        </View>;
      })}
    </View>
    <View style={styles.notes}><Text accessibilityRole="header" style={styles.notesTitle}>Diplomacy notes</Text>
      <GrowingNotes label="Diplomacy notes" value={party.argo?.records.diplomacy ?? ''}
        onChange={text => dispatch({ type: 'argo-record', ...owner, id: 'diplomacy', text })} /></View>
  </Sheet>;
}
const styles = StyleSheet.create({
  introduction: { gap: 4 }, caption: { color: theme.muted, fontSize: 12, lineHeight: 19 },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 },
  card: { borderWidth: 1, borderColor: theme.line, borderRadius: 7, overflow: 'hidden', minWidth: 0, backgroundColor: '#F6F4EE' },
  header: { backgroundColor: '#263C3F', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 78 },
  icon: { width: 48, height: 48, backgroundColor: theme.white, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: theme.serif, fontSize: 21, color: theme.white, flex: 1, flexShrink: 1 },
  body: { padding: 12, gap: 12 }, controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  step: { width: 44, paddingHorizontal: 0 }, symbol: { color: theme.ink, fontSize: 22 },
  valueButton: { flex: 1, paddingHorizontal: 4, paddingVertical: 0, minWidth: 44, borderWidth: 0 },
  value: { color: theme.ink, fontFamily: theme.serif, fontSize: 36, lineHeight: 46, fontVariant: ['tabular-nums'] },
  relationship: { alignItems: 'center', borderRadius: 5, padding: 8, gap: 2 }, relationshipName: { color: theme.white, fontSize: 16, fontWeight: '700' },
  modifier: { color: theme.white, fontSize: 12 },
  bands: { gap: 6 }, band: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minWidth: 0, borderWidth: 2, borderColor: 'transparent', backgroundColor: theme.paper, borderRadius: 4, padding: 8, gap: 8 },
  bandName: { color: theme.muted, fontSize: 11, flex: 1, flexShrink: 1 }, range: { color: theme.muted, fontSize: 10 },
  reference: { color: theme.muted, fontSize: 12, textAlign: 'center' },
  notes: { gap: 9 }, notesTitle: { color: theme.ink, fontFamily: theme.serif, fontSize: 20 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.line, borderRadius: 5, color: theme.ink, fontSize: 24, padding: 12 },
  preview: { color: theme.ink, fontSize: 15 }, actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
});
