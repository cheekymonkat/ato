import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { adventureDefinitions, adventureEntry, allAdventureDefinitions } from '../src/domain/adventure-definitions.ts';
import { adventureChoiceAvailable, adventureState, availableHubStories, canBeginHub, changeAdventure, emptyAdventureReplay, fatedBoxes, hubForRoll, hubProgress, hubRoll, inwardReplayId, mergeAdventureReplay, selectAdventureStory, validAdventureReplay } from '../src/domain/adventures.ts';
import { newProfile, parseWorkspace, editWorkspaceAdventure, exportProfile, readBackup, importProfile } from '../src/storage/workspace.ts';
import { currentMilestone, selectMilestone } from '../src/domain/milestones.ts';
import { parseParty } from '../src/domain/party.ts';
import { startCampaignCycle } from '../src/domain/campaign.ts';
const catalogue=createCatalogueRepository(JSON.parse(readFileSync(new URL('../data/generated/catalogue.json',import.meta.url))));
const makeParty=(cycle=1)=>newProfile('p','Odyssey',catalogue.version,cycle).party;
const begin=(party,replay,id)=>changeAdventure(party,replay,{type:'begin',entryId:id,expectedProgress:adventureEntry(id)?.table.trackId ? adventureState(party).hubs[adventureEntry(id).table.trackId]?.length??0 : 0,expectedStage:currentMilestone(party,'story',catalogue).side?.label??'',expectedBoxes:fatedBoxes(replay,id)},catalogue);
const stage=(party,label)=>{const current=currentMilestone(party,'story',catalogue);return selectMilestone(party,'story',current.sequence.find(s=>s.label===label).reference,current.reference,catalogue);};
const storyBox=(party,replay,id,index,checked=true)=>changeAdventure(party,replay,{type:'story-box',entryId:id,index,checked,expectedProgress:adventureEntry(id)?.table.trackId ? adventureState(party).hubs[adventureEntry(id).table.trackId]?.length??0 : 0,expectedStage:currentMilestone(party,'story',catalogue).side?.label??'',expectedBoxes:fatedBoxes(replay,id)},catalogue);
const randomChoice=(party,replay,hubRoll,storyRoll)=>{const rolls=[hubRoll,storyRoll];return selectAdventureStory(party,replay,catalogue,()=>rolls.shift());};

test('all supplied adventure rows preserve titles, references, box counts and reviewed selection order',()=>{
  const data=allAdventureDefinitions();
  assert.deepEqual(data.map(d=>d.hubs.length),[7,8,7,7,7]);
  assert.equal(data.flatMap(d=>d.hubs).flatMap(h=>h.entries).length,255);
  assert.equal(data.flatMap(d=>d.tables).filter(t=>t.kind==='rr').flatMap(t=>t.entries).length,50);
  assert.equal(data.flatMap(d=>d.tables).filter(t=>t.kind==='pharos').flatMap(t=>t.entries).length,30);
  const ids=data.flatMap(d=>[...d.hubs,...d.tables]).flatMap(t=>t.entries.map(e=>e.id));
  assert.equal(new Set(ids).size,ids.length);
  for(const d of data) for(const h of d.hubs){
    assert.equal(h.entries[0].kind,'opening');assert.equal(h.entries.at(-1).kind,'closing');
    assert.equal(h.entries[0].fatedBoxes.length,0);assert.equal(h.entries.at(-1).fatedBoxes.length,0);
    assert.equal(h.progressLabels.length,h.progressBoxCount);
    for(const stage of ['1A','1B','2A','2B','3A','3B','4A','4B']) {
      const ranges=d.hubs.flatMap(h=>hubRoll(h,stage)?[hubRoll(h,stage)]:[]);
      const rolls=ranges.flatMap(([a,b])=>Array.from({length:b-a+1},(_,i)=>a+i));
      assert.deepEqual(rolls,[1,2,3,4,5,6,7,8,9,10],`Cycle ${d.cycle} Story ${stage}`);
    }
  }
  assert.equal(data[1].hubs.at(-1).entries[0].title,'The Thousandth Ship');
  assert.equal(data[1].hubs.at(-1).entries.at(-1).title,'Siege Eternal');
  assert.equal(data[3].hubs[0].title,'The Salt Road');
  assert.equal(data[3].hubs.at(-1).entries[0].title,'The Hand You Were Dealt');
  assert.equal(data[4].hubs[0].title,'Pieces and Wholes');
  assert.equal(data[4].hubs[1].entries[1].title,'Law Writ in Stone');
  assert.ok(data[0].tables[1].entries.some(e=>e.title.includes('01892519156208521815142651651516125')));
  assert.deepEqual(data[0].tables[0].entries.filter(e=>e.fatedBoxes.length===2).map(e=>e.fatedBoxes[1].passage),['11','22','99']);
  assert.equal(data[3].tables[0].entries[3].fatedBoxes[1].passage,'44');
  assert.equal(data[4].tracks.filter(t=>t.kind==='code').length,38);
});

