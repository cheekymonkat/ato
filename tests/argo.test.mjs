import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { SHIP_TRACKS, VOYAGE_TRACKS, MILESTONE_TRACKS, argoTrack, argoTrackDefinition } from '../src/domain/argo.ts';
import { parseParty } from '../src/domain/party.ts';
import { technologyResourceValue } from '../src/domain/technologies.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { newProfile, exportProfile, readBackup } from '../src/storage/workspace.ts';
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = (cycle = 1) => newProfile('voyage', 'Expedition', catalogue.version, cycle).party;
const action = (party, fields) => ({ partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: party.campaignCycle, ...fields });
const read = (party, id) => argoTrack(party, argoTrackDefinition(id, party.campaignCycle), catalogue);
const edit = (party, id, value, limit = null, reference = '') => partyReducer(party, action(party, { type: 'argo-track-edit', id, value, limit, reference }), catalogue);

test('Argo baseline capacities read the highest applicable inherited technology, without importing screenshot totals', () => {
  const expected = [[5, 6, 9, 20, 10], [5, 8, 9, 40, 15], [6, 9, 9, 60, 20], [7, 10, 9, 80, 20], [7, 10, 9, 100, 20]];
  for (const cycle of [1, 2, 3, 4, 5]) {
    const party = fresh(cycle);
    assert.deepEqual(SHIP_TRACKS.map(track => argoTrack(party, track, catalogue).limit), expected[cycle - 1]);
    assert.ok(SHIP_TRACKS.every(track => argoTrack(party, track, catalogue).value === (track.readOnly ? argoTrack(party, track, catalogue).limit : track.id === 'knowledge' ? (cycle - 1) * 20 : 0)));
    assert.deepEqual(parseParty(party), party, 'Legacy saves need no migration or Argo field');
  }
});

test('Fate and Knowledge limits are fixed, and Titan Limit comes only from active technology', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    const party = fresh(cycle);
    for (const id of ['fate', 'knowledge']) {
      const limit = id === 'fate' ? 9 : cycle * 20;
      assert.equal(read(party, id).limit, limit);
      for (const forged of [null, 0, limit - 1, limit + 10]) assert.equal(edit(party, id, 1, forged), party);
      const valid = edit(party, id, 1, limit);
      assert.equal(read(valid, id).value, 1);
      assert.equal(Object.hasOwn(valid.argo.limits, `${cycle}:${id}`), false);
      assert.equal(edit(party, id, limit + 1, limit), party);
    }
    assert.equal(edit(party, 'titans', 1, 999), party);
    assert.equal(partyReducer(party, action(party, { type: 'argo-track', id: 'titans', delta: 1 }), catalogue), party);
    assert.equal(read(party, 'titans').value, read(party, 'titans').limit);
    const legacy = { ...party, argo: { version: 1, tracks: { titans: { value: 999 } }, limits: {
      [`${cycle}:titans`]: 999, [`${cycle}:fate`]: null, [`${cycle}:knowledge`]: 999,
    }, records: {} } };
    assert.deepEqual(parseParty(legacy), legacy, 'Old saves remain readable');
    for (const id of ['titans', 'fate', 'knowledge']) assert.deepEqual(read(legacy, id), read(party, id), 'Old overrides cannot change derived limits');
    assert.deepEqual(readBackup(exportProfile({ id: legacy.id, name: 'Legacy limits', party: legacy }), catalogue).profile.party, legacy);
  }
  const party = fresh(1), upgrade = catalogue.byName('Titan Rearing')[0];
  const upgraded = { ...party, technologies: { version: 1, researched: [upgrade.id] } };
  assert.equal(read(party, 'titans').value, 10);
  assert.equal(read(upgraded, 'titans').value, 15);
  const removed = partyReducer(upgraded, { type: 'technology-remove', partyId: party.id, argonautId: party.activeArgonautId,
    definitionId: upgrade.id, confirmed: true }, catalogue);
  assert.equal(read(removed, 'titans').value, 10);
});

test('each cycle exposes its own voyage tracks, with negative Humanity and nonnegative ordinary totals', () => {
  const ids = [['strangers'], ['refugees', 'captives', 'humanity', 'defectors'], ['paradox', 'frozen-time', 'time-silo', 'loop-length'], ['babelian-debt', 'reap-marks', 'sow-marks'], ['paranoia', 'argo-oxygen', 'titan-x']];
  for (const cycle of [1, 2, 3, 4, 5]) assert.deepEqual(VOYAGE_TRACKS.filter(track => track.cycles.includes(cycle)).map(track => track.id), ids[cycle - 1]);
  let party = edit(fresh(2), 'humanity', -3);
  party = partyReducer(party, action(party, { type: 'argo-track', id: 'humanity', delta: -1 }), catalogue);
  assert.equal(read(party, 'humanity').value, -4);
  assert.deepEqual(parseParty(party), party);
  for (const track of SHIP_TRACKS) assert.equal(edit(party, track.id, -1), party);
  assert.equal(edit(party, 'strangers', 10), party, 'Unavailable-cycle fields cannot be edited');
});

