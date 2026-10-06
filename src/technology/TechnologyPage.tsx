import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { CampaignPage, campaignStyles as styles } from '../campaign/CampaignPage';
import { Button } from '../components/Button';
import { TechnologyCard } from '../components/cards/TechnologyCard';
import { GearRecipeLink } from '../components/cards/GearRecipeLink';
import { coreTechnologyWidth } from '../components/cards/technology-layout';
import { SecretCard } from '../components/cards/SecretCard';
import { RemovalConfirmation } from '../components/RemovalConfirmation';
import { Sheet } from '../components/Sheet';
import { campaignCycle } from '../domain/campaign';
import { faceForReference } from '../domain/card-presentation';
import type { CardDefinition } from '../domain/cards';
import { activeTechnologyIds, argoAbilityLimit, currentCoreTechnologies, projectList, TECHNOLOGY_TYPES, technologyAvailable, technologyCycle, technologyName, technologyResearchStatus, technologyType } from '../domain/technologies';
import type { TechnologySide, TechnologyType } from '../domain/technologies';
import { useParty } from '../state/PartyProvider';
import { CampaignCardVisibility, useSpoilers } from '../state/SpoilerProvider';
import { theme } from '../theme/tokens';
import { TechnologyTabs } from './TechnologyTabs';

type Tab = 'projects' | 'abilities' | 'catalogue';
type CombatProjectType = 'All' | 'Argo Ability' | 'Production Facility';
const tabs = [{ id: 'projects', label: 'Project List' }, { id: 'abilities', label: 'Abilities' }, { id: 'catalogue', label: 'Technologies' }] as const;
const types = TECHNOLOGY_TYPES.map(id => ({ id, label: id }));
const catalogueTypes = types.filter(option => option.id !== 'Core');

