import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { newProfile, exportProfile, readBackup, referenceProblems } from '../src/storage/workspace.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { argoTrack, argoTrackDefinition } from '../src/domain/argo.ts';
import { resolveTable } from '../src/domain/references.ts';
import { isDreamwalker } from '../src/domain/titan-selection.ts';
import { isFaceAvailableInCycle } from '../src/domain/campaign.ts';
import { TITAN_STARTS, availableRosterTitans, cycleDreamwalker, emptyTitanPatterns, livingTitanCount, materializeTitanRoster, patternIssue, rosterTitanName, rosterTypeIssue, sortRoster, titanCapacity } from '../src/domain/titan-roster.ts';
const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = (cycle = 1, tracking = false) => newProfile('roster', 'Titans', catalogue.version, cycle, tracking, catalogue).party;
const records = party => party.titanRoster.titans;
const edit = (party, edit, overrides = {}) => partyReducer(party, { type: 'titan-roster', partyId: party.id, argonautId: party.activeArgonautId, expectedCycle: party.campaignCycle, edit, ...overrides }, catalogue);
const named = name => catalogue.byName(name).find(card => card.family === 'Titan' || card.family === 'Pattern');
const ref = name => ({ definitionId: named(name).id, faceId: 'front' });
const mark = (party, titan, status) => edit(party, { operation: 'status', id: titan.id, expected: titan, status });
const add = (party, name, id, patterns = emptyTitanPatterns()) => edit(party, { operation: 'add', record: { id, ...ref(name), status: 'alive', patterns } });
const pattern = (party, titan, patterns) => edit(party, { operation: 'patterns', id: titan.id, expected: titan, patterns });
const rename = (party, titan, name) => edit(party, { operation: 'update', id: titan.id, expected: titan, name, patterns: titan.patterns });
const select = (party, titan, argonautId = 'arg-1') => partyReducer(party, { type: 'titan', argonautId, titan: {
  id: `${argonautId}:titan`, rosterId: titan.id, definitionId: titan.definitionId, faceId: titan.faceId, exhausted: false, enabledEffectIds: [], counters: {},
} }, catalogue);
const advance = party => partyReducer(party, { type: 'advance-cycle', argonautId: party.activeArgonautId, partyId: party.id, expectedCycle: party.campaignCycle, confirmed: true }, catalogue);

test('new campaigns seed exact cycle rosters, including all twelve Cycle V Titans, independently of gear tracking', () => {
  for (const cycle of [1, 2, 3, 4, 5]) for (const tracking of [false, true]) {
    const party = fresh(cycle, tracking), start = TITAN_STARTS[cycle];
    assert.equal(records(party).length, start.bred.length + start.dreamwalkers);
    const walkers = records(party).filter(titan => isDreamwalker(catalogue.getFace(titan.definitionId, titan.faceId)));
    assert.equal(walkers.length, start.dreamwalkers);
    assert.ok(walkers.every(titan => titan.definitionId === cycleDreamwalker(cycle, catalogue).id));
    assert.deepEqual(records(party).filter(titan => !walkers.includes(titan)).map(titan => rosterTitanName(titan, catalogue)).sort(), [...start.bred].sort());
    assert.ok(records(party).every(titan => titan.status === 'alive' && titan.patterns.trauma === null && titan.patterns.kratos === null));
    assert.equal(new Set(records(party).map(titan => titan.id)).size, records(party).length);
    assert.ok(livingTitanCount(records(party)) <= titanCapacity(party, catalogue));
    const total = argoTrack(party, argoTrackDefinition('titans', cycle), catalogue);
    assert.equal(total.value, records(party).length); assert.equal(total.limit, titanCapacity(party, catalogue));
    assert.deepEqual(parseParty(party), party);
    assert.deepEqual(readBackup(exportProfile({ id: party.id, name: 'Titans', party }), catalogue).profile.party, party);
  }
});

