import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCatalogueRepository} from '../src/catalogue/repository.ts';
import * as definitions from '../src/domain/adventure-definitions.ts';
import * as adventures from '../src/domain/adventures.ts';
import * as campaign from '../src/domain/campaign.ts';
import * as milestones from '../src/domain/milestones.ts';
import {newProfile,editWorkspaceAdventure,exportProfile,readBackup,importProfile} from '../src/storage/workspace.ts';
import {partyReducer} from '../src/state/party-reducer.ts';
const require=createRequire(import.meta.url),React=require('react'),web=require('react-native-web'),ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server');
const root=fileURLToPath(new URL('../src/campaign/',import.meta.url));
const catalogue=createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json',import.meta.url))));
function compile(name,mocks){
 const filename=path.join(root,name),load=Module._load;
 Module._load=function(request,parent,...args){return parent?.filename===filename&&Object.hasOwn(mocks,request)?mocks[request]:load.call(this,request,parent,...args);};
 try{const module=new Module(filename);module.filename=filename;module.paths=Module._nodeModulePaths(root);module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return module.exports;}finally{Module._load=load;}
}
function harness(cycle=1,preview=false){
 const profile=newProfile('p','Odyssey',catalogue.version,cycle);let workspace={format:'ato-workspace',schemaVersion:1,activeProfileId:'p',profiles:[profile]},cursor=0,route;
 const slots=[],buttons=new Map(),inputs=new Map(),sheets=[];
 const party=()=>workspace.profiles.find(p=>p.id===workspace.activeProfileId).party;
 const useState=initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>slots[index]=typeof value==='function'?value(slots[index]):value];};
 const Button=props=>{buttons.set(props.label,props);return React.createElement('button',{disabled:props.disabled,'aria-label':props.label,role:props.role,'aria-checked':props.role==='checkbox'?props.selected:undefined},props.children??props.label);};
 const TextInput=props=>{inputs.set(props.accessibilityLabel,props);return React.createElement('input',{'aria-label':props.accessibilityLabel,value:props.value,readOnly:true});};
 const {AdventuresBody}=compile('AdventuresPage.tsx',{
  '../theme/tokens':{theme:{ink:'#292723',paper:'#FAF9F6',serif:'Georgia',white:'#FFFFFF',muted:'#706E67',line:'#D6D2C8',charcoal:'#211B14',gold:'#B69964'}},react:{useState},'react-native':{...web,TextInput},'expo-router':{router:{push:value=>route=value}},
  '../components/Button':{Button},'../components/Sheet':{Sheet:props=>{sheets.push(props);return React.createElement('section',{'aria-label':props.title},props.children);}},
  './CampaignPage':{campaignStyles:{},CampaignPage:({children})=>React.createElement('main',null,children)},
  './GrowingNotes':{GrowingNotes:props=>{inputs.set(props.label,props);return React.createElement('textarea',{'aria-label':props.label,value:props.value,readOnly:true});}},
  '../catalogue':{getCatalogue:()=>catalogue},'../domain/adventure-definitions':definitions,'../domain/adventures':{...adventures,selectAdventureStory:(party,replay,catalogue)=>adventures.selectAdventureStory(party,replay,catalogue,()=>0)},'../domain/campaign':campaign,'../domain/milestones':milestones,
  '../state/PartyProvider':{useParty:()=>({party:party(),workspace,preview,editAdventure:(owner,edit)=>{if(!preview)workspace=editWorkspaceAdventure(workspace,owner,edit,catalogue);},dispatch:action=>{workspace={...workspace,profiles:workspace.profiles.map(p=>p.id===workspace.activeProfileId?{...p,party:partyReducer(p.party,action,catalogue)}:p)};}})},
 });
 const render=()=>{cursor=0;buttons.clear();inputs.clear();sheets.length=0;return renderToStaticMarkup(React.createElement(AdventuresBody));};
 const press=label=>{const b=buttons.get(label);assert.ok(b,`Missing ${label}`);assert.ok(!b.disabled,`Disabled ${label}`);b.onPress();return render();};
 return{party,workspace:()=>workspace,render,press,buttons,inputs,sheets,route:()=>route,restore:()=>{const p=workspace.profiles.find(p=>p.id===workspace.activeProfileId),backup=readBackup(exportProfile(p,workspace.adventureReplay),catalogue);workspace=importProfile(workspace,backup.profile,'restored','Restored',backup.adventureReplay);}};
}

test('Adventures shows named hubs with Select Story, no Party Leader or duplicate Inward section',()=>{
 const h=harness();let html=h.render();
 assert.match(html,/Fated Conundrum/);assert.doesNotMatch(html,/Exploration|Party Leader|Inward Odyssey|Records &amp; cards/);
 assert.equal(h.inputs.has('Adventure Hub d10 result'),false);
 const before=structuredClone(h.workspace());
 html=h.press('Select Story');assert.match(html,/Bitter Seeds/);assert.ok(h.buttons.has('Close Fated Conundrum stories'));
 assert.deepEqual(h.workspace(),before);assert.equal(h.sheets.length,0);
 assert.ok(h.buttons.has('Begin Bitter Seeds'));assert.equal(h.buttons.has('Begin The Pilgrimage'),false);
 assert.equal(h.buttons.get('The Pilgrimage Fated Box 1').disabled,true);
 h.press('Back to Argo');assert.equal(h.route(),'/argo');
});