test('hub visits enforce opening, rolled stories, final ending and printed campaign capacity',()=>{
  const hub=adventureDefinitions(1).hubs[0];let party=makeParty(),replay=emptyAdventureReplay();
  assert.equal(hubProgress(party,hub),0);
  assert.equal(canBeginHub(party,hub,hub.entries[1],replay,'1A'),false);
  assert.equal(begin(party,replay,hub.entries.at(-1).id).party,party);
  ({party,replay}=begin(party,replay,hub.entries[0].id));
  assert.equal(hubProgress(party,hub),1);assert.deepEqual(fatedBoxes(replay,hub.entries[0].id),[]);
  assert.equal(begin(party,replay,hub.entries[0].id).party,party);
  for(let i=1;i<hub.progressBoxCount-1;i++)({party,replay}=begin(party,replay,hub.entries[i].id));
  assert.equal(canBeginHub(party,hub,hub.entries[3],replay,'1A'),false);
  ({party,replay}=begin(party,replay,hub.entries.at(-1).id));
  assert.equal(hubProgress(party,hub),hub.progressBoxCount);
  assert.equal(begin(party,replay,hub.entries.at(-1).id).party,party);
  assert.equal(parseParty(party).argo.adventures.lastAdventure.leaderId,undefined);
});

test('hub selection follows side-specific Story columns and unavailable hubs remain blocked',()=>{
  let party=makeParty(4);const data=adventureDefinitions(4),replay=emptyAdventureReplay();
  assert.equal(hubForRoll(party,4,catalogue).title,'The Salt Road');
  party=stage(party,'1B');assert.equal(hubForRoll(party,4,catalogue).title,'Aristotle’s Promise');
  assert.equal(begin(party,replay,data.hubs.at(-1).entries[0].id).party,party);
  party=stage(party,'4B');assert.equal(hubForRoll(party,10,catalogue).title,'The Crescent and the Full Moon');
  assert.equal(hubForRoll(party,0,catalogue),null);assert.equal(hubForRoll(party,11,catalogue),null);
});

test('Select Story respects printed hub probabilities and does not mark the selected story',()=>{
  const party=makeParty(),replay=emptyAdventureReplay();
  const before=structuredClone({party,replay});
  for(const [roll,hub] of [[0,'Fated Conundrum'],[0.299,'Fated Conundrum'],[0.3,'Plight of the People'],[0.6,'Hidden in Plain Sight'],[0.9,'Man of Purpose'],[0.999,'Man of Purpose']]) {
    const choice=randomChoice(party,replay,roll,0);
    assert.equal(choice.hub.title,hub);assert.equal(choice.entry.kind,'opening');
    assert.equal(adventureChoiceAvailable(party,replay,choice,catalogue),true);
  }
  assert.deepEqual({party,replay},before);
  let cycle4=makeParty(4);
  assert.equal(randomChoice(cycle4,replay,0.35,0).hub.title,'The Salt Road');
  cycle4=stage(cycle4,'1B');
  assert.equal(randomChoice(cycle4,replay,0.35,0).hub.title,'Aristotle’s Promise');
});