test('Alive and Crippled share the technology cap; Dead frees a place but cannot be restored into a full roster', () => {
  let party = fresh(1), first = records(party)[0];
  assert.equal(add(party, 'Earthshaker', 'extra'), party);
  assert.equal(mark(party, first, 'crippled'), party, 'No Crippled in Cycle I');
  party = mark(party, first, 'dead'); assert.equal(livingTitanCount(records(party)), 9);
  party = add(party, 'Earthshaker', 'extra'); assert.equal(livingTitanCount(records(party)), 10);
  const dead = records(party).find(titan => titan.id === first.id);
  assert.equal(mark(party, dead, 'alive'), party);
  let two = fresh(2); two = { ...two, titanRoster: { version: 1, titans: [...records(two), ...Array.from({ length: 5 }, (_, i) => ({ ...records(two)[3], id: `extra:${i}` }))] } };
  assert.equal(livingTitanCount(records(two)), 15);
  two = mark(two, records(two)[0], 'crippled'); assert.equal(livingTitanCount(records(two)), 15);
  assert.equal(add(two, 'Firestarter', 'over'), two);
  two = mark(two, records(two)[1], 'dead');
  two = add(two, 'Firestarter', 'new');
  assert.equal(livingTitanCount(records(two)), 15);
  assert.equal(mark(two, records(two).find(titan => titan.status === 'dead'), 'crippled'), two);
});

test('Argo-bred types are unique across Alive and Crippled; Dead permits a replacement but not a duplicate revival', () => {
  let party = fresh(3), firestarter = records(party).find(titan => rosterTitanName(titan, catalogue) === 'Firestarter');
  const initial = party, before = structuredClone(party);
  assert.match(rosterTypeIssue(party, 'new', firestarter, catalogue), /Alive or Crippled Firestarter/);
  assert.equal(rosterTypeIssue(party, firestarter.id, firestarter, catalogue), undefined);
  assert.equal(add(party, 'Firestarter', 'new'), party, 'An unassigned Alive Titan still occupies its type');
  party = mark(party, firestarter, 'crippled');
  assert.equal(add(party, 'Firestarter', 'new'), party, 'Crippled still occupies its type');
  firestarter = records(party).find(titan => titan.id === firestarter.id);
  party = mark(party, firestarter, 'dead');
  const dead = records(party).find(titan => titan.id === firestarter.id);
  assert.equal(rosterTypeIssue(party, 'new', dead, catalogue), undefined);
  party = add(party, 'Firestarter', 'new');
  assert.equal(records(party).at(-1).id, 'new');
  for (const status of ['alive', 'crippled']) assert.equal(mark(party, dead, status), party);
  party = mark(party, records(party).at(-1), 'crippled');
  assert.equal(mark(party, dead, 'alive'), party, 'A Crippled replacement also blocks revival');
  party = mark(party, records(party).at(-1), 'dead');
  party = mark(party, dead, 'alive');
  assert.equal(records(party).find(titan => titan.id === dead.id).status, 'alive');
  assert.equal(add(party, 'Firestarter', 'late-add'), party, 'Reducer rejects additions based on stale availability');
  assert.deepEqual(readBackup(exportProfile({ id: party.id, name: 'Titans', party }), catalogue).profile.party, party);
  assert.deepEqual(initial, before, 'The original roster is not mutated');
});

test('every living Argo-bred type blocks another copy; all Dreamwalker subtypes may repeat', () => {
  for (const cycle of [2, 3, 4, 5]) {
    const party = fresh(cycle);
    for (const titan of records(party).filter(titan => !isDreamwalker(catalogue.getFace(titan.definitionId, titan.faceId)))) {
      const duplicate = { ...titan, id: `copy:${titan.id}` };
      assert.ok(rosterTypeIssue(party, duplicate.id, duplicate, catalogue));
      assert.equal(edit(party, { operation: 'add', record: duplicate }), party);
    }
    for (const card of catalogue.search({ family: 'Titan' }).filter(card => isDreamwalker(card.faces[0]) && isFaceAvailableInCycle(card.faces[0], cycle))) {
      const walker = { id: `copy:${card.id}`, definitionId: card.id, faceId: card.faces[0].id, status: 'alive', patterns: emptyTitanPatterns() };
      assert.equal(rosterTypeIssue(party, walker.id, walker, catalogue), undefined);
      assert.equal(records(edit(party, { operation: 'add', record: walker })).at(-1).id, walker.id);
    }
  }
});

