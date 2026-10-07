import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { cycleFactions, diplomacyMinimum, diplomacyRelationship, diplomacyValues, relationships } from '../src/domain/diplomacy.ts';
import { parseParty } from '../src/domain/party.ts';
import { newProfile, exportProfile, readBackup } from '../src/storage/workspace.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { diplomacyIcons } from '../src/theme/diplomacy-icons.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = (cycle = 1) => newProfile('diplo', 'Diplomacy', catalogue.version, cycle).party;
const edit = (party, factionId, value, overrides = {}) => partyReducer(party, { type: 'diplomacy-edit', partyId: party.id,
  argonautId: party.activeArgonautId, expectedCycle: party.campaignCycle, factionId, value, ...overrides });
const change = (party, factionId, delta) => partyReducer(party, { type: 'diplomacy', partyId: party.id,
  argonautId: party.activeArgonautId, expectedCycle: party.campaignCycle, factionId, delta });

test('each cycle starts with just its three named factions and bundled, vector-only symbols', () => {
  const names = [
    ['Minoans', 'Labyrinthians', 'Hornsworn'], ['Helots', 'Cyclopes', 'Symmachy'], ['Sunheirs', 'Delphians', 'Twilight Watch'],
    ['Aristotelians', 'Wasters', 'Cloud Thieves'], ['Outcast Vanguard', 'Followers of Arete', 'Cycladean Protectorate'],
  ];
  assert.equal(Object.keys(diplomacyIcons).length, 15);
  for (const cycle of [1, 2, 3, 4, 5]) {
    const party = fresh(cycle), original = structuredClone(party), factions = cycleFactions(cycle);
    assert.deepEqual(factions.map(faction => faction.name), names[cycle - 1]);
    assert.deepEqual(Object.values(diplomacyValues(party)), [0, 0, 0]);
    assert.deepEqual(party, original, 'Reading defaults does not change saved state');
    for (const faction of factions) {
      assert.match(diplomacyIcons[faction.icon], /^<svg\b[^>]*viewBox=/);
      assert.doesNotMatch(diplomacyIcons[faction.icon], /data:image|<image|namedview|inkscape|sodipodi/);
    }
  }
});

test('relationship boundaries match every pictured band, including extended negative and positive counts', () => {
  for (const cycle of [1, 3, 4, 5]) {
    for (const [value, name, modifier] of [[-20, 'At War', -3], [-10, 'At War', -3], [-9, 'Denounced', -2], [-5, 'Denounced', -2],
      [-4, 'Unfriendly', -1], [-1, 'Unfriendly', -1], [0, 'Neutral', 0], [3, 'Neutral', 0], [4, 'Friendly', 1], [7, 'Friendly', 1],
      [8, 'Allied', 2], [20, 'Allied', 2]]) {
      assert.equal(diplomacyRelationship(cycle, value).name, name);
      assert.equal(diplomacyRelationship(cycle, value).modifier, modifier);
    }
  }
  for (const [value, name, modifier] of [[0, 'Hidden', -1], [2, 'Hidden', -1], [3, 'Distrustful', 0], [6, 'Distrustful', 0],
    [7, 'Friendly', 1], [11, 'Friendly', 1], [12, 'Allied', 2], [20, 'Allied', 2]]) {
    assert.equal(diplomacyRelationship(2, value).name, name);
    assert.equal(diplomacyRelationship(2, value).modifier, modifier);
  }
  for (const cycle of [1, 2, 3, 4, 5]) for (let value = diplomacyMinimum(cycle); value <= 20; value++) {
    assert.equal(relationships(cycle).filter(band => value >= band.minimum && value <= band.maximum).length, 1);
  }
});

test('counters and direct editing enforce bounds, whole numbers, campaign identity and cycle ownership', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    let party = fresh(cycle); const faction = cycleFactions(cycle)[0].id;
    for (let index = 0; index < 25; index++) party = change(party, faction, 1);
    assert.equal(diplomacyValues(party)[faction], 20);
    assert.equal(change(party, faction, 1), party);
    for (let index = 0; index < 50; index++) party = change(party, faction, -1);
    assert.equal(diplomacyValues(party)[faction], diplomacyMinimum(cycle));
    assert.equal(change(party, faction, -1), party);
    for (const badValue of [-21, 21, 1.5, '2', null, NaN, Infinity]) assert.equal(edit(party, faction, badValue), party);
    for (const overrides of [{ partyId: 'other' }, { argonautId: 'missing' }, { expectedCycle: cycle === 5 ? 1 : cycle + 1 }]) {
      assert.equal(edit(party, faction, 5, overrides), party);
    }
    assert.equal(edit(party, 'unknown', 5), party);
    assert.equal(change(party, faction, 2), party);
    assert.equal(edit(party, faction, diplomacyMinimum(cycle)), party, 'Repeated saves do not rewrite state');
    if (cycle === 2) assert.equal(edit(party, faction, -1), party);
  }
});