test('Select Story re-rolls played stories and completed hubs, preserving remaining printed weights',()=>{
  const hub=adventureDefinitions(1).hubs[1];let party=makeParty(),replay=emptyAdventureReplay();
  ({party,replay}=begin(party,replay,hub.entries[0].id));
  // Witness has one d10 result, Discarded has two: selection follows 1/10 then 2/10.
  assert.equal(randomChoice(party,replay,0.4,0.099).entry.title,'Witness of Minos');
  assert.equal(randomChoice(party,replay,0.4,0.1).entry.title,'Discarded');
  ({party,replay}=storyBox(party,replay,hub.entries[1].id,0));
  assert.equal(randomChoice(party,replay,0.4,0).entry.title,'Discarded');
  assert.equal(randomChoice(party,replay,0.4,0.22).entry.title,'Discarded');
  assert.equal(randomChoice(party,replay,0.4,0.223).entry.title,'Cult of the Bull');
  ({party,replay}=storyBox(party,replay,hub.entries[2].id,0));
  ({party,replay}=storyBox(party,replay,hub.entries[3].id,0));
  assert.equal(randomChoice(party,replay,0.4,0.5).entry.kind,'closing');
  ({party,replay}=begin(party,replay,hub.entries.at(-1).id));
  assert.equal(availableHubStories(party,replay,catalogue).some(c=>c.hub.id===hub.id),false);
  assert.equal(randomChoice(party,replay,0.4,0).hub.title,'Fated Conundrum');
  assert.equal(randomChoice(party,replay,0.5,0).hub.title,'Hidden in Plain Sight');
});

test('Select Story returns no choice when all available hubs are complete and rejects invalid random values',()=>{
  let party=makeParty(),replay=emptyAdventureReplay();
  for(const {hub} of availableHubStories(party,replay,catalogue)) {
    ({party,replay}=begin(party,replay,hub.entries[0].id));
    for(let i=1;i<hub.progressBoxCount-1;i++)({party,replay}=storyBox(party,replay,hub.entries[i].id,0));
    ({party,replay}=begin(party,replay,hub.entries.at(-1).id));
  }
  assert.equal(selectAdventureStory(party,replay,catalogue,()=>{throw new Error('No roll should be needed');}),null);
  for(const invalid of [-0.1,1,NaN,Infinity])assert.equal(selectAdventureStory(makeParty(),replay,catalogue,()=>invalid),null);
});

test('a highlighted choice becomes stale when Story, visit count, replay history or cycle changes',()=>{
  let party=makeParty(),replay=emptyAdventureReplay();
  const choice=randomChoice(party,replay,0,0);
  assert.equal(adventureChoiceAvailable(stage(party,'1B'),replay,choice,catalogue),false);
  assert.equal(adventureChoiceAvailable(makeParty(2),replay,choice,catalogue),false);
  ({party,replay}=begin(party,replay,choice.entry.id));
  assert.equal(adventureChoiceAvailable(party,replay,choice,catalogue),false);
  const rolled=randomChoice(party,replay,0,0);
  const playedElsewhere={version:1,boxes:{[rolled.entry.id]:[true]}};
  assert.equal(adventureChoiceAvailable(party,playedElsewhere,rolled,catalogue),false);
});

test('story checkboxes unlock after the opening and record a visit and Fated Box together',()=>{
  const hub=adventureDefinitions(1).hubs[0],entry=hub.entries[1];let party=makeParty(),replay=emptyAdventureReplay();
  assert.equal(storyBox(party,replay,entry.id,0).party,party);
  ({party,replay}=begin(party,replay,hub.entries[0].id));
  ({party,replay}=storyBox(party,replay,entry.id,0));
  assert.equal(hubProgress(party,hub),2);assert.deepEqual(fatedBoxes(replay,entry.id),[true]);
  assert.equal(storyBox(party,replay,entry.id,0).party,party);
  ({party,replay}=storyBox(party,replay,entry.id,0,false));
  assert.equal(hubProgress(party,hub),1);assert.deepEqual(fatedBoxes(replay,entry.id),[false]);
  // Correcting an older history entry must leave a different latest visit intact.
  ({party,replay}=storyBox(party,replay,entry.id,0));
  ({party,replay}=storyBox(party,replay,hub.entries[2].id,0));
  ({party,replay}=storyBox(party,replay,entry.id,0,false));
  assert.equal(hubProgress(party,hub),3);assert.equal(adventureState(party).hubs[hub.trackId].at(-1),hub.entries[2].id);
});