test('Argo-bred uniqueness uses the full normalized type name across catalogue copies and legacy records', () => {
  const party = fresh(3), original = records(party).find(titan => rosterTitanName(titan, catalogue) === 'Firestarter');
  const copyCatalogue = { ...catalogue, getFace: (id, faceId) => id === 'copy' ? { ...catalogue.getFace(original.definitionId, faceId), name: '  FIRESTARTER  ' } : catalogue.getFace(id, faceId) };
  assert.ok(rosterTypeIssue(party, 'new', { definitionId: 'copy', faceId: 'front' }, copyCatalogue));
  const distinctCatalogue = { ...copyCatalogue, getFace: (id, faceId) => id === 'copy' ? { ...catalogue.getFace(original.definitionId, faceId), name: 'Immortal Firestarter' } : catalogue.getFace(id, faceId) };
  assert.equal(rosterTypeIssue(party, 'new', { definitionId: 'copy', faceId: 'front' }, distinctCatalogue), undefined);
  const legacy = { ...createParty('old', ['a', 'b', 'c', 'd'], catalogue.version), campaignCycle: 3,
    inventory: { version: 1, enforce: false, gear: {}, titans: [original.definitionId] } };
  assert.ok(rosterTypeIssue(legacy, 'new', original, catalogue));
  assert.equal(edit(legacy, { operation: 'add', record: { ...original, id: 'new' } }), legacy);
});

test('individual selection shares physical Titans and their Patterns; changing status releases the Argonaut only', () => {
  let party = fresh(2), titan = records(party)[0];
  party = select(party, titan); assert.equal(party.argonauts[0].titan.rosterId, titan.id);
  assert.equal(select(party, titan, 'arg-2'), party);
  assert.ok(!availableRosterTitans(party, catalogue, 'arg-2').some(item => item.id === titan.id));
  const patterns = { trauma: ref('Harsh Conditioning'), kratos: ref('Mazewalker') };
  party = pattern(party, titan, patterns);
  assert.deepEqual(party.argonauts[0].tableOverrides, patterns);
  assert.equal(resolveTable(party.argonauts[0], 'Trauma', catalogue).source, 'pattern');
  const current = records(party).find(item => item.id === titan.id), other = party.argonauts[1];
  party = mark(party, current, 'crippled');
  assert.equal(party.argonauts[0].titan, null); assert.deepEqual(party.argonauts[0].tableOverrides, emptyTitanPatterns());
  assert.equal(party.argonauts[1], other); assert.deepEqual(records(party)[0].patterns, patterns);
  assert.equal(select(party, records(party)[0]), party);
  party = mark(party, records(party)[0], 'alive'); party = select(party, records(party)[0]);
  assert.deepEqual(party.argonauts[0].tableOverrides, patterns);
  party = partyReducer(party, { type: 'titan', argonautId: 'arg-1', titan: null }, catalogue);
  assert.ok(availableRosterTitans(party, catalogue, 'arg-2').some(item => item.id === titan.id));
  assert.deepEqual(records(party)[0].patterns, patterns);
  assert.equal(partyReducer(party, { type: 'table-override', argonautId: 'arg-1', kind: 'Kratos', reference: ref('Dreamwalker II') }, catalogue), party, 'A Pattern must belong to an assigned Titan');
});

