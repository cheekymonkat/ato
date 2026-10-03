import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, parseWorkspace, readBackup } from '../src/storage/workspace.ts';

const catalogue = createCatalogueRepository(JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url))));
const fresh = () => createParty('notes-party', ['a', 'b', 'c', 'd'], catalogue.version);
const text = 'Book: The Labyrinth\nAffliction: wounded left arm\n\nFollow up after the next voyage.\n';

test('notes survive save and backup round trips; older saves remain valid and invalid notes are rejected', () => {
  const older = fresh();
  assert.equal(parseParty(older).argonauts[0].notes, undefined);
  const party = partyReducer(older, { type: 'notes', partyId: older.id, argonautId: 'a', text });
  const profile = { id: party.id, name: 'Voyage', party };
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: party.id, profiles: [profile] };
  assert.equal(parseWorkspace(JSON.parse(JSON.stringify(workspace))).profiles[0].party.argonauts[0].notes, text);
  assert.equal(readBackup(exportProfile(profile), catalogue).profile.party.argonauts[0].notes, text);
  for (const notes of [null, 3, {}, []]) {
    const invalid = structuredClone(party); invalid.argonauts[0].notes = notes;
    assert.throws(() => parseParty(invalid), /invalid notes/);
  }
});

test('editing notes targets the captured Argonaut and campaign, and battle cleanup keeps them', () => {
  const start = fresh();
  const selected = partyReducer(start, { type: 'select', argonautId: 'b' });
  const action = { type: 'notes', partyId: start.id, argonautId: 'a', text };
  const edited = partyReducer(selected, action);
  assert.equal(edited.activeArgonautId, 'b');
  assert.equal(edited.argonauts[0].notes, text);
  assert.equal(start.argonauts[0].notes, undefined);
  assert.equal(edited.argonauts[1], selected.argonauts[1]);
  assert.equal(partyReducer(edited, action), edited);
  assert.equal(partyReducer(edited, { ...action, partyId: 'other-party', text: 'Wrong campaign' }), edited);
  assert.equal(partyReducer(edited, { ...action, argonautId: 'missing' }), edited);
  const refreshed = partyReducer(edited, { type: 'refresh-gear', argonautId: 'a' });
  const cleared = partyReducer(refreshed, { type: 'clear-all', argonautId: 'a', partyId: start.id, confirmed: true });
  assert.equal(cleared.argonauts[0].notes, text);
  assert.equal(partyReducer(cleared, { ...action, text: '' }).argonauts[0].notes, '');
});