test('story checkboxes enforce variant order and reject stale, invalid and wrong-cycle edits',()=>{
  const entry=adventureDefinitions(1).tables[0].entries[0];let party=makeParty(),replay=emptyAdventureReplay();
  assert.equal(storyBox(party,replay,entry.id,1).party,party);
  const edit={type:'story-box',entryId:entry.id,index:0,checked:true,expectedProgress:0,expectedStage:'1A',expectedBoxes:[false,false]};
  for(const override of [{index:-1},{index:2},{index:0.5},{expectedBoxes:[false]},{expectedStage:'1B'},{entryId:adventureDefinitions(2).tables[0].entries[0].id}]) {
    const result=changeAdventure(party,replay,{...edit,...override},catalogue);
    assert.equal(result.party,party);assert.equal(result.replay,replay);
  }
  ({party,replay}=storyBox(party,replay,entry.id,0));
  assert.equal(changeAdventure(party,replay,edit,catalogue).replay,replay);
  ({party,replay}=storyBox(party,replay,entry.id,1));
  assert.equal(adventureState(party).lastAdventure.passage,'11');
  assert.equal(storyBox(party,replay,entry.id,0,false).replay,replay);
  ({party,replay}=storyBox(party,replay,entry.id,1,false));
  assert.deepEqual(fatedBoxes(replay,entry.id),[true,false]);
});

test('marking the final story checkbox resets that table while retaining the chosen variant',()=>{
  let party=makeParty(),replay=emptyAdventureReplay();const rr=adventureDefinitions(1).tables[0];
  const last=rr.entries.find(entry=>entry.fatedBoxes.some(box=>box.passage==='99'));
  for(const entry of [...rr.entries.filter(entry=>entry!==last),last])for(let index=0;index<entry.fatedBoxes.length;index++)({party,replay}=storyBox(party,replay,entry.id,index));
  assert.equal(adventureState(party).lastAdventure.tableReset,true);
  assert.equal(adventureState(party).lastAdventure.passage,'99');
  assert.ok(rr.entries.every(entry=>fatedBoxes(replay,entry.id).every(v=>!v)));
});

test('R&R picks first box then alternate passage; exhausted entries require a re-roll',()=>{
  let party=makeParty(),replay=emptyAdventureReplay();const entry=adventureDefinitions(1).tables[0].entries[0];
  ({party,replay}=begin(party,replay,entry.id));assert.deepEqual(fatedBoxes(replay,entry.id),[true,false]);
  assert.equal(adventureState(party).lastAdventure.passage,undefined);
  ({party,replay}=begin(party,replay,entry.id));assert.equal(adventureState(party).lastAdventure.passage,'11');
  assert.deepEqual(fatedBoxes(replay,entry.id),[true,true]);
  assert.equal(begin(party,replay,entry.id).party,party);
});

test('last Fated Box resets only its complete table and retains selected passage in the campaign record',()=>{
  let party=makeParty(),replay=emptyAdventureReplay();const rr=adventureDefinitions(1).tables[0],other=adventureDefinitions(1).tables[1].entries[0];
  ({party,replay}=begin(party,replay,other.id));
  for(const entry of rr.entries) for(const _ of entry.fatedBoxes)({party,replay}=begin(party,replay,entry.id));
  assert.equal(adventureState(party).lastAdventure.tableReset,true);
  assert.ok(rr.entries.every(e=>fatedBoxes(replay,e.id).every(v=>!v)));
  assert.deepEqual(fatedBoxes(replay,other.id),[true]);
});