test('Pattern cards have one allocation per Titan across both tables and all statuses; printed multi-copy cards can repeat', () => {
  let party = fresh(2), one = records(party)[0], two = records(party)[1];
  party = pattern(party, one, { trauma: ref('Harsh Conditioning'), kratos: ref('Mazewalker') });
  assert.equal(pattern(party, two, { trauma: null, kratos: ref('Mazewalker') }), party);
  party = mark(party, records(party)[0], 'dead');
  assert.match(patternIssue(party, two.id, { trauma: null, kratos: ref('Mazewalker') }, catalogue), /assigned/);
  party = pattern(party, records(party)[0], emptyTitanPatterns());
  party = pattern(party, two, { trauma: null, kratos: ref('Mazewalker') });
  assert.equal(records(party)[1].patterns.kratos.definitionId, named('Mazewalker').id);
  const multi = ref('Spartan Dreamwalker');
  for (const titan of records(party).slice(2, 6)) party = pattern(party, titan, { trauma: null, kratos: multi });
  assert.equal(records(party).filter(titan => titan.patterns.kratos?.definitionId === multi.definitionId).length, 4);
  assert.equal(pattern(party, records(party)[6], { trauma: null, kratos: multi }), party);
  const before = party;
  party = select(party, records(party)[6]);
  assert.equal(partyReducer(party, { type: 'table-override', argonautId: 'arg-1', kind: 'Kratos', reference: multi }, catalogue), party);
  assert.deepEqual(readBackup(exportProfile({ id: before.id, name: 'Patterns', party: before }), catalogue).profile.party, before);
});

test('dashboard Pattern edits write back to the Titan roster and remain with it on reassignment', () => {
  let party = fresh(2), titan = records(party)[0]; party = select(party, titan);
  party = partyReducer(party, { type: 'table-override', argonautId: 'arg-1', kind: 'Trauma', reference: ref('Heavy-Gear Training') }, catalogue);
  assert.equal(records(party)[0].patterns.trauma.definitionId, named('Heavy-Gear Training').id);
  party = partyReducer(party, { type: 'titan', argonautId: 'arg-1', titan: null }, catalogue);
  party = select(party, records(party)[0], 'arg-3');
  assert.equal(party.argonauts[2].tableOverrides.trauma.definitionId, named('Heavy-Gear Training').id);
});

test('cycle advancement removes casualties, keeps living Argo-bred Patterns, and resets Dreamwalkers to the new printed tables', () => {
  let party = fresh(2), bred = records(party)[0], walker = records(party)[3];
  party = pattern(party, bred, { trauma: null, kratos: ref('Mazewalker') });
  party = pattern(party, walker, { trauma: null, kratos: ref('Dreamwalker II') });
  party = select(party, records(party)[0]); party = select(party, records(party)[3], 'arg-2');
  party = mark(party, records(party)[1], 'crippled'); party = mark(party, records(party)[4], 'dead');
  const before = structuredClone(party), advanced = advance(party);
  assert.equal(advanced.campaignCycle, 3); assert.equal(records(advanced).length, 10);
  assert.ok(records(advanced).every(titan => titan.status === 'alive'));
  assert.ok(!records(advanced).some(titan => [before.titanRoster.titans[1].id, before.titanRoster.titans[4].id].includes(titan.id)));
  assert.deepEqual(records(advanced).find(titan => titan.id === bred.id), before.titanRoster.titans[0]);
  const walkers = records(advanced).filter(titan => isDreamwalker(catalogue.getFace(titan.definitionId, titan.faceId)));
  assert.ok(walkers.every(titan => titan.definitionId === cycleDreamwalker(3, catalogue).id && titan.patterns.trauma === null && titan.patterns.kratos === null));
  assert.equal(advanced.argonauts[1].titan.rosterId, walker.id); assert.deepEqual(advanced.argonauts[1].tableOverrides, emptyTitanPatterns());
  assert.deepEqual(resolveTable(advanced.argonauts[1], 'Kratos', catalogue).table, cycleDreamwalker(3, catalogue).faces[0].data.kratosTable);
  assert.deepEqual(party, before); assert.deepEqual(parseParty(advanced), advanced);
});

test('advancement reduces excess Dreamwalkers to ten while keeping assigned ones and never deletes living Argo-bred Titans', () => {
  let party = fresh(2);
  for (let i = 0; i < 5; i++) party = add(party, 'Solon', `extra:${i}`);
  party = select(party, records(party).at(-1));
  const advanced = advance(party);
  assert.equal(records(advanced).length, 10); assert.ok(advanced.argonauts[0].titan);
  let bred = fresh(4); bred = { ...bred, titanRoster: { version: 1, titans: records(fresh(5)) } };
  assert.equal(records(advance(bred)).length, 12, 'Retaining every living Argo-bred Titan takes precedence over replenishment to ten');
});