test('Fate and Knowledge share the research/resource pool, including legacy aliases and edits in either UI', () => {
  let party = { ...fresh(), resources: { '@ArgoKnowledge': 5, 'Argo Knowledge': 7, ArgoFate: 3, 'Bronze Ore': 9 } };
  assert.equal(read(party, 'knowledge').value, 7);
  party = edit(party, 'knowledge', 6, 20);
  assert.deepEqual(party.resources, { 'Argo Knowledge': 6, ArgoFate: 3, 'Bronze Ore': 9 });
  assert.equal(technologyResourceValue(party, 'Argo Knowledge'), 6);
  party = partyReducer(party, action(party, { type: 'resource', name: 'Argo Knowledge', delta: 1 }), catalogue);
  assert.equal(read(party, 'knowledge').value, 7);
  party = partyReducer(party, action(party, { type: 'argo-track', id: 'fate', delta: -1 }), catalogue);
  assert.equal(technologyResourceValue(party, 'Argo Fate'), 2);
  assert.equal(party.resources.ArgoFate, undefined);
});

test('advancement keeps ship totals and reference records, and separates cycle milestones and limit overrides', () => {
  let party = edit(fresh(2), 'hull', 4, 7);
  party = { ...party, argo: { ...party.argo, tracks: { ...party.argo.tracks, '2:story': { value: 23, reference: '4A' } }, limits: { ...party.argo.limits, '2:story': 100 } } };
  party = edit(party, 'humanity', -3);
  party = partyReducer(party, action(party, { type: 'argo-record', id: 'choice-matrix', text: 'A1: spared the crew' }), catalogue);
  const advanced = partyReducer(party, action(party, { type: 'advance-cycle', confirmed: true }), catalogue);
  assert.equal(read(advanced, 'hull').value, 4);
  assert.equal(read(advanced, 'hull').limit, 6, 'Next cycle uses its own printed limit');
  assert.deepEqual(read(advanced, 'story'), { value: 0, limit: 6, reference: '1A' });
  assert.deepEqual(advanced.argo.tracks['2:story'], { value: 23, reference: '4A' });
  assert.equal(advanced.argo.limits['2:hull'], 7);
  assert.equal(advanced.argo.tracks['2:humanity'].value, -3);
  assert.equal(advanced.argo.records['choice-matrix'], 'A1: spared the crew');
});

