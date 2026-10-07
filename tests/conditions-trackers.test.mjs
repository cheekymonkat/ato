import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createParty, parseParty } from '../src/domain/party.ts';
import { conditionEffects, conditionRecords, conditionReverse, conditionSections, kratosRageBonus, supportsCondition } from '../src/domain/conditions.ts';
import { formatParagraph } from '../src/domain/card-presentation.ts';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, importProfile, readBackup, referenceProblems } from '../src/storage/workspace.ts';
import { SnapshotStore } from '../src/storage/snapshots.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => createParty('trackers', ['a', 'b', 'c', 'd'], catalogue.version);
const reference = name => { const card = catalogue.byName(name)[0]; return { definitionId: card.id, faceId: 'front' }; };
const condition = (id = 'c1', ref = null) => ({ id, name: 'Manual condition', reference: ref, source: 'Primordial attack', duration: 'Until end of round', amount: 1 });
const reduce = (party, action) => partyReducer(party, { argonautId: 'a', ...action }, catalogue);

test('Roused derives one temporary Kratos bonus, follows its current face and never changes counters or another Argonaut', () => {
  const start = fresh(); start.argonauts[0].counters.rage = 5;
  const next = reduce(start, { type: 'condition', condition: condition('roused', reference('Roused')) });
  assert.equal(kratosRageBonus(next.argonauts[0], catalogue), 1);
  assert.deepEqual(next.argonauts[0].counters, start.argonauts[0].counters);
  assert.equal(kratosRageBonus(next.argonauts[1], catalogue), 0);
  const removed = reduce(next, { type: 'remove-condition', id: 'roused' });
  assert.equal(kratosRageBonus(removed.argonauts[0], catalogue), 0);
  const legacy = structuredClone(start.argonauts[0]); legacy.localConditions = ['Roused', 'rouse'];
  assert.equal(kratosRageBonus(legacy, catalogue), 1, 'Duplicate legacy labels do not stack');
  legacy.conditions = [{ ...condition('wrong-face', reference('Fear')), name: 'Roused' }]; legacy.localConditions = [];
  assert.equal(kratosRageBonus(legacy, catalogue), 0, 'The referenced face overrides stale saved display names');
  assert.equal(kratosRageBonus(parseParty(next).argonauts[0], catalogue), 1);
});

test('all bundled condition and flagged Trauma faces retain their full effect blocks', () => {
  const cards = catalogue.search().filter(card => card.faces.some(supportsCondition));
  assert.equal(cards.length, 24);
  for (const card of cards) for (const face of card.faces.filter(supportsCondition)) {
    assert.deepEqual(conditionEffects(face), face.data.side ? face.data.side.effect : face.data.effects);
    assert.ok(Array.isArray(conditionEffects(face)) && conditionEffects(face).length, face.name);
  }
  assert.equal(supportsCondition(catalogue.getFace(reference('Hammer-Sword').definitionId, 'front')), false);
});

test('Condition presentations retain named ability effects, subtitles and end-of-battle text on both sides', () => {
  for (const card of catalogue.search({ family: 'Condition' })) for (const face of card.faces) {
    const sections = conditionSections(face);
    assert.deepEqual(sections.effect, face.data.side.effect);
    assert.deepEqual(sections.abilities, face.data.side.abilities ?? []);
    assert.equal(sections.endOfBattle, face.data.side.endOfBattle);
    const aftermath = formatParagraph(sections.aftermath);
    assert.deepEqual(aftermath.diagnostics, []);
    if (sections.endOfBattle) {
      assert.match(aftermath.label, /End of Battle/);
      assert.ok(aftermath.label.includes(sections.endOfBattle));
    }
    for (const ability of sections.abilities) assert.ok(formatParagraph(ability.effects).label.length, `${face.name}: ${ability.title}`);
  }
  const fear = conditionSections(catalogue.getFace(reference('Fear').definitionId, 'front'));
  assert.equal(fear.abilities[0].title, 'Face Your Fear');
  assert.match(formatParagraph(fear.abilities[0].effects).label, /1 positive Precision token/);
  assert.match(fear.endOfBattle, /draw a Fated Mnemos card/);
  const bleeding = conditionSections(catalogue.getFace(reference('Bleeding').definitionId, 'front'));
  assert.deepEqual(bleeding.abilities.map(ability => ability.title), ['Bleeding Limit 4', 'Stop Bleeding', 'Stop Bleeding Other']);
  const knockdown = reference('Knockdown');
  assert.equal(catalogue.getFace(knockdown.definitionId, 'back').data.subtitle, 'Standing Up');
});