test('undo requires confirmation and expected count and does not erase replay history',()=>{
  const hub=adventureDefinitions(1).hubs[0];let party=makeParty(),replay=emptyAdventureReplay();
  ({party,replay}=begin(party,replay,hub.entries[0].id));({party,replay}=begin(party,replay,hub.entries[1].id));
  for(const edit of [{expectedProgress:2,confirmed:false},{expectedProgress:1,confirmed:true}])assert.equal(changeAdventure(party,replay,{type:'undo-hub',id:hub.trackId,...edit},catalogue).party,party);
  const next=changeAdventure(party,replay,{type:'undo-hub',id:hub.trackId,expectedProgress:2,confirmed:true},catalogue);
  assert.equal(hubProgress(next.party,hub),1);assert.equal(next.replay,replay);
  assert.deepEqual(fatedBoxes(next.replay,hub.entries[1].id),[true]);
});

test('stale selections, wrong cycles and unknown references are no-ops',()=>{
  const party=makeParty(),replay=emptyAdventureReplay(),entry=adventureDefinitions(1).hubs[0].entries[0];
  const edit={type:'begin',entryId:entry.id,expectedProgress:0,expectedStage:'1A',expectedBoxes:[]};
  for(const override of [{expectedProgress:1},{expectedStage:'1B'},{expectedBoxes:[true]},{entryId:'missing'},{entryId:adventureDefinitions(2).hubs[0].entries[0].id}])assert.equal(changeAdventure(party,replay,{...edit,...override},catalogue).party,party);
  const rr=adventureDefinitions(1).tables[0].entries[0];
  const next=begin(party,replay,rr.id);
  assert.equal(changeAdventure(next.party,next.replay,{type:'begin',entryId:rr.id,expectedProgress:0,expectedStage:'1A',expectedBoxes:[false,false]},catalogue).party,next.party);
});

test('Fated and campaign event boxes reject out-of-range, wrong-cycle and stale changes',()=>{
  const party=makeParty(),replay=emptyAdventureReplay(),id=adventureDefinitions(1).tables[0].entries[0].id;
  for(const index of [-1,2,1.5])assert.equal(changeAdventure(party,replay,{type:'fated-box',entryId:id,index,expected:false,checked:true},catalogue).replay,replay);
  const next=changeAdventure(party,replay,{type:'fated-box',entryId:id,index:0,expected:false,checked:true},catalogue);
  assert.equal(changeAdventure(party,next.replay,{type:'fated-box',entryId:id,index:0,expected:false,checked:false},catalogue).replay,next.replay);
  const track=adventureDefinitions(2).tracks[0];
  assert.equal(changeAdventure(party,replay,{type:'box',id:track.id,index:0,expected:false,checked:true},catalogue).party,party);
});

test('Inward Fated history tracks reads without changing Knowledge and resets its twenty-box table',()=>{
  let party=makeParty(2),replay=emptyAdventureReplay();const before=structuredClone(party.resources),id=inwardReplayId(2);
  for(let i=0;i<20;i++)({party,replay}=changeAdventure(party,replay,{type:'fated-box',entryId:id,index:i,expected:false,checked:true},catalogue));
  assert.deepEqual(party.resources,before);assert.ok(fatedBoxes(replay,id).every(v=>!v));
});

test('four-digit codes retain zeroes, cannot be resolved twice, and synchronize printed single boxes',()=>{
  let party=makeParty(2),replay=emptyAdventureReplay();
  for(const code of ['248','02480','abcd'])assert.equal(changeAdventure(party,replay,{type:'secret',code,resolved:true,expected:false},catalogue).party,party);
  ({party,replay}=changeAdventure(party,replay,{type:'secret',code:'0248',resolved:true,expected:false},catalogue));
  assert.deepEqual(adventureState(party).secretCodes,['0248']);assert.deepEqual(adventureState(party).boxes['c2-code-0248'],[true]);
  assert.equal(changeAdventure(party,replay,{type:'secret',code:'0248',resolved:true,expected:false},catalogue).party,party);
  assert.equal(changeAdventure(party,replay,{type:'secret',code:'0248',resolved:false,expected:true},catalogue).party,party);
  ({party,replay}=changeAdventure(party,replay,{type:'box',id:'c2-code-0248',index:0,expected:true,checked:false},catalogue));
  assert.deepEqual(adventureState(party).secretCodes,[]);
});

