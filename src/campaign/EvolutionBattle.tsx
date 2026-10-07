import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { keywordRepository, primordialTraitOverrides } from '../catalogue/keywords';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { CardIcon } from '../components/cards/CardIcon';
import { RichParagraph } from '../components/cards/RichParagraph';
import type { BattleSetup } from '../domain/evolution';
import { levelNumeral } from '../domain/evolution-rules';
import { resolvePrimordialTrait } from '../domain/primordial-traits';
import { theme } from '../theme/tokens';
import { TraitToggleIcon } from './TraitToggleIcon';

const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0';
export function EvolutionBattle({ setup, mnestis, battleCount, disabledTraits, onTraitDisabled }: {
  setup: BattleSetup; mnestis: boolean; battleCount?: number; disabledTraits: readonly string[]; onTraitDisabled: (trait: string, disabled: boolean) => void;
}) {
  const [expandedTrait, setExpandedTrait] = useState<string | null>(null);
  const { stats } = setup;
  const values = [
    { name: 'To Hit', value: stats.toHit },
    { name: 'Speed', icon: 'Speed', value: stats.speed === 'Inf' ? '∞' : stats.speed },
    { name: 'Wounds', value: stats.wounds },
    { name: 'AT bonus', icon: 'AT', value: signed(setup.atBonus) },
    { name: 'Danger bonus', icon: 'Danger', value: signed(setup.dangerBonus) },
    { name: 'Evasion dice', icon: 'd10', value: signed(setup.evasionDiceBonus) },
    ...(setup.dangerFateBonus ? [{ name: 'Danger / Fate per hit', icon: 'Fate', value: signed(setup.dangerFateBonus) }] : []),
  ];
  const otherAttributes = stats.attributes.filter(attribute => !['AT', 'Danger', 'Danger per hit', 'Danger/Fate', 'Danger/Fate per hit', 'd10', 'Escalation'].includes(attribute.name));
  return <View style={styles.panel}>
    <View style={styles.header}><Text accessibilityRole="header" style={styles.name}>{setup.primordial.name}</Text>
      <Text style={styles.meta}>Level {levelNumeral(setup.level)} · {mnestis ? 'Mnestis setup' : 'Campaign setup'}{battleCount !== undefined ? ` · ${battleCount} battles marked` : ''}</Text></View>
    <View style={styles.body}>
      <View style={styles.stats}>{values.map(stat => <View key={stat.name} style={styles.stat} accessible accessibilityLabel={`${stat.name}: ${stat.value}`}>
        <View style={styles.statValue}>{stat.icon && <CardIcon name={stat.icon} size={21} />}<Text style={styles.value}>{stat.value}</Text></View>
        <Text style={styles.label}>{stat.name}</Text>
      </View>)}</View>
      {otherAttributes.map(attribute => <Text key={attribute.name} style={styles.caption}>{attribute.name}: {signed(attribute.count)}</Text>)}
      <View style={styles.preparation}><Text accessibilityRole="header" style={styles.sectionTitle}>Battle preparation</Text>
        <Text style={styles.caption}>Start with AI I and BP I. Keep tiers II and III as escalation decks.</Text>
        <View style={styles.escalations}><Text style={styles.escalationValue}>{setup.preBattleEscalationCount}</Text><Text style={styles.escalationText}>Starting escalation{setup.preBattleEscalationCount === 1 ? '' : 's'}</Text></View>
        <Text style={styles.caption}>{setup.preBattleEscalationCount > 0 ? `Perform ${setup.preBattleEscalationCount} pre-battle escalation${setup.preBattleEscalationCount === 1 ? '' : 's'} before Round 1, replacing the lowest-tier AI and BP cards as instructed.` : 'No starting escalations in this level block.'}</Text>
        {mnestis && <Text style={styles.caption}>For a Mnestis battle, use the Mnestis Routine. Selecting a Mnestis level does not mark campaign boxes.</Text>}
        {battleCount !== undefined && <Text style={styles.caption}>Battle count is separate from level. Apply any encounter-specific traits, escalations and Scenario instructions from the printed Battle Track.</Text>}
      </View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Traits · {setup.activeTraits.length} active</Text>
      <Text style={styles.caption}>Use the circle icon to disable or restore a trait for future battles.</Text>
      <View style={styles.traits}>{stats.activeTraits.length ? stats.activeTraits.map(trait => {
        const definition = resolvePrimordialTrait(setup.primordial, trait, getCatalogue(), keywordRepository, primordialTraitOverrides), open = expandedTrait === trait;
        const suppressedBy = setup.suppressedTraits[trait], disabled = disabledTraits.includes(trait) || !!suppressedBy;
        const disabledLabel = suppressedBy ? `Disabled by ${suppressedBy.join(', ')}` : 'Disabled';
        return <View key={trait} style={[styles.trait, disabled && styles.disabledTrait]}>
          <View style={styles.traitRow}>
            <View style={styles.traitDetails}><Button quiet label={`Details of ${trait}`} onPress={() => setExpandedTrait(open ? null : trait)} style={styles.traitButton}>
              <Text style={[styles.traitName, disabled && styles.disabledName]}>{trait}</Text>{disabled && <Text style={styles.disabledLabel}>{disabledLabel}</Text>}<Text style={styles.arrow}>{open ? '−' : '+'}</Text>
            </Button></View>
            <Button quiet role="checkbox" selected={!disabled} disabled={!!suppressedBy}
              label={suppressedBy ? `${trait} is disabled by ${suppressedBy.join(', ')} for ${setup.primordial.name}` : `${disabled ? 'Re-enable' : 'Disable'} ${trait} for ${setup.primordial.name}`}
              onPress={() => { if (!suppressedBy) onTraitDisabled(trait, !disabled); }} style={styles.toggle}><TraitToggleIcon disabled={disabled} /></Button>
          </View>
          {open && <View style={styles.definition}>{definition.note && <Text style={styles.caption}>{definition.note}</Text>}
            {definition.main != null && <RichParagraph paragraph={definition.main} size={13} inlineGates align="left" />}
            {definition.sections.map((section, index) => <View key={index} style={styles.subDefinition}><Text style={styles.traitName}>{section.title}</Text><RichParagraph paragraph={section.content} size={13} inlineGates align="left" /></View>)}
          </View>}
        </View>;
      }) : <Text style={styles.caption}>No traits printed at this level.</Text>}</View>
      {stats.traitsChanges.length > 0 && <Text style={styles.changes}>At this level: {stats.traitsChanges.map(trait => trait.startsWith('-') ? `Remove ${trait.slice(1)}` : `Add ${trait}`).join(' · ')}</Text>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: theme.line, borderRadius: 7, overflow: 'hidden', backgroundColor: theme.paper },
  header: { backgroundColor: '#263C3F', padding: 16, gap: 5 }, name: { fontFamily: theme.serif, fontSize: 24, color: theme.white }, meta: { color: '#E1E4DB', fontSize: 12, lineHeight: 18 },
  body: { padding: 14, gap: 12 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stat: { width: '30%', flexGrow: 1, minWidth: 76, backgroundColor: '#F1EFE7', borderRadius: 4, padding: 8, alignItems: 'center', gap: 5 },
  statValue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, value: { color: theme.ink, fontFamily: theme.serif, fontSize: 25 }, label: { fontSize: 10, color: theme.muted, textAlign: 'center' },
  preparation: { backgroundColor: '#E8EDE6', borderRadius: 5, padding: 12, gap: 8 }, sectionTitle: { color: theme.ink, fontFamily: theme.serif, fontSize: 18 },
  caption: { color: theme.muted, fontSize: 12, lineHeight: 19 }, escalations: { flexDirection: 'row', alignItems: 'center', gap: 10 }, escalationValue: { fontSize: 24, color: theme.ink, fontWeight: '700' }, escalationText: { color: theme.ink, fontSize: 12 },
  traits: { gap: 5 }, trait: { borderWidth: 1, borderColor: theme.line, borderRadius: 4, overflow: 'hidden' }, traitButton: { flexDirection: 'row', borderWidth: 0, paddingHorizontal: 10, gap: 8 },
  traitRow: { flexDirection: 'row', alignItems: 'center' }, traitDetails: { flex: 1, minWidth: 0 }, toggle: { width: 44, paddingHorizontal: 0, borderWidth: 0, borderRadius: 0, borderLeftWidth: 1 },
  disabledTrait: { backgroundColor: '#EAE8E2' }, disabledName: { color: theme.muted, textDecorationLine: 'line-through' }, disabledLabel: { color: '#A3423D', fontSize: 10 },
  traitName: { fontSize: 13, fontWeight: '600', color: theme.ink, flex: 1 }, arrow: { fontSize: 18, color: theme.muted },
  definition: { padding: 12, backgroundColor: '#F1EFE7', gap: 8 }, subDefinition: { gap: 6 }, changes: { color: theme.muted, fontSize: 11, lineHeight: 18 },
});