test('direct condition flips preserve identity and notes, reject stale actions and survive backups', () => {
  const ref = reference('Fear'), entry = { ...condition('fear', ref), name: 'Fear' };
  const start = reduce(fresh(), { type: 'condition', condition: entry });
  const action = { type: 'condition-flip', argonautId: 'a', id: entry.id, reference: ref };
  const flipped = reduce(start, action), result = flipped.argonauts[0].conditions[0];
  assert.deepEqual(result, { ...entry, name: 'Dread', reference: { ...ref, faceId: 'back' } });
  assert.deepEqual(flipped.argonauts.slice(1), start.argonauts.slice(1));
  assert.equal(flipped.activeArgonautId, start.activeArgonautId);
  assert.equal(flipped.argonauts[0].conditions.length, 1);
  assert.equal(reduce(flipped, action), flipped);
  assert.equal(reduce(start, { ...action, argonautId: 'b' }), start);
  assert.equal(reduce(start, { ...action, id: 'gone' }), start);
  assert.equal(reduce(start, { ...action, reference: reference('Knockdown') }), start);
  assert.equal(conditionReverse(reference('Roused'), catalogue), undefined);
  assert.equal(conditionReverse(reference('Hammer-Sword'), catalogue), undefined);
  const custom = reduce(fresh(), { type: 'condition', condition: condition() });
  assert.equal(reduce(custom, { ...action, id: 'c1' }), custom);
  assert.deepEqual(readBackup(exportProfile({ id: flipped.id, name: 'Flipped', party: flipped }), catalogue).profile.party, flipped);
  const returned = reduce(flipped, { ...action, reference: result.reference });
  assert.deepEqual(returned.argonauts[0].conditions, start.argonauts[0].conditions);
});

test('conditions add, edit, flip and remove without changing cards, skills or other Argonauts', () => {
  const start = fresh(), ref = reference('Knockdown'), face = catalogue.getFace(ref.definitionId, 'back');
  let party = reduce(start, { type: 'condition', condition: condition('c1', ref) });
  party = reduce(party, { type: 'condition', condition: { ...condition('c1', { ...ref, faceId: 'back' }), name: face.name } });
  assert.equal(conditionRecords(party.argonauts[0]).length, 1);
  assert.equal(party.argonauts[0].conditions[0].reference.faceId, 'back');
  assert.equal(party.argonauts[0].conditions[0].amount, 1);
  assert.deepEqual(party.argonauts[0].skills, start.argonauts[0].skills);
  assert.deepEqual(party.argonauts.slice(1), start.argonauts.slice(1));
  assert.deepEqual(start, fresh());
  const selected = reduce(party, { type: 'select', argonautId: 'b' });
  party = reduce(selected, { type: 'remove-condition', id: 'c1' });
  assert.equal(party.activeArgonautId, 'b'); assert.equal(conditionRecords(party.argonauts[0]).length, 0);
  assert.equal(reduce(party, { type: 'remove-condition', id: 'gone' }), party);
});