export function TechnologyPage() {
  const { party } = useParty();
  return <CampaignCardVisibility definitionIds={activeTechnologyIds(party, getCatalogue())}><TechnologyBody key={party.id} /></CampaignCardVisibility>;
}
function TechnologyBody() {
  const { party, dispatch } = useParty(), catalogue = getCatalogue(), spoilers = useSpoilers(), { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('projects'), [group, setGroup] = useState<'Structural' | 'Combat'>('Structural');
  const [type, setType] = useState<TechnologyType>('Structural'), [filter, setFilter] = useState<TechnologyType | 'All'>('All');
  const [query, setQuery] = useState(''), [page, setPage] = useState(0), [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null), [reference, setReference] = useState<string | null>(null);
  const [combatType, setCombatType] = useState<CombatProjectType>('All');
  const cycle = campaignCycle(party), ids = activeTechnologyIds(party, catalogue), limit = argoAbilityLimit(party, catalogue);
  const available = catalogue.search({ family: 'Technology', campaignCycle: cycle }).filter(card => technologyType(card) !== 'Core');
  const catalogueFilter = catalogueTypes.some(option => option.id === filter) ? filter : 'All';
  const coreIds = new Set(currentCoreTechnologies(party, catalogue).map(card => card.id));
  const active = ids.flatMap(id => { const card = catalogue.get(id); return card && technologyType(card) && (technologyType(card) !== 'Core' || coreIds.has(id)) ? [card] : []; });
  const projects = projectList(party, catalogue);
  const missing = ids.filter(id => !catalogue.get(id) || !technologyType(catalogue.get(id)!));
  const matches = (tab === 'projects' ? projects.filter(card => group === 'Structural' ? technologyType(card) === 'Structural'
    : technologyType(card) !== 'Structural' && (combatType === 'All' || technologyType(card) === combatType))
    : tab === 'abilities' ? active.filter(card => technologyType(card) === type)
    : available.filter(card => catalogueFilter === 'All' || technologyType(card) === catalogueFilter))
    .filter(card => query.trim().toLowerCase().split(/\s+/).every(term => [...card.faces.map(face => face.name), ...card.printedIds].join(' ').toLowerCase().includes(term)))
    .sort((a, b) => technologyCycle(b) - technologyCycle(a) ||
      technologyName(a, tab === 'projects' ? 'project' : 'technology').localeCompare(technologyName(b, tab === 'projects' ? 'project' : 'technology')) || a.id.localeCompare(b.id));
  const pageCount = Math.max(1, Math.ceil(matches.length / 12)), currentPage = Math.min(page, pageCount - 1), cardWidth = Math.max(160, Math.min(270, width - 80));
  const sections = new Map<string, CardDefinition[]>();
  for (const card of matches.slice(currentPage * 12, (currentPage + 1) * 12)) {
    const label = card.faces[0].cycle.trim() || 'Other cycles';
    sections.set(label, [...(sections.get(label) ?? []), card]);
  }
  function selectTab(value: Tab) { setTab(value); setPage(0); setQuery(''); setNotice(''); }
  function record(card: CardDefinition) {
    if (spoilers.hidden(card)) return;
    const status = technologyResearchStatus(card, party, catalogue);
    if (!status.canResearch) return;
    dispatch({ type: 'technology-research', partyId: party.id, argonautId: party.activeArgonautId, definitionId: card.id });
    setNotice(`${technologyName(card, 'technology')} added to Abilities. Project availability has been updated.`);
  }
  function openReference(id: string) {
    const resolution = catalogue.resolveReference(id);
    if (resolution.status === 'resolved') router.push({ pathname: '/cards/[id]', params: { id: resolution.card.id, face: faceForReference(resolution.card, id).id } });
    else setReference(id);
  }
  const resolution = reference ? catalogue.resolveReference(reference) : null;
  return <CampaignPage title="Technology" subtitle={`Campaign technologies through Cycle ${cycle}`}>
    <TechnologyTabs<Tab> label="Technology pages" options={tabs} selected={tab} onSelect={selectTab} />
    {tab === 'projects' ? <>
      <TechnologyTabs label="Project types" options={[{ id: 'Structural', label: 'Structural' }, { id: 'Combat', label: 'Combat' }]} selected={group} onSelect={value => { setGroup(value); setPage(0); }} />
      {group === 'Combat' && <TechnologyTabs<CombatProjectType> label="Combat project types" options={[
        { id: 'All', label: 'All Combat' }, { id: 'Argo Ability', label: 'Argo Abilities' }, { id: 'Production Facility', label: 'Production Facilities' },
      ]} selected={combatType} onSelect={value => { setCombatType(value); setPage(0); }} />}
      <Text style={styles.body}>Research an available project to add its benefits to Abilities. Technology prerequisites and recorded Argo Knowledge/Fate are checked. Other printed requirements remain for you to verify in the game.</Text>
      <Text style={styles.meta}>Use research during the appropriate Structural or Battle Breakthrough. Timeline timing and research effects are resolved in the game.</Text>
    </> : tab === 'abilities' ? <>
      <TechnologyTabs label="Active technology types" options={types} selected={type} onSelect={value => { setType(value); setPage(0); }} />
      {type === 'Core' && <Text style={styles.body}>Core technologies for Cycle {cycle} are always available here.</Text>}
      {type === 'Argo Ability' && <Text style={styles.body}>Recorded AA limit: {limit ?? 'no Propylon recorded'}. Printed charges and abilities are shown below.</Text>}
    </> : <>
      <TechnologyTabs<TechnologyType | 'All'> label="Catalogue technology types" options={[{ id: 'All', label: 'All' }, ...catalogueTypes]} selected={catalogueFilter} onSelect={value => { setFilter(value); setPage(0); }} />
      <Text style={styles.body}>Inspect both sides of researchable technologies available in this cycle and earlier cycles. Core technologies are in Abilities.</Text>
    </>}
    <TextInput accessibilityLabel="Search technologies" placeholder="Search technology name or ID" value={query} onChangeText={value => { setQuery(value); setPage(0); }} style={styles.input} />
    {notice !== '' && <Text accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text>}
    <Text accessibilityLiveRegion="polite" style={styles.meta}>{matches.length} {tab === 'projects' ? 'available projects' : 'technologies'} · Page {currentPage + 1} of {pageCount}</Text>
    {matches.length === 0 && <View style={styles.panel}>
      <Text style={styles.body}>{query ? 'No technologies match this search.' : tab === 'abilities' ? 'No technologies of this type have been added yet.' : tab === 'projects' ? 'No projects of this type are currently available. Research prerequisite technologies to open further projects. Inspect all available-cycle cards and their requirements in Technologies.' : 'No technologies of this type are available in this cycle.'}</Text>
      {tab === 'projects' && <Button quiet label="View technology requirements" onPress={() => { selectTab('catalogue'); setFilter(group === 'Structural' ? 'Structural' : combatType === 'All' ? 'All' : combatType); }} />}
      {tab === 'projects' && <Button quiet label="View Core technologies" onPress={() => { selectTab('abilities'); setType('Core'); }} />}
    </View>}
    {[...sections].map(([label, cards]) => <View key={`${tab}:${label}`} style={local.section}>
      <View style={local.divider}><Text accessibilityRole="header" style={styles.heading}>{label}</Text><View style={local.dividerLine} /></View>
      <View style={local.grid}>{cards.map(card => <TechnologyTile key={`${tab}:${card.id}`} card={card} width={technologyType(card) === 'Core' ? coreTechnologyWidth(width - 80, width) : cardWidth} initialSide={tab === 'projects' ? 'project' : 'technology'}
        active={ids.includes(card.id)} onRecord={() => record(card)} onRemove={() => setRemoving({ id: card.id, name: technologyName(card, 'technology') })} onReference={openReference} />)}</View>
    </View>)}
    {pageCount > 1 && <View style={styles.row}><Button quiet label="Previous page" disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} /><Button quiet label="Next page" disabled={currentPage >= pageCount - 1} onPress={() => setPage(currentPage + 1)} /></View>}
    {tab === 'abilities' && missing.map(id => <View key={id} style={styles.panel}><Text style={styles.warning}>Unavailable technology: {id}</Text><Button quiet label="Remove unavailable technology" onPress={() => setRemoving({ id, name: id })} /></View>)}
    {removing && <RemovalConfirmation subject={removing.name} detail="This removes the campaign technology record. Already researched successors are retained; future project availability is recalculated." onCancel={() => setRemoving(null)} onConfirm={() => {
      dispatch({ type: 'technology-remove', partyId: party.id, argonautId: party.activeArgonautId, definitionId: removing.id, confirmed: true }); setRemoving(null);
    }} />}
    {reference && resolution && <Sheet visible title="Referenced card" subtitle={reference} onClose={() => setReference(null)}>
      {resolution.status === 'missing' ? <Text style={styles.body}>This reference is missing from the bundled catalogue.</Text> : resolution.status === 'ambiguous' ? <>
        <Text style={styles.body}>This ID matches more than one card. Choose the reference.</Text>
        {resolution.cards.map(card => <Button key={card.id} quiet label={spoilers.hidden(card) ? `Unrevealed card · ${card.faces[0].cycle}` : `${card.faces[0].name} · ${card.faces[0].cycle}`} onPress={() => {
          setReference(null); router.push({ pathname: '/cards/[id]', params: { id: card.id, face: faceForReference(card, reference).id } });
        }} />)}
      </> : null}
    </Sheet>}
  </CampaignPage>;
}
function TechnologyTile({ card, width, initialSide, active, onRecord, onRemove, onReference }: {
  card: CardDefinition; width: number; initialSide: TechnologySide; active: boolean; onRecord: () => void; onRemove: () => void; onReference: (id: string) => void;
}) {
  const { party } = useParty(), spoilers = useSpoilers(), [side, setSide] = useState(initialSide);
  const status = technologyResearchStatus(card, party, getCatalogue()), hidden = spoilers.hidden(card);
  return <View style={[local.tile, { width: width + 24 }]}>
    {hidden ? <SecretCard card={card} onReveal={() => spoilers.reveal(card.id)} /> : <TechnologyCard card={card} side={side} width={width} requirementStatus={status.requirements} onReference={onReference}
      renderRecipeLink={(id, label) => <GearRecipeLink id={id} label={label} onReference={onReference} />} />}
    {!hidden && <Button quiet label={side === 'project' ? 'View technology' : 'View project'} onPress={() => setSide(side === 'project' ? 'technology' : 'project')} />}
    {status.core ? <Text style={styles.meta}>{currentCoreTechnologies(party, getCatalogue()).some(core => core.id === card.id) ? `Always available in Cycle ${campaignCycle(party)} Abilities` : `Core technology for ${card.faces[0].cycle}`}</Text>
      : active ? <><Text style={styles.meta}>Added to campaign Abilities{!technologyAvailable(card, party) ? ' · retained from a later cycle' : ''}</Text><Button quiet label="Remove technology" onPress={onRemove} /></>
      : <Button label="Research project" disabled={hidden || !status.canResearch} onPress={onRecord} />}
  </View>;
}
const local = StyleSheet.create({
  section: { gap: 16 }, divider: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 }, dividerLine: { flex: 1, height: 1, backgroundColor: theme.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', justifyContent: 'center' },
  tile: { maxWidth: '100%', padding: 12, gap: 12, borderWidth: 1, borderColor: theme.line, borderRadius: 8, backgroundColor: theme.paper },
});
