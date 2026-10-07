import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { CompactDropdown } from '../components/CompactDropdown';
import { Sheet } from '../components/Sheet';
import { campaignCycle } from '../domain/campaign';
import { disabledPrimordialTraits, evolutionValues, mnestisPrimordialLevels, resolveBattleSetup, trackedLevel } from '../domain/evolution';
import type { EvolutionEdit } from '../domain/evolution';
import { EVOLUTION_RULES, levelNumeral } from '../domain/evolution-rules';
import type { PrimordialTrack } from '../domain/evolution-rules';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { EvolutionBattle } from './EvolutionBattle';
import { EvolutionTracks } from './EvolutionTracks';
import { GrowingNotes } from './GrowingNotes';

export function ArgoEvolution({ onClose }: { onClose: () => void }) {
  const { party, dispatch } = useParty(), cycle = campaignCycle(party), rules = EVOLUTION_RULES[cycle], state = evolutionValues(party), catalogue = getCatalogue();
  const owner = { partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: cycle };
  const [selectedId, setSelectedId] = useState(rules.regular[0].printedId);
  const [mnestis, setMnestis] = useState<{ primordialId: string; level: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [pending, setPending] = useState<{ id: string | null; expectedId: string | null; owner: typeof owner } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const adversary = rules.adversaries.find(track => track.printedId === state.adversaryId);
  const selected = [...rules.regular, rules.boss, ...(adversary ? [adversary] : [])].find(track => track.printedId === selectedId) ?? rules.regular[0];
  const mnestisLevels = mnestisPrimordialLevels(selected, rules, catalogue);
  const campaignLevel = trackedLevel(party, selected.printedId), isMnestis = mnestis?.primordialId === selected.printedId && mnestisLevels.some(block => block.level === mnestis.level);
  const level = isMnestis ? mnestis.level : campaignLevel, disabledTraits = disabledPrimordialTraits(party, selected.printedId);
  const setup = resolveBattleSetup(selected, level, catalogue, disabledTraits);
  const edit = (edit: EvolutionEdit) => dispatch({ type: 'evolution', ...owner, edit });
  const select = (id: string) => { setSelectedId(id); setMnestis(null); setExpanded(null); };
  const dropdown = (label: string, value: string, options: { value: string; label: string }[], onChange: (value: string) => void) => <CompactDropdown label={label} value={value} options={options}
    expanded={expanded === label} onToggle={() => setExpanded(expanded === label ? null : label)} onChange={value => { setExpanded(null); onChange(value); }} />;
  const battleTrack = (kind: 'boss' | 'adversary', track: PrimordialTrack | undefined, count: number) => <View style={styles.battleTrack}>
    <Text style={styles.eyebrow}>{kind === 'boss' ? 'Boss Primordial' : 'Adversary'}</Text>
    {kind === 'adversary' && rules.adversaries.length > 1 ? dropdown('Campaign adversary', state.adversaryId ?? '', [{ value: '', label: 'Choose adversary' }, ...rules.adversaries.map(option => ({ value: option.printedId, label: option.name }))], value => {
      const id = value || null;
      if (id === state.adversaryId) return;
      if (state.adversaryBattles > 0) { setConfirmed(false); setPending({ id, expectedId: state.adversaryId, owner }); }
      else { edit({ kind: 'adversary', primordialId: id, expectedId: state.adversaryId, confirmed: false }); if (id) select(id); }
    }) : <Text style={styles.battleName}>{track?.name ?? 'Choose adversary'}</Text>}
    <View style={styles.counter}><Button quiet label={`Decrease ${kind} battle count`} disabled={!track || count <= 0} style={styles.step} onPress={() => edit({ kind: 'battle', track: kind, value: count - 1 })}><Text style={styles.symbol}>−</Text></Button>
      <Text accessibilityLiveRegion="polite" accessibilityLabel={`${kind} battles: ${count}`} style={styles.count}>{count}</Text>
      <Button quiet label={`Increase ${kind} battle count`} disabled={!track || !Number.isSafeInteger(count + 1)} style={styles.step} onPress={() => edit({ kind: 'battle', track: kind, value: count + 1 })}><Text style={styles.symbol}>+</Text></Button>
      <View style={styles.setupLink}><Button quiet label={`View ${track?.name ?? 'adversary'} battle setup`} disabled={!track} onPress={() => track && select(track.printedId)} style={styles.setupButton}><Text style={styles.link}>Setup ›</Text></Button></View>
    </View>
  </View>;
  if (pending) return <Sheet visible title="Change adversary" subtitle={`Cycle ${pending.owner.expectedCycle}`} onClose={() => setPending(null)}>
    <Text style={styles.caption}>Changing the adversary clears its current battle count. The regular Primordial tracks and boss count stay as they are.</Text>
    <Button quiet role="checkbox" selected={confirmed} label="I confirm the adversary battle count will reset" onPress={() => setConfirmed(!confirmed)} />
    <View style={styles.actions}><Button quiet label="Cancel" onPress={() => setPending(null)} /><Button label="Change adversary" disabled={!confirmed} onPress={() => {
      if (!confirmed) return;
      dispatch({ type: 'evolution', ...pending.owner, edit: { kind: 'adversary', primordialId: pending.id, expectedId: pending.expectedId, confirmed } });
      if (pending.id) select(pending.id); setPending(null);
    }} /></View>
  </Sheet>;
  return <Sheet visible maxWidth={1100} title="Evolution" subtitle={`Cycle ${cycle} · Evolution & Battle Tracks`} onClose={onClose}>
    <Text style={styles.caption}>Mark the next box before a Timeline Battle. Select a Primordial to review its battle setup.</Text>
    <View style={styles.battles}>{battleTrack('boss', rules.boss, state.bossBattles)}{battleTrack('adversary', adversary, state.adversaryBattles)}</View>
    <View testID="evolution-layout" style={[styles.layout, width >= 700 && styles.sideBySide]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View style={[styles.trackColumn, width >= 700 && { width: '44%' }]}><EvolutionTracks rules={rules} state={state} selectedId={selected.printedId} onSelect={select} onEdit={edit} /></View>
      <View style={[styles.detailColumn, width >= 700 && { flex: 1, width: undefined }]}>
        <View style={styles.levelPicker}><Text style={styles.eyebrow}>Battle setup reference</Text>
          {dropdown('Primordial battle setup', selected.printedId, [...rules.regular, rules.boss, ...(adversary ? [adversary] : [])].map(track => ({ value: track.printedId, label: track.name })), select)}
          {dropdown('Mnestis Primordial level', isMnestis ? String(level) : 'tracked', [{ value: 'tracked', label: `Campaign · Level ${levelNumeral(campaignLevel)}` }, ...mnestisLevels.map(block => ({ value: String(block.level), label: `Mnestis Level ${levelNumeral(block.level)}` }))], value => {
            if (value === 'tracked') setMnestis(null);
            else if (mnestisLevels.some(block => String(block.level) === value)) setMnestis({ primordialId: selected.printedId, level: Number(value) });
          })}
          {isMnestis && <Button quiet label="Return to campaign level" onPress={() => setMnestis(null)} />}
        </View>
        {setup ? <EvolutionBattle key={`${selected.printedId}-${level}`} setup={setup} mnestis={isMnestis}
          disabledTraits={disabledTraits} onTraitDisabled={(trait, disabled) => edit({ kind: 'trait', primordialId: selected.printedId, trait, disabled })}
          battleCount={selected.printedId === rules.boss.printedId ? state.bossBattles : selected.printedId === state.adversaryId ? state.adversaryBattles : undefined} /> : <Text style={styles.caption}>No printed level block is available for this selection.</Text>}
      </View>
    </View>
    <View style={styles.notes}><Text accessibilityRole="header" style={styles.notesTitle}>Evolution notes</Text><GrowingNotes label="Evolution notes" value={party.argo?.records.evolution ?? ''}
      onChange={text => dispatch({ type: 'argo-record', ...owner, id: 'evolution', text })} /></View>
  </Sheet>;
}
const styles = StyleSheet.create({
  caption: { color: theme.muted, fontSize: 12, lineHeight: 19 }, battles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  battleTrack: { flex: 1, minWidth: 230, backgroundColor: '#F1EFE7', borderWidth: 1, borderColor: theme.line, borderRadius: 7, padding: 12, gap: 8 },
  eyebrow: { color: theme.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }, battleName: { fontFamily: theme.serif, color: theme.ink, fontSize: 20, minHeight: 44, textAlignVertical: 'center' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8 }, step: { width: 44, paddingHorizontal: 0 }, symbol: { fontSize: 22, color: theme.ink },
  count: { color: theme.ink, fontSize: 27, fontFamily: theme.serif, fontVariant: ['tabular-nums'] }, setupLink: { flex: 1, alignItems: 'flex-end' }, setupButton: { borderWidth: 0, paddingHorizontal: 4 }, link: { color: '#347C7A', fontWeight: '600', fontSize: 13 },
  layout: { gap: 16, width: '100%', minWidth: 0 }, sideBySide: { flexDirection: 'row', alignItems: 'flex-start' }, trackColumn: { minWidth: 0 }, detailColumn: { width: '100%', minWidth: 0, gap: 12 },
  levelPicker: { gap: 8 }, notes: { gap: 9 }, notesTitle: { color: theme.ink, fontFamily: theme.serif, fontSize: 20 }, actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
});