test('each Argonaut can have several types but only one of each, across both sides and editions', () => {
  const fear = reference('Fear'), bleeding = reference('Bleeding');
  const entry = (id, ref, name) => ({ ...condition(id, ref), name });
  let party = reduce(fresh(), { type: 'condition', condition: entry('fear', fear, 'Fear') });
  assert.equal(reduce(party, { type: 'condition', condition: entry('duplicate', fear, 'Fear') }), party);
  assert.equal(reduce(party, { type: 'condition', condition: entry('dread', { ...fear, faceId: 'back' }, 'Dread') }), party);
  assert.equal(reduce(party, { type: 'condition', condition: entry('custom', null, '  dread  ') }), party);
  party = reduce(party, { type: 'condition', condition: entry('bleeding', bleeding, 'Bleeding') });
  assert.equal(conditionRecords(party.argonauts[0]).length, 2);
  const otherOwner = reduce(party, { type: 'condition', argonautId: 'b', condition: entry('fear-b', fear, 'Fear') });
  assert.equal(conditionRecords(otherOwner.argonauts[1]).length, 1);
  assert.equal(reduce(party, { type: 'condition', condition: entry('bleeding', fear, 'Fear') }), party);
  party = reduce(party, { type: 'condition', condition: entry('fear', { ...fear, faceId: 'back' }, 'Dread') });
  assert.equal(party.argonauts[0].conditions.find(record => record.id === 'fear').reference.faceId, 'back');
  const editions = catalogue.byName('Sisyphean'); assert.equal(editions.length, 2);
  party = reduce(party, { type: 'condition', condition: entry('sisyphean', { definitionId: editions[0].id, faceId: 'front' }, 'Sisyphean') });
  assert.equal(reduce(party, { type: 'condition', condition: entry('sisyphean-2', { definitionId: editions[1].id, faceId: 'front' }, 'Sisyphean') }), party);
  parseParty(party);
  const invalid = structuredClone(party); invalid.argonauts[0].conditions.push(entry('duplicate-side', fear, 'Fear'));
  assert.throws(() => parseParty(invalid));
});

test('custom and legacy aliases block duplicates without changing other owners or deleting historical data', () => {
  let party = fresh(); party.argonauts[0].localConditions = ['Dread'];
  assert.equal(reduce(party, { type: 'condition', condition: { ...condition('fear', reference('Fear')), name: 'Fear' } }), party);
  party = reduce(party, { type: 'condition', condition: { ...condition(), name: 'Custom Effect' } });
  assert.equal(reduce(party, { type: 'condition', condition: { ...condition('other'), name: '  CUSTOM   effect ' } }), party);
  const invalid = fresh(); invalid.argonauts[0].conditions = [
    { ...condition('fear', reference('Fear')), name: 'Fear' }, { ...condition('custom'), name: 'Dread' },
  ];
  assert.deepEqual(parseParty(invalid), invalid);
  assert.ok(referenceProblems(invalid, catalogue).some(text => text.includes('duplicate condition type')));
  assert.throws(() => readBackup(exportProfile({ id: invalid.id, name: 'Duplicate', party: invalid }), catalogue), /duplicate condition type/);
});

test('legacy condition labels are preserved until explicitly edited or removed', () => {
  const party = fresh(); party.argonauts[0].localConditions = ['Unknown old condition'.repeat(20), 'Bleeding'];
  const before = structuredClone(party), records = conditionRecords(party.argonauts[0]);
  assert.deepEqual(party, before);
  let next = reduce(party, { type: 'condition', condition: { ...records[1], source: 'Legacy source' } });
  assert.deepEqual(next.argonauts[0].localConditions, [party.argonauts[0].localConditions[0]]);
  assert.equal(conditionRecords(next.argonauts[0]).length, 2);
  parseParty(next);
  next = reduce(next, { type: 'remove-condition', id: conditionRecords(next.argonauts[0])[1].id });
  assert.equal(conditionRecords(next.argonauts[0]).length, 1);
});

test('invalid condition metadata and references cannot enter new tracker state', () => {
  const party = fresh();
  for (const change of [{ name: '' }, { amount: 0 }, { amount: 2 }, { amount: 0.5 }, { source: 'x'.repeat(501) }, { duration: 'x'.repeat(251) }, { reference: reference('Hammer-Sword') }]) {
    assert.equal(reduce(party, { type: 'condition', condition: { ...condition(), ...change } }), party);
  }
  for (const change of [{ amount: -1 }, { duration: 2 }, { reference: { definitionId: 'x', faceId: 'wrong' } }]) {
    const invalid = structuredClone(party); invalid.argonauts[0].conditions = [{ ...condition(), ...change }]; assert.throws(() => parseParty(invalid));
  }
  const duplicate = structuredClone(party); duplicate.argonauts[0].conditions = [condition(), condition()]; assert.throws(() => parseParty(duplicate));
});

