import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { getCatalogue } from '../catalogue';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { adventureDefinitions, adventureEntry } from '../domain/adventure-definitions';
import type { AdventureHub, AdventureTable } from '../domain/adventure-definitions';
import { adventureChoiceAvailable, adventureState, availableHubStories, canBeginHub, emptyAdventureReplay, fatedBoxes, hubProgress, hubRoll, selectAdventureStory } from '../domain/adventures';
import type { AdventureChoice, AdventureEdit } from '../domain/adventures';
import { campaignCycle } from '../domain/campaign';
import { currentMilestone } from '../domain/milestones';
import { useParty } from '../state/PartyProvider';
import { theme } from '../theme/tokens';
import { CampaignPage, campaignStyles } from './CampaignPage';
import { GrowingNotes } from './GrowingNotes';

type Tab = 'hubs' | 'rr' | 'pharos' | 'events';
export function AdventuresPage() {
  const { party } = useParty();
  return <AdventuresBody key={`${party.id}:${campaignCycle(party)}`} />;
}
export function AdventuresBody() {
  const { party, workspace, editAdventure, dispatch, preview } = useParty(), catalogue = getCatalogue(), cycle = campaignCycle(party);
  const data = adventureDefinitions(cycle), state = adventureState(party), replay = workspace.adventureReplay ?? emptyAdventureReplay();
  const stage = currentMilestone(party, 'story', catalogue).side?.label ?? '';
  const [tab, setTab] = useState<Tab>('hubs'), [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chosen, setChosen] = useState<AdventureChoice | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; edit: AdventureEdit } | null>(null);
  const [code, setCode] = useState(''), [help, setHelp] = useState(false);
  const owner = { partyId: party.id, expectedCycle: cycle };
  const save = (edit: AdventureEdit) => editAdventure(owner, edit);
  const match = (text: string) => text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const selected = chosen && adventureChoiceAvailable(party, replay, chosen, catalogue) ? chosen : null;
  const availableHubs = availableHubStories(party, replay, catalogue);
  const last = state.lastAdventure && adventureEntry(state.lastAdventure.entryId);
  const tabs: [Tab, string][] = [['hubs', 'Adventure Hubs'], ['rr', 'R&R'], ...(cycle <= 3 ? [['pharos', 'Pharos'] as [Tab,string]] : []), ['events', 'Story & Events']];
  const checkbox = (label: string, checked: boolean, onPress: () => void, content?: string, disabled = false) => <Button quiet role="checkbox" selected={checked} label={label} disabled={preview || disabled} onPress={onPress} style={styles.boxButton}>
    <View style={[styles.square, checked && styles.marked]}><Text style={[styles.boxText, checked && styles.markedText]}>{checked ? '✓' : content ?? ''}</Text></View>
  </Button>;
  const rows = (table: AdventureTable, hub?: AdventureHub) => table.entries.filter(e => !query.trim() || match(table.title) || match(e.title)).map(entry => {
    const boxes = fatedBoxes(replay, entry.id), available = hub ? canBeginHub(party, hub, entry, replay, stage) : boxes.some(v => !v);
    return <View key={entry.id} style={[styles.storyRow,selected?.entry.id === entry.id && styles.selectedStory]}>
      <Text style={styles.roll}>{entry.label}</Text>
      <View style={styles.storyCell}><Text style={styles.storyTitle}>{entry.title.replace(/(\d{4})(?=\d)/g, '$1\u200b')}</Text>
        <Text style={styles.meta}>{entry.kind === 'opening' ? 'Opening adventure' : entry.kind === 'closing' ? 'Final adventure' : boxes.every(Boolean) ? 'Already played · re-roll' : boxes.some(Boolean) ? `Next: passage ${entry.fatedBoxes[boxes.findIndex(v => !v)]?.passage ?? 'variant'}` : 'Available Fated Box'}</Text>
      </View>
      <View style={styles.rowActions}>
        {entry.fatedBoxes.length > 0 && <View style={styles.boxes}>{entry.fatedBoxes.map((box,index) => {
          const checked = boxes[index], next = boxes.findIndex(v => !v), lastMarked = boxes.lastIndexOf(true);
          const edit: AdventureEdit = { type: 'story-box', entryId: entry.id, index, checked: !checked, expectedStage: stage, expectedProgress: hub ? hubProgress(party,hub) : 0, expectedBoxes: [...boxes] };
          const undoVisit = hub && state.hubs[hub.trackId]?.at(-1) === entry.id;
          return <View key={index}>{checkbox(`${entry.title} Fated Box ${index+1}`,checked,() => checked ? setConfirmation({ title: 'Unmark Fated Box?', message: undoVisit ? 'Undo this hub’s last visit and unmark this story in the shared replay history.' : 'This changes the shared replay history for all campaigns on this device.', edit }) : save(edit),box.passage,checked ? index !== lastMarked : !available || index !== next)}</View>;
        })}</View>}
        {entry.kind !== 'rolled' && <Button quiet label={`Begin ${entry.title}`} disabled={!available || preview} onPress={() => save({ type: 'begin',entryId: entry.id,expectedProgress: hub ? hubProgress(party,hub) : 0,expectedStage: stage,expectedBoxes: [...boxes] })} style={styles.beginButton}><Text style={styles.beginText}>Begin →</Text></Button>}
      </View>
    </View>;
  });
  const hubPanel = (hub: AdventureHub) => {
    const progress = hubProgress(party,hub), range = hubRoll(hub,stage), open = expanded === hub.id, complete = progress === hub.progressBoxCount;
    return <View key={hub.id} style={[styles.card, styles.hub, selected?.hub.id === hub.id && styles.rolledHub]}>
      <Button quiet label={`${open ? 'Close' : 'Open'} ${hub.title} stories`} onPress={() => setExpanded(open ? null : hub.id)} style={styles.hubHeading}>
        <View style={styles.headingText}><Text accessibilityRole="header" style={styles.hubTitle}>{hub.title}</Text><Text style={styles.lightMeta}>Storybook p. {hub.storybookPage} · {progress} / {hub.progressBoxCount}</Text></View><Text style={styles.chevron}>{open ? '−' : '+'}</Text>
      </Button>
      <View style={styles.hubBody}>
        <View style={styles.hubSummary}><Text style={styles.meta}>{range ? `Story ${stage}: roll ${range[0] === range[1] ? range[0] : `${range[0]}–${range[1]}`}` : `Unavailable during Story ${stage}`}</Text><Text style={styles.terrain}>{hub.terrain}</Text></View>
        <View style={styles.progressRow}>{hub.progressLabels.map((label,index) => <View key={index} style={[styles.progressBox,index<progress && styles.progressMarked]}><Text style={[styles.boxText,index<progress && styles.markedText]}>{index<progress ? '✓' : label}</Text></View>)}<Text style={styles.meta}>{complete ? 'Complete' : progress === 0 ? 'Next: opening' : progress === hub.progressBoxCount-1 ? 'Next: ending' : 'Next: roll a story'}</Text></View>
        {open && <>
          {rows(hub,hub)}
          {progress > 0 && <Button quiet label={`Undo last ${hub.title} adventure`} disabled={preview} onPress={() => setConfirmation({ title: 'Undo hub progress?', message: 'Remove the last campaign progress mark. Its Fated Box stays marked; unmark that box separately if this was an accidental selection.', edit: { type: 'undo-hub', id: hub.trackId, expectedProgress: progress, confirmed: true } })} />}
        </>}
      </View>
    </View>;
  };
  const localTrack = (track: { id: string; title: string; boxCount: number; code?: string; printedId?: string; labels?: string[] }) => {
    const boxes = state.boxes[track.id] ?? Array(track.boxCount).fill(false);
    return <View key={track.id} style={campaignStyles.panel}><Text accessibilityRole="header" style={styles.hubTitleDark}>{track.title}{track.code && track.code !== track.title ? ` · ${track.code}` : ''}{track.printedId ? ` · ${track.printedId}` : ''}</Text>
      <View style={styles.boxes}>{boxes.map((checked,index) => <View key={index}>{checkbox(`${track.title} box ${index+1}`,checked,() => save({ type: 'box', id: track.id,index,expected: checked,checked: !checked }),track.labels?.[index] ?? String(index+1))}</View>)}</View>
    </View>;
  };
  return <CampaignPage title="Adventures" subtitle={`Cycle ${cycle} · story references and campaign progress`}>
    <View style={styles.toolbar}><Button quiet label="Back to Argo" onPress={() => router.push('/argo')} /><Button quiet label="Adventure guidance" onPress={() => setHelp(true)} /></View>
    {preview && <Text style={campaignStyles.warning}>Leave the temporary preview to save adventure progress.</Text>}
    {last?.cycle === cycle && <View accessibilityLiveRegion="polite" style={styles.lastAdventure}><Text style={styles.label}>Latest adventure begun</Text><Text style={styles.hubTitleDark}>{last.entry.title}</Text><Text style={styles.meta}>{last.table.title} · Storybook p. {last.table.storybookPage}{state.lastAdventure?.passage ? ` · passage ${state.lastAdventure.passage}` : ''}</Text>{state.lastAdventure?.tableReset && <Text style={styles.meta}>All Fated Boxes in this table were played. Its boxes have reset.</Text>}</View>}
    <View accessibilityRole="tablist" style={styles.tabs}>{tabs.map(([id,label]) => <Button key={id} quiet role="tab" selected={tab === id} label={label} onPress={() => { setTab(id);setQuery(''); }} style={tab === id ? styles.activeTab : undefined}><Text style={[styles.tabText,tab === id && { color: theme.white }]}>{label}</Text></Button>)}</View>
    <TextInput accessibilityLabel="Search adventures" placeholder="Find a story, hub or code…" value={query} onChangeText={setQuery} style={campaignStyles.input} />
    {tab === 'hubs' && <>
      <View style={styles.selection}>
        <View style={styles.selectionHeader}><Text style={styles.label}>Current Story: {stage || '—'}</Text><Button label="Select Story" disabled={preview || !availableHubs.length} onPress={() => {
          const choice = selectAdventureStory(party,replay,catalogue);
          setChosen(choice);
          if (choice) { setExpanded(choice.hub.id);setQuery(''); }
        }} /></View>
        {selected ? <View accessibilityLiveRegion="polite" style={{ gap: 5 }}>
          <Text style={styles.hubTitleDark}>{selected.entry.title}</Text>
          <Text style={styles.meta}>{selected.hub.title} · Storybook p. {selected.hub.storybookPage} · {selected.hub.terrain}</Text>
          {selected.entry.fatedBoxes.find((_,index) => !selected.boxes[index])?.passage && <Text style={styles.result}>Passage {selected.entry.fatedBoxes.find((_,index) => !selected.boxes[index])!.passage}</Text>}
          <Text style={styles.meta}>{selected.entry.kind === 'rolled' ? 'Tick its next Fated Box when you start the story.' : 'Use Begin on the opening or ending story.'}</Text>
        </View> : <Text style={styles.meta}>{availableHubs.length ? 'Randomly choose an available hub and story, using the printed d10 ranges. Tick a story’s next box to record it; opening and ending stories use Begin.' : 'No available hub stories for the current Story card.'}</Text>}
      </View>
      <View style={styles.hubs}>{data.hubs.filter(h => match(h.title) || h.entries.some(e => match(e.title))).map(hubPanel)}</View>
      {!data.hubs.some(h => match(h.title)||h.entries.some(e=>match(e.title))) && <Text style={styles.meta}>No matching hubs or stories.</Text>}
    </>}
    {(tab === 'rr' || tab === 'pharos') && data.tables.filter(t => t.kind === tab).map(table => <View key={table.id} style={[styles.card, styles.table]}><View style={styles.tableHeader}><Text accessibilityRole="header" style={styles.hubTitle}>{table.title}</Text><Text style={styles.lightMeta}>Storybook p. {table.storybookPage} · roll a d10</Text></View><View style={styles.hubBody}><Text style={styles.meta}>Played entries require a re-roll. Numbered second boxes identify alternate passages. All boxes reset when this table is fully played.</Text>{rows(table)}{!table.entries.some(e=>match(table.title)||match(e.title))&&<Text style={styles.meta}>No matching stories.</Text>}</View></View>)}
    {tab === 'events' && <>
      <Text style={styles.meta}>Mark these boxes only when the story instructs you. These event records belong to this campaign.</Text>
      <View style={styles.hubs}>{data.tracks.filter(t=>match(`${t.title} ${t.code??''} ${t.printedId??''}`)).map(localTrack)}{data.unlistedSheetTracks.filter(t=>match(t.title)).map(track=><View key={track.id} style={{ flexGrow: 1,flexBasis: 320,minWidth: 0 }}>{localTrack(track)}<Text style={[styles.meta,{ margin: 8 }]}>Story list not supplied yet.</Text></View>)}</View>
      <View style={campaignStyles.panel}><Text accessibilityRole="header" style={styles.hubTitleDark}>Secret story codes</Text><Text style={styles.meta}>Record a four-digit passage as resolved once per campaign.</Text><View style={styles.boxes}><TextInput accessibilityLabel="Secret story code" value={code} onChangeText={text=>setCode(text.replace(/\D/g,''))} keyboardType="number-pad" maxLength={4} placeholder="0000" style={[campaignStyles.input,{ width: 90 }]} /><Button label="Record resolved code" disabled={preview||!/^\d{4}$/.test(code)||state.secretCodes.includes(code)} onPress={()=>{save({ type:'secret',code,resolved:true,expected:false });setCode('');}} /></View>
      <View style={styles.boxes}>{state.secretCodes.filter(match).map(code=><Button key={code} quiet label={`Unmark resolved code ${code}`} disabled={preview} onPress={()=>setConfirmation({ title:'Unmark resolved code?',message:`Allow passage ${code} to be resolved again in this campaign.`,edit:{ type:'secret',code,resolved:false,expected:true,confirmed:true } })}><Text style={styles.storyTitle}>{code} ✓</Text></Button>)}</View></View>
    </>}
    <View style={campaignStyles.panel}><Text accessibilityRole="header" style={styles.hubTitleDark}>Adventure notes</Text><GrowingNotes label="Adventure records" value={party.argo?.records.adventures ?? ''} onChange={text=>dispatch({type:'argo-record',partyId:party.id,argonautId:party.activeArgonautId,id:'adventures',text,expectedCycle:cycle})} /></View>
    <Text style={styles.meta}>Fated history is shared across campaigns on this device and included in backups. Story text is read in your cycle’s Storybook.</Text>
    {confirmation && <Sheet visible title={confirmation.title} onClose={()=>setConfirmation(null)}><Text style={campaignStyles.body}>{confirmation.message}</Text><Button label="Confirm change" onPress={()=>{save(confirmation.edit);setConfirmation(null);}} /><Button quiet label="Cancel" onPress={()=>setConfirmation(null)} /></Sheet>}
    {help && <Sheet visible wide title="Adventure guidance" onClose={()=>setHelp(false)}>
      <Text style={campaignStyles.body}>Hub adventures: use the current Story card’s column to select a hub. The first progress box resolves α, the last resolves Ω; empty middle boxes use the hub’s d10 story table. A completed hub requires a re-roll.</Text>
      <Text style={campaignStyles.body}>Fated Boxes: mark the first unplayed box for a rolled entry. A second box may direct you to a different passage. Re-roll exhausted entries. When all boxes in a table are marked, that table resets. Fated history carries across playthroughs.</Text>
      <Text style={campaignStyles.body}>Tests: roll d10 + skill against the target. A natural 10 succeeds; a natural 1 fails. Argonaut Fate can re-roll Argonaut tests; Argo Fate applies to Argo tests. Resolve group-test outcomes as the story instructs.</Text>
      <Text style={campaignStyles.body}>Pharos Delve: draw Major Trauma cards and total their numbers. Reach the printed target while staying below 16; 16 or more is a bust.</Text>
      <Text style={campaignStyles.body}>Follow the printed Story and Doom card for progression. Choice Matrix, timeline and other narrative effects are applied in their own sections. This page records references and boxes; it does not resolve unseen story paragraphs.</Text>
    </Sheet>}
  </CampaignPage>;
}
const styles = StyleSheet.create({
  toolbar:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8},label:{fontSize:12,fontWeight:'700',color:theme.ink},boxes:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:4},
  tabs:{flexDirection:'row',flexWrap:'wrap',gap:6},activeTab:{backgroundColor:theme.charcoal,borderColor:theme.gold},tabText:{color:theme.ink,fontSize:12,fontWeight:'600'},
  selectionHeader:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},selectedStory:{backgroundColor:'#E6EDE8'},selection:{gap:8,backgroundColor:'#ECE9DF',borderRadius:5,padding:12},result:{fontSize:14,color:'#32565A',fontWeight:'600',flexShrink:1},hubs:{flexDirection:'row',flexWrap:'wrap',gap:12,alignItems:'flex-start'},card:{minWidth:0,borderWidth:1,borderColor:theme.line,borderRadius:6,overflow:'hidden',backgroundColor:theme.paper},hub:{flexGrow:1,flexShrink:1,flexBasis:350},table:{width:'100%',flexShrink:0},rolledHub:{borderColor:'#32565A',borderWidth:2},
  hubHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,borderWidth:0,borderRadius:0,backgroundColor:'#263C3F',padding:14},headingText:{gap:6,flex:1,minWidth:0},hubTitle:{color:theme.paper,fontSize:19,fontFamily:theme.serif},hubTitleDark:{color:theme.ink,fontSize:19,fontFamily:theme.serif},lightMeta:{color:'#D5DBD8',fontSize:11},chevron:{fontSize:24,color:theme.paper},
  hubBody:{padding:12,gap:10},hubSummary:{gap:5},terrain:{color:'#32565A',fontSize:12,fontWeight:'600'},meta:{color:theme.muted,fontSize:11,lineHeight:17},progressRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6},progressBox:{width:28,height:28,borderWidth:1,borderColor:theme.ink,alignItems:'center',justifyContent:'center',borderRadius:2},progressMarked:{backgroundColor:'#32565A',borderColor:'#32565A'},
  storyRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6,paddingVertical:8,borderTopWidth:1,borderTopColor:theme.line},roll:{width:32,flexShrink:0,color:theme.muted,fontWeight:'700',fontSize:11,textAlign:'center'},storyCell:{flexGrow:1,flexShrink:1,flexBasis:180,minWidth:0,gap:4},storyTitle:{color:theme.ink,fontSize:14,lineHeight:21},rowActions:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end',marginLeft:'auto',flexShrink:0},
  boxButton:{padding:0,borderWidth:0},square:{width:25,height:25,borderWidth:1.5,borderColor:theme.ink,borderRadius:2,alignItems:'center',justifyContent:'center'},marked:{backgroundColor:'#32565A',borderColor:'#32565A'},boxText:{color:theme.ink,fontSize:12},markedText:{color:theme.white},beginButton:{paddingHorizontal:8,borderWidth:0},beginText:{fontSize:11,color:'#32565A',fontWeight:'600'},tableHeader:{backgroundColor:'#263C3F',padding:14,gap:6},lastAdventure:{backgroundColor:'#E6EDE8',borderLeftWidth:3,borderLeftColor:'#32565A',padding:14,gap:6},
});