test('campaign-local progress survives a cycle advance while a new campaign shares only replay history',()=>{
  let profile=newProfile('p','Odyssey',catalogue.version),workspace={format:'ato-workspace',schemaVersion:1,activeProfileId:'p',profiles:[profile]};
  const entry=adventureDefinitions(1).tables[0].entries[0];
  workspace=editWorkspaceAdventure(workspace,{partyId:'p',expectedCycle:1},{type:'begin',entryId:entry.id,expectedProgress:0,expectedStage:'1A',expectedBoxes:[false,false]},catalogue);
  const advanced=startCampaignCycle(workspace.profiles[0].party,2);
  assert.deepEqual(advanced.argo.adventures,workspace.profiles[0].party.argo.adventures);
  const fresh=newProfile('new','Second playthrough',catalogue.version);workspace={...workspace,profiles:[...workspace.profiles,fresh],activeProfileId:'new'};
  assert.deepEqual(fatedBoxes(workspace.adventureReplay,entry.id),[true,false]);
  assert.deepEqual(adventureState(fresh.party).hubs,{});
  const edit={type:'story-box',entryId:entry.id,index:0,checked:true,expectedProgress:0,expectedStage:'1A',expectedBoxes:[true,false]};
  assert.equal(editWorkspaceAdventure(workspace,{partyId:'p',expectedCycle:1},edit,catalogue),workspace);
  assert.equal(editWorkspaceAdventure(workspace,{partyId:'new',expectedCycle:2},edit,catalogue),workspace);
});

test('new and old saves validate; malformed adventure records and replay arrays are rejected',()=>{
  const profile=newProfile('p','Odyssey',catalogue.version),workspace={format:'ato-workspace',schemaVersion:1,activeProfileId:'p',profiles:[profile]};
  assert.equal(parseWorkspace(workspace).adventureReplay,undefined);
  assert.equal(validAdventureReplay({version:1,boxes:{missing:[true]}}),false);
  assert.equal(validAdventureReplay({version:1,boxes:{'c1-inward-odyssey':[true]}}),false);
  const entry=adventureDefinitions(1).hubs[0].entries[1],bad={...profile.party,argo:{version:1,tracks:{},limits:{},records:{},adventures:{version:1,hubs:{[adventureDefinitions(1).hubs[0].trackId]:[entry.id]},boxes:{},secretCodes:[]}}};
  assert.throws(()=>parseParty(bad),/Argo/);
  assert.throws(()=>parseWorkspace({...workspace,adventureReplay:{version:2,boxes:{}}}),/replay/);
});

test('backups include campaign and replay state and imports combine histories without replacing unrelated tables',()=>{
  const entry=adventureDefinitions(1).tables[0].entries[0],other=adventureDefinitions(1).tables[1].entries[0];
  const profile=newProfile('p','Odyssey',catalogue.version),started=begin(profile.party,emptyAdventureReplay(),entry.id);
  const read=readBackup(exportProfile({...profile,party:started.party},started.replay),catalogue);
  assert.deepEqual(read.adventureReplay,started.replay);
  const workspace={format:'ato-workspace',schemaVersion:1,activeProfileId:'p',profiles:[profile],adventureReplay:{version:1,boxes:{[other.id]:[true]}}};
  const imported=importProfile(workspace,read.profile,'new','Imported',read.adventureReplay);
  assert.deepEqual(fatedBoxes(imported.adventureReplay,entry.id),[true,false]);assert.deepEqual(fatedBoxes(imported.adventureReplay,other.id),[true]);
  assert.ok(imported.profiles.at(-1).party.argo.adventures.lastAdventure);
  const malformed=JSON.parse(exportProfile(profile));malformed.adventureReplay={version:1,boxes:{[entry.id]:[true]}};
  assert.throws(()=>readBackup(JSON.stringify(malformed),catalogue),/replay/);
  const complete=adventureDefinitions(1).tables[1];
  const union=mergeAdventureReplay({version:1,boxes:Object.fromEntries(complete.entries.slice(0,5).map(e=>[e.id,[true]]))},{version:1,boxes:Object.fromEntries(complete.entries.slice(5).map(e=>[e.id,[true]]))});
  assert.ok(complete.entries.every(e=>fatedBoxes(union,e.id).every(v=>!v)));
});