test('Argo edits reject stale campaigns/cycles, invalid inputs and overflow without mutating other party data', () => {
  const party = fresh(3), valid = action(party, { type: 'argo-track-edit', id: 'crew', value: 4, limit: 9, reference: '' });
  for (const change of [{ partyId: 'other' }, { expectedCycle: 2 }, { argonautId: 'missing' }, { id: 'unknown' }, { value: 1.5 }, { value: Infinity }, { value: Number.MAX_SAFE_INTEGER + 1 }, { limit: -1 }, { limit: 2.5 }, { reference: 'a'.repeat(41) }]) {
    assert.equal(partyReducer(party, { ...valid, ...change }, catalogue), party);
  }
  const next = edit(party, 'crew', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  assert.equal(partyReducer(next, action(next, { type: 'argo-track', id: 'crew', delta: 1 }), catalogue), next);
  assert.equal(next.argonauts, party.argonauts); assert.equal(next.resources, party.resources);
  assert.equal(party.argo, undefined);
  assert.equal(partyReducer(party, action(party, { type: 'argo-record', id: 'not-a-section', text: 'x' }), catalogue), party);
});

test('every bounded Argo track stops at its limit, including zero caps and edited milestone targets', () => {
  for (const cycle of [1, 2, 3, 4, 5]) {
    for (const track of [...SHIP_TRACKS, ...VOYAGE_TRACKS, ...MILESTONE_TRACKS].filter(track => !track.readOnly && track.id !== 'inwards' && (!track.cycles || track.cycles.includes(cycle)))) {
      const original = fresh(cycle), limit = argoTrack(original, track, catalogue).limit;
      if (limit == null) continue;
      let party = edit(original, track.id, Math.max(0, limit - 1), limit);
      if (limit > 0) party = partyReducer(party, action(party, { type: 'argo-track', id: track.id, delta: 1 }), catalogue);
      assert.equal(read(party, track.id).value, limit, `${cycle}: ${track.name}`);
      assert.equal(partyReducer(party, action(party, { type: 'argo-track', id: track.id, delta: 1 }), catalogue), party);
      assert.equal(edit(party, track.id, limit + 1, limit), party, 'Direct values cannot exceed their limit');
      if (limit > 0) {
        assert.equal(edit(party, track.id, limit, limit - 1), party, 'The editor cannot save a limit below its value');
        const lowered = partyReducer(party, action(party, { type: 'argo-track', id: track.id, delta: -1 }), catalogue);
        assert.equal(read(lowered, track.id).value, limit - 1);
      }
    }
  }
  const milestone = edit(fresh(3), 'inwards', 2, 2);
  assert.equal(read(milestone, 'inwards').value, 0);
  assert.equal(read(milestone, 'knowledge').value, 41);
  assert.equal(edit(milestone, 'inwards', 3, 2), milestone);
  assert.equal(edit(milestone, 'inwards', 3, 3), milestone, 'Printed conversion target is fixed');
});

test('Shared Resources cannot bypass Fate or Knowledge limits through aliases; generic resources stay unbounded', () => {
  for (const [id, names] of [['fate', ['Argo Fate', 'ArgoFate', '@argofate']], ['knowledge', ['Argo Knowledge', '@ArgoKnowledge', 'argo knowledge']]]) {
    const original = fresh(), limit = read(original, id).limit, party = edit(original, id, limit, limit);
    for (const name of names) {
      const resource = { type: 'resource', argonautId: party.activeArgonautId, name, delta: 1 };
      assert.equal(partyReducer(party, resource, catalogue), party, name);
      const lowered = partyReducer(party, { ...resource, delta: -1 }, catalogue);
      assert.equal(read(lowered, id).value, limit - 1);
      assert.equal(read(partyReducer(lowered, resource, catalogue), id).value, limit);
    }
  }
  const party = { ...fresh(), resources: { 'Bronze Ore': 100 } };
  assert.equal(partyReducer(party, action(party, { type: 'resource', name: 'Bronze Ore', delta: 1 }), catalogue).resources['Bronze Ore'], 101);
  assert.equal(read(edit(fresh(), 'strangers', 1000), 'strangers').value, 1000);
});

test('old over-limit saves remain recoverable; increases are blocked and minus restores a valid total', () => {
  const party = { ...fresh(), argo: { version: 1, tracks: { hull: { value: 12 } }, limits: {}, records: {} } };
  assert.deepEqual(parseParty(party), party);
  assert.equal(partyReducer(party, action(party, { type: 'argo-track', id: 'hull', delta: 1 }), catalogue), party);
  const corrected = partyReducer(party, action(party, { type: 'argo-track', id: 'hull', delta: -1 }), catalogue);
  assert.equal(read(corrected, 'hull').value, 5);
  assert.equal(read(edit(party, 'hull', 4, 5), 'hull').value, 4);
});

test('all tracks, card sides, notebooks and overrides survive campaign backups independently', () => {
  let profile = newProfile('saved', 'A Voyage', catalogue.version, 5), party = profile.party;
  for (const track of [...SHIP_TRACKS, ...MILESTONE_TRACKS, ...VOYAGE_TRACKS.filter(track => track.cycles.includes(5))].filter(track => !track.readOnly)) party = edit(party, track.id, 3, track.limitSource ? read(party, track.id).limit : 12, track.milestone ? '2B' : '');
  party = partyReducer(party, action(party, { type: 'argo-record', id: 'diplomacy', text: 'Delphins +1\nResolve on day 6' }), catalogue);
  profile = { ...profile, party };
  const restored = readBackup(exportProfile(profile), catalogue).profile;
  assert.deepEqual(restored, profile);
  assert.deepEqual(fresh(5).resources, { 'Argo Knowledge': 80 });
});

test('restore rejects invalid Argo schema, unknown records, misplaced tracks and negative capacities', () => {
  const party = edit(fresh(), 'hull', 3, 5);
  for (const change of [
    { version: 2 }, { tracks: { hull: { value: -1 } } }, { tracks: { '1:humanity': { value: -1 } } },
    { tracks: { hull: { value: 2.5 } } }, { limits: { '1:hull': -1 } }, { limits: { '6:hull': 1 } },
    { records: { unknown: 'x' } }, { records: { evolution: 1 } },
  ]) assert.throws(() => parseParty({ ...party, argo: { ...party.argo, ...change } }), /Invalid Argo/);
});
