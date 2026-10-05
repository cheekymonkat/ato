import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { cardAbilities, exhaustedAbilities } from '../src/domain/ability-state.ts';
import { hasExhaustCost } from '../src/domain/ability-costs.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup } from '../src/storage/workspace.ts';
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const named = name => catalogue.byName(name)[0];
const face = name => named(name).faces[0];
const instance = (name,id) => ({id,definitionId:named(name).id,faceId:'front',exhausted:false,enabledEffectIds:[],counters:{}});
const fresh = () => createParty('p',['a','b','c','d'],catalogue.version);
const withMemory = (name='A Dream You Hold',nodes=7) => {
  const party=fresh(),item={...instance(name,'memory'),memoryProgress:{node:nodes,growthUnlocked:false}};
  party.argonauts[0].instances=[item];party.argonauts[0].mnemosIds[0]=item.id;
  return party;
};
const toggle = (party,item,abilityId,exhausted=true,owner='a') => partyReducer(party,{type:'ability-exhausted',argonautId:owner,instanceId:item.id,definitionId:item.definitionId,faceId:item.faceId,abilityId,exhausted},catalogue);

test('Mnemos abilities exhaust independently while passive stats, nodes and other abilities remain unchanged',()=>{
  const original=withMemory(),item=original.argonauts[0].instances[0],rows=cardAbilities(face('A Dream You Hold'),item.memoryProgress);
  const paid=rows.filter(r=>hasExhaustCost(r.heading));assert.equal(paid.length,2);
  let party=toggle(original,item,paid[0].id);
  assert.deepEqual(party.argonauts[0].instances[0],{...item,exhaustedAbilityIds:[paid[0].id]});
  assert.equal(party.argonauts[1],original.argonauts[1]);
  assert.equal(toggle(party,item,rows[0].id),party);
  party=toggle(party,item,paid[1].id);
  party=toggle(party,item,paid[0].id,false);
  assert.deepEqual(party.argonauts[0].instances[0].exhaustedAbilityIds,[paid[1].id]);
});

test('node gateways block exhausting locked abilities, preserve IDs and keep readiness when panels hide',()=>{
  let party=withMemory('Family Feud',2),item=party.argonauts[0].instances[0];
  const rows=cardAbilities(face('Family Feud'),item.memoryProgress);
  assert.equal(toggle(party,item,rows[1].id),party);
  party=partyReducer(party,{type:'memory-node',argonautId:'a',instanceId:item.id,delta:1},catalogue);
  party=toggle(party,item,rows[1].id);
  party=partyReducer(party,{type:'memory-node',argonautId:'a',instanceId:item.id,delta:-1},catalogue);
  assert.deepEqual(party.argonauts[0].instances[0].exhaustedAbilityIds,[rows[1].id]);
  assert.equal(toggle(party,item,rows[2].id),party);
});

test('Titan exhaustion changes only the selected paid ability and rejects stale ownership/selection callbacks',()=>{
  let party=fresh();const item=instance('Gamechanger','titan');party.argonauts[0].titan=item;
  const rows=cardAbilities(face('Gamechanger'));
  assert.equal(toggle(party,item,rows[0].id,true,'b'),party);
  assert.equal(toggle(party,item,rows[1].id),party);
  party=toggle(party,item,rows[0].id);
  assert.deepEqual(party.argonauts[0].titan.exhaustedAbilityIds,[rows[0].id]);assert.equal(party.argonauts[0].titan.exhausted,false);
  const changed=partyReducer(party,{type:'titan',argonautId:'a',titan:instance('Earthshaker','titan')},catalogue);
  assert.equal(toggle(changed,item,rows[0].id),changed);
});