test('resets preserve hidden token names and affect only the requested tracker scope and owner', () => {
  let party = fresh(); party.argonauts[0].tokens = { Ambrosia: 4, Aether: 8, custom: 1 }; party.argonauts[1].tokens = { Ambrosia: 2 };
  party.resources = { Ambrosia: 10 };
  party = reduce(party, { type: 'condition', condition: condition() });
  const reset = reduce(party, { type: 'reset-tokens' });
  assert.deepEqual(reset.argonauts[0].tokens, { Ambrosia: 0, Aether: 0, custom: 0 });
  assert.deepEqual(reset.argonauts[1], party.argonauts[1]); assert.deepEqual(reset.resources, party.resources);
  assert.deepEqual(reset.argonauts[0].conditions, party.argonauts[0].conditions);
  const cleared = reduce(reset, { type: 'reset-conditions' }); assert.equal(conditionRecords(cleared.argonauts[0]).length, 0);
  assert.deepEqual(cleared.argonauts[0].tokens, reset.argonauts[0].tokens);
});

test('shared resource edits use one party pool and never duplicate local tokens', () => {
  const start = fresh();
  let party = reduce(start, { type: 'resource', name: 'Ambrosia', delta: 1 });
  party = reduce(party, { type: 'resource', argonautId: 'd', name: 'Ambrosia', delta: 1 });
  assert.deepEqual(party.resources, { Ambrosia: 2 }); assert.deepEqual(party.argonauts, start.argonauts);
  assert.equal(reduce(party, { type: 'resource', name: '', delta: 1 }), party);
  assert.equal(reduce(party, { type: 'resource', name: 'Other', delta: -1 }), party);
  assert.equal(reduce(party, { type: 'resource', name: 'Other', delta: 2 }), party);
  party = reduce(party, { type: 'resource', name: '__proto__', delta: 1 }); assert.equal(party.resources.__proto__, 1);
  const reset = reduce(party, { type: 'reset-resources' }); assert.deepEqual(reset.resources, { Ambrosia: 0, ['__proto__']: 0 });
  const removed = reduce(reset, { type: 'remove-resource', name: 'Ambrosia' }); assert.equal(Object.hasOwn(removed.resources, 'Ambrosia'), false);
});

test('structured trackers persist through restart and backups, while unavailable condition references remain recoverable', async () => {
  let party = reduce(fresh(), { type: 'condition', condition: condition('c1', reference('Roused')) });
  party = reduce(party, { type: 'resource', name: 'Hope', delta: 1 });
  party = reduce(party, { type: 'token', token: 'Pain', delta: 1 });
  const profile = { id: party.id, name: 'Trackers', party };
  const backup = readBackup(exportProfile(profile), catalogue); assert.deepEqual(backup.profile, profile);
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: profile.id, profiles: [profile] };
  const data = new Map(), adapter = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, runExclusive: async task => task() };
  const store = new SnapshotStore(adapter); await store.load(); await store.save(workspace);
  assert.deepEqual((await new SnapshotStore(adapter).load()).workspace, workspace);
  assert.deepEqual(importProfile(workspace, backup.profile, 'copy', 'Copy').profiles[1].party.argonauts, party.argonauts);
  const missing = structuredClone(party); missing.argonauts[0].conditions[0].reference.definitionId = 'missing';
  assert.deepEqual(parseParty(missing), missing); assert.ok(referenceProblems(missing, catalogue).some(text => text.includes('unavailable condition')));
  assert.throws(() => readBackup(exportProfile({ ...profile, party: missing }), catalogue), /unavailable condition/);
});