test('saved diplomacy survives restart and backup; old notebooks remain readable and other campaigns stay independent', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    const original = fresh(cycle), other = fresh(2), before = structuredClone(original);
    let saved = edit(original, cycleFactions(cycle)[0].id, 10);
    saved = edit(saved, cycleFactions(cycle)[1].id, diplomacyMinimum(cycle));
    saved = { ...saved, argo: { ...saved.argo, records: { diplomacy: 'Story choices', glyphs: 'Language progress' } } };
    const profile = { id: saved.id, name: 'Saved', party: saved };
    assert.deepEqual(parseParty(JSON.parse(JSON.stringify(saved))), saved);
    assert.deepEqual(readBackup(exportProfile(profile), catalogue).profile, profile);
    assert.deepEqual(original, before);
    assert.deepEqual(Object.values(diplomacyValues(other)), [0, 0, 0]);
    assert.equal(saved.argonauts, original.argonauts, 'Diplomacy never rewrites player stats');
  }
  const legacy = { ...fresh(), argo: { version: 1, tracks: {}, limits: {}, records: { diplomacy: 'Minoans +3' } } };
  assert.deepEqual(parseParty(legacy), legacy);
  assert.equal(edit(legacy, 'minoan', 3).argo.records.diplomacy, 'Minoans +3');
});

test('advancing removes old factions and diplomacy notes, preserves other Argo information and rejects stale edits', () => {
  for (const cycle of [1, 2, 3, 4]) {
    const faction = cycleFactions(cycle)[0].id;
    let party = edit(fresh(cycle), faction, 8);
    party = { ...party, argo: { ...party.argo, tracks: { hull: { value: 3 } }, limits: { [`${cycle}:crew`]: 7 },
      records: { diplomacy: 'Old factions', glyphs: 'Keep', adventures: 'Also keep' } } };
    const before = structuredClone(party);
    const next = partyReducer(party, { type: 'advance-cycle', partyId: party.id, argonautId: party.activeArgonautId,
      expectedCycle: cycle, confirmed: true });
    assert.equal(next.argo.diplomacy, undefined);
    assert.equal(next.argo.records.diplomacy, undefined);
    assert.deepEqual(Object.keys(diplomacyValues(next)), cycleFactions(cycle + 1).map(faction => faction.id));
    assert.deepEqual(Object.values(diplomacyValues(next)), [0, 0, 0]);
    assert.deepEqual(next.argo.tracks, party.argo.tracks); assert.deepEqual(next.argo.limits, party.argo.limits);
    assert.deepEqual(next.argo.records, { glyphs: 'Keep', adventures: 'Also keep' });
    assert.equal(edit(next, faction, 10, { expectedCycle: cycle }), next);
    assert.equal(partyReducer(next, { type: 'argo-record', partyId: party.id, argonautId: party.activeArgonautId,
      id: 'diplomacy', text: 'Stale notes', expectedCycle: cycle }), next);
    assert.deepEqual(party, before);
    assert.deepEqual(parseParty(next), next);
  }
});

test('backup validation rejects invalid diplomacy counts, factions and cycles', () => {
  const party = edit(fresh(2), 'helots', 5);
  for (const diplomacy of [null, { cycle: 2, values: null }, { cycle: 2, values: { helots: -1 } },
    { cycle: 2, values: { helots: 21 } }, { cycle: 2, values: { helots: 1.5 } }, { cycle: 2, values: { helots: '1' } },
    { cycle: 2, values: { minoan: 1 } }, { cycle: 1, values: { minoan: 1 } }, { cycle: 6, values: {} }]) {
    assert.throws(() => parseParty({ ...party, argo: { ...party.argo, diplomacy } }), /Invalid (Argo|diplomacy)/);
  }
});
