import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { titanDiceModifiers, titanSymbolAbility } from '../src/domain/titan-presentation.ts';
import { isDreamwalker, titanOptionCards, titanVariantDisplayName } from '../src/domain/titan-selection.ts';
const repo=createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json',import.meta.url))));
const face=name=>repo.byName(name)[0].faces[0];

test('printed dice modifiers and limit values retain separate semantics; paid/gated text stays in the ability list',()=>{
  assert.deepEqual(titanDiceModifiers(face('Logicbreaker')).map(s=>[s.symbol,s.value]),[['Break',1]]);
  assert.deepEqual(titanDiceModifiers(face('Immortal Truthbearer'),6).map(s=>[s.symbol,s.value]),[['Black',1]]);
  assert.deepEqual(titanDiceModifiers(face('Immortal Truthbearer'),7).map(s=>[s.symbol,s.value]),[['Black',1],['Hope',1]]);
  const limit=face('Abysswatcher').data.abilities.map(titanSymbolAbility).find(s=>s?.kind==='limit');
  assert.equal(limit.symbol,'Ambrosia');assert.equal(limit.value,-1);
  const heading={abilityText:[{type:'keyword',value:'Auto-black 1'}]};
  assert.equal(titanSymbolAbility({...heading,costs:['Exhaust']}),null);
  assert.equal(titanSymbolAbility({...heading,gate:'Danger',value:'3+'}),null);
});

test('Skyseer displays the supplied scan movement and Auto-break modifier',()=>{
  assert.equal(face('Skyseer').data.speed,'7');
  assert.deepEqual(titanDiceModifiers(face('Skyseer')).map(s=>[s.symbol,s.value]),[['Break',1]]);
});

test('dashboard picker exposes one Dreamwalker subtype per available cycle and preserves selected named copies',()=>{
  const all=repo.search({family:'Titan'});
  const names=['Dreamwalker','Spartan Dreamwalker','Delphian Dreamwalker','Persian Dreamwalker','Cycladean Dreamwalker'];
  for(const cycle of [1,2,3,4,5]){
    const options=titanOptionCards(all,cycle).filter(c=>isDreamwalker(c.faces[0]));
    assert.deepEqual(options.map(c=>titanVariantDisplayName(c.faces[0])).sort(),names.slice(0,cycle).sort());
  }
  const preferred=all.find(c=>c.faces[0].name==='Solon'&&c.faces[0].cycle==='Cycle II');
  const options=titanOptionCards(all,3,{definitionId:preferred.id,faceId:'front'});
  assert.ok(options.some(c=>c.id===preferred.id));
  assert.equal(options.filter(c=>titanVariantDisplayName(c.faces[0])==='Spartan Dreamwalker').length,1);
});
