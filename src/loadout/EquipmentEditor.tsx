import { equipmentSupplyIssue, gearStock, inventoryFor, physicalGearLimit } from '../domain/inventory';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { CardActionButton } from '../components/cards/CardActionButton';
import { CardActionRow } from '../components/cards/CardActionRow';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { GearCard } from '../components/cards/GearCard';
import { SecretCard } from '../components/cards/SecretCard';
import { GearResults } from '../components/cards/GearResults';
import { campaignCycle, isFaceAvailableInCycle } from '../domain/campaign';
import { titanLoadoutRules } from '../domain/hand-rules';
import type { CardDefinition } from '../domain/cards';
import { loadoutState, planEquipment, slotOptions } from '../domain/loadout';
import type { EquipRequest } from '../domain/loadout';
import type { Argonaut } from '../domain/party';
import { meetsSlotRestriction, slotRestrictionLabel } from '../domain/slots';
import type { CapacityPosition } from '../domain/slots';
import { useParty } from '../state/PartyProvider';
import { CampaignCardVisibility, useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { positionFromRoute, positionRouteParam } from './position-params';

interface Params { position?: string; instance?: string; definition?: string; face?: string; q?: string }
const labels = { hand: 'Weapon', armor: 'Armor', support: 'Support', attachment: 'Attachment', mnemos: 'Mnemos', 'fated-mnemos': 'Fated Mnemos' };
function positionLabel(position: CapacityPosition, positions: CapacityPosition[]) {
  return `${labels[position.kind]} ${positions.filter(entry => entry.kind === position.kind).findIndex(entry => entry.id === position.id) + 1}${position.source ? ' (bonus)' : ''}`;
}

export function EquipmentEditor({ argonaut, params }: { argonaut: Argonaut; params: Params }) {
  const { party } = useParty();
  return <CampaignCardVisibility definitionIds={Object.keys(inventoryFor(party, getCatalogue()).gear)}><EquipmentEditorBody argonaut={argonaut} params={params} /></CampaignCardVisibility>;
}
function EquipmentEditorBody({ argonaut, params }: { argonaut: Argonaut; params: Params }) {
  const { party, dispatch } = useParty(), spoilers = useSpoilers(), { width } = useWindowDimensions(), catalogue = getCatalogue();
  const cycle = campaignCycle(party);
  const [query, setQuery] = useState(params.q || ''), [allGear, setAllGear] = useState(false), [page, setPage] = useState(0);
  const [searching, setSearching] = useState(!params.definition && !params.instance);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [units, setUnits] = useState<number | undefined>(), [override, setOverride] = useState(false), [reason, setReason] = useState('');
  const [newId] = useState(() => `${argonaut.id}:gear:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  const scroll = useRef<ScrollView>(null);
  const state = useMemo(() => loadoutState(argonaut, catalogue), [argonaut, catalogue]);
  const instance = argonaut.instances.find(item => item.id === params.instance), assignment = argonaut.equipment.find(entry => entry.instanceId === instance?.id);
  const target = positionFromRoute(state.positions, params.position);
  const selected = catalogue.get(params.definition || instance?.definitionId || '');
  const face = selected?.faces.find(face => face.id === (params.face || instance?.faceId || 'front')) || selected?.faces[0];
  const otherFace = selected?.faces.find(side => side.id !== face?.id);
  const hidden = selected && spoilers.hidden(selected), reuse = Boolean(instance && selected?.id === instance.definitionId);
  const options = face ? slotOptions(face, titanLoadoutRules(argonaut, catalogue)).filter(option => !target || option.kind === target.kind) : [];
  const selectedUnits = units ?? (reuse && face?.id === instance?.faceId ? options.find(option => option.units === assignment?.positionIds.length)?.units : undefined) ?? options[0]?.units ?? 1;
  const request: EquipRequest | null = selected && face && target ? { definitionId: selected.id, faceId: face.id, positionId: target.id,
    instanceId: reuse ? instance!.id : newId, reuse, units: selectedUnits, overrideReason: override ? reason : undefined } : null;
  const plan = request ? planEquipment(argonaut, request, catalogue) : null;
  const available = isFaceAvailableInCycle(face, cycle);
  const supplyIssue = plan?.next ? equipmentSupplyIssue(party, argonaut, plan.next, catalogue) : null;
  const stock = selected && gearStock(party, selected.id, catalogue);
  const printedLimit = selected && physicalGearLimit(selected, catalogue);
  const canSave = Boolean(!supplyIssue && available && plan?.next && !hidden && (!override || reason.trim()));
  const matches = catalogue.search({ family: 'Gear', query, campaignCycle: cycle }).filter(card => (!party.inventory?.enforce || card.id === instance?.definitionId || gearStock(party, card.id, catalogue).available > 0) && card.faces.some(face =>
    isFaceAvailableInCycle(face, cycle) && (allGear || !target || slotOptions(face, titanLoadoutRules(argonaut, catalogue)).some(option => option.kind === target.kind) && meetsSlotRestriction(face, target))));
  const lastPage = Math.max(0, Math.ceil(matches.length / 12) - 1), currentPage = Math.min(page, lastPage);
  const ownedFace = instance && catalogue.getFace(instance.definitionId, instance.faceId);
  const ownDefinition = instance && catalogue.get(instance.definitionId), ownHidden = ownDefinition && spoilers.hidden(ownDefinition);
  const nameOf = (definitionId: string, faceId: string) => {
    const card = catalogue.get(definitionId);
    return card && spoilers.hidden(card) ? 'Unrevealed Gear' : catalogue.getFace(definitionId, faceId)?.name || 'Unavailable Gear';
  };
  const back = () => router.replace({ pathname: '/argonaut/[id]', params: { id: argonaut.id } });
  function choose(definitionId: string, faceId: string) {
    setSearching(false); setUnits(undefined); setOverride(false); setReason('');
    router.setParams({ definition: definitionId, face: faceId });
    scroll.current?.scrollTo({ y: 0, animated: true });
  }
  const faceForCard = (card: CardDefinition) => {
    const eligible = (face: typeof card.faces[number]) => isFaceAvailableInCycle(face, cycle) && (!target || allGear || slotOptions(face, titanLoadoutRules(argonaut, catalogue)).some(option => option.kind === target.kind) && meetsSlotRestriction(face, target));
    return card.faces.find(face => eligible(face) && (!query.trim() || face.name.toLowerCase().includes(query.trim().toLowerCase())))
      || card.faces.find(eligible) || card.faces[0];
  };
  const showSearch = searching || !selected;
  const removeButton = instance && <CardActionButton action="Remove" cardName={nameOf(instance.definitionId, instance.faceId)}
    onPress={() => setRemoving({ id: instance.id, name: nameOf(instance.definitionId, instance.faceId) })} />;
  if (removing) return <RemovalConfirmation subject={removing.name} detail="This removes the card from this Argonaut’s loadout."
    onCancel={() => setRemoving(null)} onConfirm={() => {
      dispatch({ type: 'remove-equipment', argonautId: argonaut.id, instanceId: removing.id }); back();
    }} />;
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={styles.page}>
    <View style={styles.row}><Button quiet label="Back to Argonaut" onPress={back} /><Text style={styles.meta}>{argonaut.name || 'Argonaut'} · Loadout</Text></View>
    <Text accessibilityRole="header" style={styles.title}>{instance ? 'Edit equipment' : 'Choose equipment'}</Text>
    <Text style={styles.body}>{target ? positionLabel(target, state.positions) : 'Choose a destination to reassign this card.'}</Text>
    {target?.eligibility && <Text style={styles.warning}>{slotRestrictionLabel(target.eligibility)} in this bonus position.</Text>}
    {!target && <View style={styles.panel}><Text style={styles.heading}>Destination</Text><View style={styles.row}>
      {state.positions.filter(position => !['mnemos', 'fated-mnemos'].includes(position.kind)).map(position => <Button key={position.id} quiet label={positionLabel(position, state.positions)} onPress={() => { setUnits(undefined); setOverride(false); router.setParams({ position: positionRouteParam(position.id) }); }} />)}
    </View></View>}
    {instance && assignment && <View style={styles.panel}>
      <Text style={styles.heading}>Current card: {ownHidden ? 'Unrevealed Gear' : ownedFace?.name || 'Unavailable Gear'}</Text>
      <Text style={styles.body}>{instance.discarded ? 'Discarded' : instance.exhausted ? 'Exhausted' : 'Ready'}{state.activeInstanceIds.has(instance.id) ? '' : ' · Needs reassignment'}</Text>
      {assignment.override && <Text style={styles.warning}>Manual override: {assignment.override.reason}</Text>}
      {showSearch && <CardActionRow>{removeButton}</CardActionRow>}
    </View>}
    {!showSearch && selected && face && <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.heading}>Review selection</Text>
      <View style={{ alignItems: 'center' }}>{hidden ? <SecretCard card={selected} compact onReveal={() => spoilers.reveal(selected.id)} /> : face.kind === 'gear' && <GearCard face={face} width={Math.min(270, width - 66)} exhausted={Boolean(reuse && (instance?.exhausted || instance?.discarded))} />}</View>
      <CardActionRow>
        {!hidden && otherFace && <CardActionButton action="Flip" cardName={face.name} onPress={() => { setUnits(undefined); setOverride(false); router.setParams({ face: otherFace.id }); }} />}
        <CardActionButton action="Change card" onPress={() => { setSearching(true); scroll.current?.scrollTo({ y: 0, animated: true }); }} />
        {removeButton}
      </CardActionRow>
      {!hidden && <>
        <Text style={styles.body}>{face.kind === 'gear' ? `${face.data.slot} · ${face.data.traits.join(' · ')}` : face.family}</Text>
        <Text style={styles.meta}>Check any special requirements in the card’s ability text before equipping.</Text>
        {options.length > 1 && <View style={styles.row}>{options.map(option => <Button key={`${option.kind}:${option.units}`} quiet label={option.label} selected={option.units === selectedUnits} onPress={() => { setUnits(option.units); setOverride(false); }} />)}</View>}
        {plan?.replacedIds.map(id => {
          const old = argonaut.instances.find(item => item.id === id)!;
          return <Text key={id} style={styles.warning}>Replaces {nameOf(old.definitionId, old.faceId)}. </Text>;
        })}
        {plan?.errors.map(error => <Text key={error} style={styles.warning}>{error}</Text>)}
        {plan?.issues.map((entry, index) => <Text key={`${entry.code}:${index}`} style={styles.warning}>{entry.message}</Text>)}
        {plan?.issues.some(entry => entry.requiresOverride) && <View style={styles.effect}>
          <Button quiet label={override ? 'Cancel manual override' : 'Use a manual override'} onPress={() => setOverride(!override)} />
          {override && <TextInput accessibilityLabel="Manual override reason" placeholder="Explain the exception" value={reason} onChangeText={setReason} maxLength={300} style={styles.input} />}
        </View>}
      </>}
      {party.inventory?.enforce && stock && <Text style={styles.meta}>{stock.owned} acquired · {stock.allocated} allocated · {stock.available} available in campaign inventory.</Text>}
      {!party.inventory?.enforce && stock && printedLimit != null && <Text style={styles.meta}>{printedLimit} printed {printedLimit === 1 ? 'copy' : 'copies'} · {stock.allocated} allocated across all Argonauts.</Text>}
      {supplyIssue && <Text style={styles.warning}>{supplyIssue.message}</Text>}
      {supplyIssue?.kind === 'inventory' && <Button quiet label="Manage Cargo" onPress={() => router.push('/cargo')} />}
      {!available && <Text style={styles.warning}>This card is unavailable in campaign Cycle {cycle}. Change the cycle on the campaign page to equip it.</Text>}
      <Button label={override ? 'Save with override' : reuse ? 'Save placement' : 'Equip card'} disabled={!canSave} onPress={() => {
        if (!request || !plan?.next) return;
        dispatch({ type: 'equip', argonautId: argonaut.id, request }); back();
      }} />
    </View>}
    {showSearch && <View style={styles.panel}><Text accessibilityRole="header" style={styles.heading}>{instance ? 'Replace with Gear' : 'Find Gear'}</Text>
      {selected && <Button quiet label="Back to selection" onPress={() => { setSearching(false); scroll.current?.scrollTo({ y: 0, animated: true }); }} />}
      <TextInput accessibilityLabel="Search equipment by name or printed ID" placeholder="Search name or ID" value={query} onChangeText={value => { setQuery(value); setPage(0); router.setParams({ q: value }); }} style={styles.input} />
      <Text style={styles.meta}>Available through campaign Cycle {cycle}. Change the cycle on the campaign page.</Text>
      <Button quiet label={allGear ? 'Show matching Gear' : 'Show all Gear for manual exceptions'} onPress={() => { setAllGear(!allGear); setPage(0); }} />
      {party.inventory?.enforce && <View style={styles.row}><Text style={styles.meta}>Showing available acquired copies. Manual slot exceptions also require an acquired copy.</Text><Button quiet label="Manage Cargo" onPress={() => router.push('/cargo')} /></View>}
      <Text accessibilityLiveRegion="polite" style={styles.meta}>{matches.length} matching cards · Page {currentPage + 1} of {lastPage + 1}</Text>
      <GearResults cards={matches.slice(currentPage * 12, (currentPage + 1) * 12)} width={Math.min(270, width - 66)} selecting
        faceForCard={faceForCard} onSelect={(card, face) => choose(card.id, face.id)} />
      {matches.length === 0 && <Text style={styles.body}>No matching Gear. Change the search or show all Gear to review an exception.</Text>}
      {lastPage > 0 && <View style={styles.row}><Button quiet label="Previous page" disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} />
        <Button quiet label="Next page" disabled={currentPage === lastPage} onPress={() => setPage(currentPage + 1)} /></View>}
    </View>}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.canvas }, page: { padding: 16, paddingBottom: 40, gap: 20, width: '100%', maxWidth: 900, marginHorizontal: 'auto' },
  title: { fontFamily: theme.serif, color: theme.ink, fontSize: 28 }, heading: { fontFamily: theme.serif, fontSize: 20, color: theme.ink },
  body: { color: theme.ink, fontSize: 14, lineHeight: 22 }, meta: { color: theme.muted, fontSize: 12, lineHeight: 18 }, warning: { color: theme.danger, fontSize: 14, lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, panel: { backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 6, padding: 16, gap: 16 },
  effect: { gap: 12, borderTopWidth: 1, borderColor: theme.line, paddingTop: 12 }, input: { minHeight: 48, borderWidth: 1, borderColor: theme.line, borderRadius: 5, padding: 12, fontSize: 16, color: theme.ink },
});