test('legacy whole-card flags map only to unlocked paid abilities and convert on the first ability edit',()=>{
  const party=withMemory('A Dream You Hold',3),item=party.argonauts[0].instances[0];item.exhausted=true;
  const paid=cardAbilities(face('A Dream You Hold'),item.memoryProgress).filter(r=>r.available&&hasExhaustCost(r.heading));
  assert.deepEqual(exhaustedAbilities(item,face('A Dream You Hold')),paid.map(r=>r.id));
  const next=toggle(party,item,paid[0].id,false).argonauts[0].instances[0];
  assert.equal(next.exhausted,false);assert.deepEqual(next.exhaustedAbilityIds,[]);
});

test('Refresh Gear and Tides of Fate clear ability state without losing memory progress or assignments',()=>{
  let party=withMemory(),item=party.argonauts[0].instances[0],paid=cardAbilities(face('A Dream You Hold'),item.memoryProgress).find(r=>hasExhaustCost(r.heading));
  party=toggle(party,item,paid.id);
  const titan=instance('Gamechanger','titan');party.argonauts[0].titan=titan;
  party=toggle(party,titan,cardAbilities(face('Gamechanger'))[0].id);
  const before=structuredClone(party);
  party=partyReducer(party,{type:'refresh-gear',argonautId:'a'},catalogue);
  assert.deepEqual(party.argonauts[0].instances[0],{...before.argonauts[0].instances[0],exhaustedAbilityIds:[]});
  assert.deepEqual(party.argonauts[0].titan.exhaustedAbilityIds,[]);
  party=partyReducer(before,{type:'clear-all',argonautId:'a',partyId:before.id,confirmed:true},catalogue);
  assert.deepEqual(party.argonauts[0].instances[0].memoryProgress,item.memoryProgress);
  assert.deepEqual(party.argonauts[0].titan.exhaustedAbilityIds,[]);
});

test('per-ability readiness round-trips through portable backups and rejects malformed saved lists',()=>{
  let party=withMemory(),item=party.argonauts[0].instances[0];
  party=toggle(party,item,cardAbilities(face('A Dream You Hold'),item.memoryProgress)[1].id);
  assert.deepEqual(readBackup(exportProfile({id:'p',name:'Abilities',party}),catalogue).profile.party,party);
  for(const ids of [true,[1],[''],['same','same']]){
    const malformed=structuredClone(party);malformed.argonauts[0].instances[0].exhaustedAbilityIds=ids;
    assert.throws(()=>parseParty(malformed),/exhausted abilities/);
  }
});

test('Fated Growth exhaustion cannot be paid before resolution and remains separate from the front effect',()=>{
  const original=face('Selfishness');
  const fated={...original,data:{...original.data,effect:{abilityText:[{type:'plainText',value:'Front'}],costs:['Exhaust']},growthAbility:{abilityText:[{type:'plainText',value:'Growth'}],costs:['Exhaust']}}};
  const customRepo={...catalogue,getFace:(id,side)=>id==='fixture'&&side==='front'?fated:catalogue.getFace(id,side)};
  let party=fresh(),item={...instance('Selfishness','fated'),definitionId:'fixture',memoryProgress:{node:0,growthUnlocked:false}};
  party.argonauts[0].instances=[item];party.argonauts[0].fatedMnemosIds[0]=item.id;
  const [front,growth]=cardAbilities(fated,item.memoryProgress);
  const change=(abilityId,exhausted=true)=>partyReducer(party,{type:'ability-exhausted',argonautId:'a',instanceId:item.id,definitionId:'fixture',faceId:'front',abilityId,exhausted},customRepo);
  assert.equal(change(growth.id),party);
  party=change(front.id);
  party.argonauts[0].instances[0].memoryProgress.node=3;
  party=change(growth.id);
  assert.deepEqual(party.argonauts[0].instances[0].exhaustedAbilityIds,[front.id,growth.id]);
  party.argonauts[0].instances[0].discarded=true;
  assert.equal(change(front.id),party);
  party=change(front.id,false);
  assert.deepEqual(party.argonauts[0].instances[0].exhaustedAbilityIds,[growth.id]);
});