test('opening Begin is direct; eligible story boxes record progress without a detail popup',()=>{
 const h=harness(),hub=definitions.adventureDefinitions(1).hubs[0];h.render();h.press('Open Fated Conundrum stories');
 h.press('Begin Bitter Seeds');assert.equal(h.sheets.length,0);
 assert.equal(adventures.hubProgress(h.party(),hub),1);
 assert.equal(h.buttons.get('Begin Bitter Seeds').disabled,true);
 assert.equal(h.buttons.get('The Pilgrimage Fated Box 1').disabled,false);
 h.press('Select Story');assert.match(h.render(),/Tick its next Fated Box/);
 h.press('The Pilgrimage Fated Box 1');assert.equal(h.sheets.length,0);
 assert.deepEqual(adventures.fatedBoxes(h.workspace().adventureReplay,hub.entries[1].id),[true]);
 assert.equal(adventures.hubProgress(h.party(),hub),2);
 h.press('The Pilgrimage Fated Box 1');assert.match(h.render(),/Undo this hub’s last visit/);
 h.press('Cancel');assert.equal(adventures.hubProgress(h.party(),hub),2);
 h.press('The Pilgrimage Fated Box 1');h.press('Confirm change');assert.equal(adventures.hubProgress(h.party(),hub),1);
 assert.equal(h.buttons.get('The Pilgrimage Fated Box 1').selected,false);
 h.press('The Pilgrimage Fated Box 1');h.press('Dream of the Maw Fated Box 1');h.press('Stewards Fated Box 1');
 assert.equal(h.buttons.get('The Feast Fated Box 1').disabled,true);
 assert.equal(h.buttons.get('Begin A City Made of Riddles').disabled,false);
 h.press('Begin A City Made of Riddles');assert.equal(h.sheets.length,0);
 assert.equal(adventures.hubProgress(h.party(),hub),hub.progressBoxCount);
});

test('R&R enables variants in order, records directly, confirms undo and restores its backup',()=>{
 const h=harness();h.render();h.press('R&R');
 assert.equal(h.buttons.has('Begin Catch of the Day'),false);
 assert.equal(h.buttons.get('Catch of the Day Fated Box 2').disabled,true);
 h.press('Catch of the Day Fated Box 1');assert.equal(h.sheets.length,0);
 let html=h.press('Catch of the Day Fated Box 2');assert.match(html,/passage 11/);assert.equal(h.sheets.length,0);
 assert.equal(h.buttons.get('Catch of the Day Fated Box 1').disabled,true);
 h.press('Catch of the Day Fated Box 2');assert.match(h.render(),/shared replay history/);h.press('Cancel');assert.equal(h.buttons.get('Catch of the Day Fated Box 2').selected,true);
 h.press('Catch of the Day Fated Box 2');h.press('Confirm change');assert.equal(h.buttons.get('Catch of the Day Fated Box 2').selected,false);
 h.restore();html=h.render();assert.match(html,/Catch of the Day/);assert.equal(h.buttons.get('Catch of the Day Fated Box 1').selected,true);
});

test('R&R and Pharos retain every story and checkbox without a separate reading popup',()=>{
 const h=harness();h.render();
 for(const [tab,kind] of [['R&R','rr'],['Pharos','pharos']]) {
  const html=h.press(tab),table=definitions.adventureDefinitions(1).tables.find(t=>t.kind===kind);
  for(const entry of table.entries) {
   // Numeric Pharos titles contain soft wrap points; compare their visible text.
   assert.ok(html.replaceAll('&#x27;',"'").replaceAll('&amp;','&').replaceAll('\u200b','').includes(entry.title));
   assert.ok(h.buttons.has(`${entry.title} Fated Box 1`));
  }
  h.press(`${table.entries[0].title} Fated Box 1`);assert.equal(h.sheets.length,0);
 }
});

test('cycle-specific event tracks, missing story lists and once-only code controls render',()=>{
 const h=harness(5);let html=h.render();assert.equal(h.buttons.has('Pharos'),false);assert.match(html,/Pieces and Wholes/);
 html=h.press('Story & Events');assert.match(html,/Fracturess/);assert.match(html,/Sermons on the Shoals/);assert.match(html,/Story list not supplied/);assert.ok(h.buttons.has('0611 box 1'));
 h.inputs.get('Secret story code').onChangeText('0611');h.render();h.press('Record resolved code');
 assert.equal(h.buttons.get('0611 box 1').selected,true);assert.ok(h.buttons.has('Unmark resolved code 0611'));
 h.inputs.get('Secret story code').onChangeText('0611');h.render();assert.equal(h.buttons.get('Record resolved code').disabled,true);
});

test('search filters stories, previews cannot change history, and controls are not nested buttons',()=>{
 const h=harness();h.render();h.press('R&R');h.inputs.get('Search adventures').onChangeText('goats');const html=h.render();assert.match(html,/The One with the Goats/);assert.doesNotMatch(html,/Lysistrata|Drunken Odyssey/);
 let depth=0;for(const tag of html.matchAll(/<\/?button\b[^>]*>/g)){if(tag[0].startsWith('</'))depth--;else{assert.equal(depth,0,'nested button');depth++;}}assert.equal(depth,0);
 const preview=harness(1,true);assert.match(preview.render(),/temporary preview/);assert.equal(preview.buttons.get('Select Story').disabled,true);
 preview.press('Open Fated Conundrum stories');assert.equal(preview.buttons.get('Begin Bitter Seeds').disabled,true);
 preview.press('R&R');assert.equal(preview.buttons.get('Catch of the Day Fated Box 1').disabled,true);
});