test('deleting a selected Titan requires confirmation, releases assignments and Patterns, and rejects stale edits', () => {
  let party = fresh(2); party = select(party, records(party)[0]);
  const titan = records(party)[0], deletion = { operation: 'delete', id: titan.id, expected: titan, confirmed: true };
  for (const confirmed of [false, undefined, 'yes']) assert.equal(edit(party, { ...deletion, confirmed }), party);
  for (const fields of [{ partyId: 'other' }, { expectedCycle: 1 }, { argonautId: 'missing' }]) assert.equal(edit(party, deletion, fields), party);
  const changed = pattern(party, titan, { trauma: null, kratos: ref('Mazewalker') });
  assert.equal(edit(changed, deletion), changed);
  const deleted = edit(party, deletion); assert.equal(deleted.argonauts[0].titan, null);
  assert.ok(!records(deleted).some(item => item.id === titan.id)); assert.deepEqual(parseParty(deleted), deleted);
});

test('legacy roster conversion preserves acquired Titans, selected individual copies, and overrides without changing Gear inventory', () => {
  let party = createParty('old', ['a', 'b', 'c', 'd'], catalogue.version);
  const card = cycleDreamwalker(1, catalogue);
  for (const member of party.argonauts.slice(0, 2)) party = partyReducer(party, { type: 'titan', argonautId: member.id, titan: {
    id: `${member.id}-titan`, definitionId: card.id, faceId: 'front', exhausted: false, enabledEffectIds: [], counters: {},
  } }, catalogue);
  party = { ...party, inventory: { version: 1, enforce: true, gear: { 'retained-record': 1 }, titans: [named('Earthshaker').id] } };
  const converted = materializeTitanRoster(party, catalogue);
  assert.equal(records(converted).length, 3); assert.equal(converted.inventory, party.inventory);
  assert.equal(converted.argonauts[0].titan.rosterId, 'legacy:a'); assert.deepEqual(parseParty(converted), converted);
  assert.equal(materializeTitanRoster(converted, catalogue), converted);
});

test('roster backup validation catches malformed identities, duplicate assignments, missing Patterns and physical over-allocation', () => {
  let party = fresh(2); party = select(party, records(party)[0]);
  const changed = structuredClone(party); changed.argonauts[1].titan = { ...changed.argonauts[0].titan, id: 'second' };
  assert.throws(() => parseParty(changed), /duplicate assigned/);
  for (const change of [{ status: 'unknown' }, { id: '' }, { patterns: { trauma: null } }, { definitionId: '' }]) {
    const malformed = { ...party, titanRoster: { version: 1, titans: [{ ...records(party)[0], ...change }] } };
    assert.throws(() => parseParty(malformed), /Titan roster/);
  }
  const over = structuredClone(fresh(2));
  for (const titan of records(over).slice(0, 2)) titan.patterns.kratos = ref('Mazewalker');
  assert.ok(referenceProblems(over, catalogue).some(message => /printed Pattern copies/.test(message)));
  assert.throws(() => readBackup(exportProfile({ id: over.id, name: 'Bad Patterns', party: over }), catalogue), /printed Pattern copies/);
  const missing = structuredClone(fresh(2)); records(missing)[0].patterns.kratos = { definitionId: 'missing', faceId: 'front' };
  assert.ok(referenceProblems(missing, catalogue).some(message => /unavailable Kratos/.test(message)));
});

test('sorting keeps every Argo-bred type above Dreamwalkers, alphabetically within each group', () => {
  const sorted = sortRoster(records(fresh(4)), catalogue), names = sorted.map(titan => rosterTitanName(titan, catalogue));
  assert.deepEqual(names.slice(0, -1), [...TITAN_STARTS[4].bred].sort()); assert.equal(names.at(-1), 'Persian Dreamwalker');
});

test('individual names default to type, persist across assignments and backups, and never alter type restrictions', () => {
  let party = fresh(2), walker = records(party)[3];
  assert.equal(rosterTitanName(walker, catalogue), 'Spartan Dreamwalker');
  party = rename(party, walker, '  Asterion  '); walker = records(party)[3];
  assert.equal(walker.name, 'Asterion'); assert.equal(rosterTitanName(walker, catalogue), 'Asterion');
  party = select(party, walker); const instance = party.argonauts[0].titan;
  party = rename(party, walker, 'The Wanderer'); walker = records(party)[3];
  assert.equal(party.argonauts[0].titan, instance, 'Renaming preserves the assigned instance and gameplay state');
  assert.equal(rosterTitanName(availableRosterTitans(party, catalogue, 'arg-1').find(titan => titan.id === walker.id), catalogue), 'The Wanderer');
  party = edit(party, { operation: 'add', record: { id: 'named-firestarter', ...ref('Firestarter'), status: 'alive', patterns: emptyTitanPatterns(), name: '  Spartan Dreamwalker  ' } });
  const firestarter = records(party).at(-1);
  assert.equal(firestarter.name, 'Spartan Dreamwalker');
  assert.equal(add(party, 'Firestarter', 'duplicate'), party, 'A Dreamwalker nickname cannot bypass the Argo-bred type limit');
  assert.deepEqual(readBackup(exportProfile({ id: party.id, name: 'Named Titans', party }), catalogue).profile.party, party);
  const ordered = sortRoster(records(party), catalogue);
  assert.ok(ordered.indexOf(firestarter) < ordered.indexOf(walker), 'Ordering retains Argo-bred types before renamed Dreamwalkers');
  party = rename(party, walker, '  ');
  assert.equal(records(party)[3].name, undefined); assert.equal(rosterTitanName(records(party)[3], catalogue), 'Spartan Dreamwalker');
});

test('custom names survive health changes and advancement while default Dreamwalker names follow their new subtype', () => {
  let party = fresh(2);
  party = rename(party, records(party)[0], 'Atlas');
  party = rename(party, records(party)[3], 'Asterion');
  party = rename(party, records(party)[4], 'Spartan Dreamwalker');
  assert.equal(records(party)[4].name, undefined, 'An explicit type name keeps automatic naming');
  party = mark(party, records(party)[0], 'crippled');
  assert.equal(records(party)[0].name, 'Atlas');
  party = rename(party, records(party)[0], 'Scarred Atlas');
  party = mark(party, records(party)[0], 'dead');
  party = rename(party, records(party)[0], 'Remembered Atlas');
  assert.equal(records(party)[0].name, 'Remembered Atlas');
  party = mark(party, records(party)[0], 'alive');
  const advanced = advance(party);
  assert.equal(rosterTitanName(records(advanced)[0], catalogue), 'Remembered Atlas');
  const namedWalker = records(advanced).find(titan => titan.id === records(party)[3].id);
  assert.equal(namedWalker.name, 'Asterion');
  assert.equal(namedWalker.definitionId, cycleDreamwalker(3, catalogue).id);
  const defaultWalker = records(advanced).find(titan => titan.id === records(party)[4].id);
  assert.equal(rosterTitanName(defaultWalker, catalogue), 'Delphian Dreamwalker');
});

test('name edits validate input and reject stale record actions without losing newer names or Patterns', () => {
  const party = fresh(2), titan = records(party)[0], namedParty = rename(party, titan, 'Atlas');
  assert.equal(rename(namedParty, titan, 'Late edit'), namedParty);
  assert.equal(mark(namedParty, titan, 'dead'), namedParty);
  assert.equal(pattern(namedParty, titan, { trauma: null, kratos: ref('Mazewalker') }), namedParty);
  assert.equal(edit(namedParty, { operation: 'delete', id: titan.id, expected: titan, confirmed: true }), namedParty);
  for (const invalid of [null, 7, 'x'.repeat(61)]) {
    assert.equal(rename(party, titan, invalid), party);
    assert.equal(edit(party, { operation: 'add', record: { id: 'bad', ...ref('Firestarter'), status: 'alive', patterns: emptyTitanPatterns(), name: invalid } }), party);
    const malformed = structuredClone(party); records(malformed)[0].name = invalid;
    assert.throws(() => parseParty(malformed), /Titan roster/);
  }
  assert.equal(records(rename(party, titan, 'x'.repeat(60)))[0].name.length, 60);
  assert.deepEqual(parseParty(party), party, 'Earlier saves with no name remain valid');
});
