import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCatalogueRepository } from '../src/catalogue/repository.ts';
import { createParty, parseParty } from '../src/domain/party.ts';
import { allocatedGear, gearStock, inventoryFor, inventoryNotices, physicalGearLimit, inventoryAllowsTitan } from '../src/domain/inventory.ts';
import { isDreamwalker, dreamwalkerVariants } from '../src/domain/titan-selection.ts';
import { loadoutState } from '../src/domain/loadout.ts';
import { partyReducer } from '../src/state/party-reducer.ts';
import { exportProfile, readBackup, parseWorkspace, importProfile, referenceProblems } from '../src/storage/workspace.ts';
import { activeDestination, destinationPath, DESTINATIONS } from '../src/navigation/destinations.ts';
const input = JSON.parse(fs.readFileSync(new URL('../data/generated/catalogue.json', import.meta.url)));
const catalogue = createCatalogueRepository(input);
const named = name => catalogue.byName(name)[0];
const initial = () => createParty('p', ['a', 'b', 'c', 'd'], catalogue.version);
const reduce = (party, action) => partyReducer(party, { argonautId: 'a', partyId: party.id, ...action }, catalogue);
const equip = (party, card, positionId, instanceId, argonautId = 'a', extra = {}) => reduce(party, { type: 'equip', argonautId, request: { definitionId: card.id, faceId: 'front', positionId, instanceId, ...extra } });
const acquire = (party, card) => reduce(party, { type: 'inventory-quantity', definitionId: card.id, delta: 1 });
const track = party => reduce(party, { type: 'inventory-mode', enabled: true });
const yarn = named('Yarn Talisman'), hammer = named('Hammer-Sword'), armor = named('Trireme Breastplate');
const titanInstance = (id, card) => ({ id: `${id}:titan`, definitionId: card.id, faceId: card.faces[0].id, exhausted: false, enabledEffectIds: [], counters: {} });

test('old saves are unrestricted, seed assigned copies on tracking, and do not mutate or lose loadouts', () => {
  let party = equip(initial(), hammer, 'base:hand:0', 'hammer');
  party = equip(party, yarn, 'base:attachment:0', 'yarn', 'b');
  const before = structuredClone(party);
  assert.equal(party.inventory, undefined);
  assert.deepEqual(inventoryFor(party, catalogue).gear, { [hammer.id]: 1, [yarn.id]: 1 });
  assert.deepEqual(party, before);
  const tracked = track(party);
  assert.equal(tracked.inventory.enforce, true);
  assert.deepEqual(tracked.argonauts, party.argonauts);
  assert.equal(gearStock(tracked, hammer.id, catalogue).allocated, 1);
  assert.deepEqual(parseParty(JSON.parse(JSON.stringify(tracked))), tracked);
});

test('inventory rejects over-allocation across Argonauts and releases a copy on removal', () => {
  let party = track(acquire(initial(), yarn));
  party = equip(party, yarn, 'base:attachment:0', 'first');
  assert.deepEqual(gearStock(party, yarn.id, catalogue), { owned: 1, allocated: 1, available: 0 });
  assert.equal(equip(party, yarn, 'base:attachment:0', 'second', 'b'), party);
  party = reduce(party, { type: 'remove-equipment', instanceId: 'first' });
  assert.deepEqual(gearStock(party, yarn.id, catalogue), { owned: 1, allocated: 0, available: 1 });
  party = equip(party, yarn, 'base:attachment:0', 'second', 'b');
  assert.equal(party.argonauts[1].instances[0].id, 'second');
});

test('replacement with the same definition uses the existing acquired copy; manual exceptions cannot create supply', () => {
  let party = track(acquire(initial(), yarn));
  party = equip(party, yarn, 'base:attachment:0', 'old');
  party = equip(party, yarn, 'base:attachment:0', 'new');
  assert.equal(party.argonauts[0].instances[0].id, 'new');
  assert.equal(allocatedGear(party, catalogue)[yarn.id], 1);
  assert.equal(equip(party, yarn, 'base:attachment:1', 'extra', 'a', { overrideReason: 'Manual exception' }), party);
  assert.equal(equip(party, hammer, 'base:hand:0', 'unowned', 'a', { overrideReason: 'Manual exception' }), party);
});

test('two-hand cards, reverse faces, exhaustion, discard and Tides of Fate keep the same supply', () => {
  let party = track(acquire(reduce(initial(), { type: 'campaign-cycle', cycle: 3 }), hammer));
  party = equip(party, hammer, 'base:hand:0', 'hammer');
  assert.equal(party.argonauts[0].equipment[0].positionIds.length, 2);
  party = reduce(party, { type: 'equipment-face', instanceId: 'hammer', faceId: 'back' });
  assert.equal(party.argonauts[0].instances[0].faceId, 'back');
  party = reduce(party, { type: 'equipment-exhausted', instanceId: 'hammer', exhausted: true });
  party = reduce(party, { type: 'equipment-discarded', instanceId: 'hammer', discarded: true });
  const inventory = structuredClone(party.inventory);
  assert.deepEqual(gearStock(party, hammer.id, catalogue), { owned: 1, allocated: 1, available: 0 });
  party = reduce(party, { type: 'clear-all', confirmed: true });
  assert.deepEqual(party.inventory, inventory);
  assert.equal(party.argonauts[0].instances[0].discarded, false);
  assert.equal(allocatedGear(party, catalogue)[hammer.id], 1);
});

test('bonus support slots use acquired Gear and keep pending copies allocated after Armor is removed', () => {
  const support = catalogue.search({ family: 'Gear', slot: 'Support', campaignCycle: 1 }).find(card => !card.faces[0].slotEffects.length && !card.faces[0].data.traits.includes('Paradox'));
  let party = track(acquire(acquire(initial(), armor), support));
  party = equip(party, armor, 'base:armor:0', 'armor');
  const bonus = loadoutState(party.argonauts[0], catalogue).positions.filter(p => p.kind === 'support')[2];
  party = equip(party, support, bonus.id, 'support');
  assert.ok(party.argonauts[0].instances.some(i => i.id === 'support'));
  party = reduce(party, { type: 'remove-equipment', instanceId: 'armor' });
  assert.equal(loadoutState(party.argonauts[0], catalogue).pending.length, 1);
  assert.equal(gearStock(party, support.id, catalogue).available, 0);
  assert.equal(equip(party, support, 'base:support:0', 'other', 'b'), party);
  party = equip(party, support, 'base:support:0', 'support', 'a', { reuse: true });
  assert.equal(loadoutState(party.argonauts[0], catalogue).pending.length, 0);
  assert.equal(allocatedGear(party, catalogue)[support.id], 1);
});

test('physical limits deduplicate printed IDs and flag ambiguous or absent IDs', () => {
  assert.equal(physicalGearLimit(hammer, catalogue), new Set(hammer.printedIds).size);
  let party = initial();
  const limit = physicalGearLimit(yarn, catalogue);
  assert.ok(limit > 0);
  for (let i = 0; i < limit; i++) party = acquire(party, yarn);
  assert.equal(acquire(party, yarn), party);
  const fake = { ...yarn, printedIds: [yarn.printedIds[0], yarn.printedIds[0]] };
  assert.equal(physicalGearLimit(fake, catalogue), 1);
  assert.equal(physicalGearLimit({ ...fake, printedIds: [] }, catalogue), null);
  const ambiguous = { ...catalogue, byPrintedId: () => [fake, { ...fake, id: 'another' }] };
  assert.equal(physicalGearLimit(fake, ambiguous), null);
});

test('legacy overages are preserved for review and can be reduced without acquiring more', () => {
  let party = initial();
  for (const [index, id] of ['a', 'b', 'c', 'd'].entries()) party = equip(party, yarn, 'base:attachment:0', `copy-${index}`, id);
  party = track(party);
  assert.equal(gearStock(party, yarn.id, catalogue).owned, 4);
  assert.ok(inventoryNotices(party, catalogue).some(notice => notice.includes('exceeds')));
  assert.equal(acquire(party, yarn), party);
  assert.equal(reduce(party, { type: 'inventory-quantity', definitionId: yarn.id, delta: -1 }), party);
  party = reduce(party, { type: 'remove-equipment', instanceId: 'copy-0' });
  party = reduce(party, { type: 'inventory-quantity', definitionId: yarn.id, delta: -1 });
  assert.equal(gearStock(party, yarn.id, catalogue).owned, 3);
});

test('quantity removal requires confirmation at zero and stale or malformed callbacks cannot edit campaigns', () => {
  let party = acquire(initial(), yarn);
  const decrease = { type: 'inventory-quantity', definitionId: yarn.id, delta: -1 };
  assert.equal(reduce(party, decrease), party);
  for (const action of [{ ...decrease, confirmed: true, partyId: 'other' }, { ...decrease, delta: 2 }, { type: 'inventory-mode', partyId: 'other', enabled: true }, { type: 'campaign-notes', partyId: 'other', text: 'Stale' }]) assert.equal(reduce(party, action), party);
  party = reduce(party, { ...decrease, confirmed: true });
  assert.deepEqual(party.inventory.gear, {});
});

test('future-cycle acquisitions are blocked while owned older selections are retained on cycle changes', () => {
  const later = catalogue.search({ family: 'Gear' }).find(card => card.faces.every(face => face.cycle === 'Cycle V'));
  assert.equal(acquire(initial(), later).inventory, undefined);
  let party = reduce(initial(), { type: 'campaign-cycle', cycle: 5 });
  party = acquire(party, later);
  party = reduce(party, { type: 'campaign-cycle', cycle: 1 });
  assert.equal(party.inventory.gear[later.id], 1);
});

test('Titan availability follows cycle and acquired list; Dreamwalkers stay available', () => {
  let party = track(initial());
  const mazerunner = named('Mazerunner');
  assert.equal(inventoryAllowsTitan(party, mazerunner.id, 'front', catalogue), false);
  assert.equal(reduce(party, { type: 'titan', titan: titanInstance('a', mazerunner) }), party);
  party = reduce(party, { type: 'inventory-titan', definitionId: mazerunner.id, acquired: true });
  party = reduce(party, { type: 'titan', titan: titanInstance('a', mazerunner) });
  assert.equal(party.argonauts[0].titan.definitionId, mazerunner.id);
  assert.equal(reduce(party, { type: 'inventory-titan', definitionId: mazerunner.id, acquired: false, confirmed: true }), party);
  party = reduce(party, { type: 'titan', titan: null });
  assert.equal(reduce(party, { type: 'inventory-titan', definitionId: mazerunner.id, acquired: false }), party);
  party = reduce(party, { type: 'inventory-titan', definitionId: mazerunner.id, acquired: false, confirmed: true });
  assert.deepEqual(party.inventory.titans, []);
  const dreamwalker = dreamwalkerVariants(catalogue.search({ family: 'Titan' }), 1)[0];
  assert.ok(isDreamwalker(dreamwalker.faces[0]));
  party = reduce(party, { type: 'titan', titan: titanInstance('a', dreamwalker) });
  assert.equal(party.argonauts[0].titan.definitionId, dreamwalker.id);
  const later = dreamwalkerVariants(catalogue.search({ family: 'Titan' }), 5).at(-1);
  assert.equal(reduce(party, { type: 'titan', titan: titanInstance('a', later) }), party);
});

test('inventory, campaign notes and selected Titans survive restart and independent backup import', () => {
  let party = equip(initial(), yarn, 'base:attachment:0', 'yarn');
  party = reduce(party, { type: 'titan', titan: titanInstance('a', named('Mazerunner')) });
  party = track(party);
  party = reduce(party, { type: 'campaign-notes', text: 'Voyage\nBooks and narrative events' });
  const profile = { id: party.id, name: 'Expedition', party };
  const restored = readBackup(exportProfile(profile), catalogue);
  assert.deepEqual(restored.profile.party, party);
  const workspace = { format: 'ato-workspace', schemaVersion: 1, activeProfileId: party.id, profiles: [profile] };
  assert.deepEqual(parseWorkspace(JSON.parse(JSON.stringify(workspace))), workspace);
  const imported = importProfile(workspace, restored.profile, 'new', 'Copy');
  assert.deepEqual(imported.profiles[0].party, party);
  assert.deepEqual(imported.profiles[1].party.inventory, party.inventory);
  const changed = reduce(imported.profiles[1].party, { type: 'campaign-notes', text: 'Independent' });
  assert.equal(changed.campaignNotes, 'Independent');
  assert.equal(party.campaignNotes, 'Voyage\nBooks and narrative events');
});

test('malformed inventory saves fail validation and unavailable records are reported without local data loss', () => {
  const party = initial();
  for (const inventory of [{ version: 2, enforce: false, gear: {}, titans: [] }, { version: 1, enforce: false, gear: { bad: -1 }, titans: [] }, { version: 1, enforce: true, gear: { bad: 1.5 }, titans: [] }, { version: 1, enforce: true, gear: {}, titans: ['same', 'same'] }]) assert.throws(() => parseParty({ ...party, inventory }));
  const unknown = { ...party, inventory: { version: 1, enforce: true, gear: { missing: 2 }, titans: ['missing-titan'] } };
  assert.deepEqual(parseParty(unknown), unknown);
  assert.equal(referenceProblems(unknown, catalogue).length, 2);
  assert.equal(inventoryNotices(unknown, catalogue).length, 1);
});

test('six header destinations keep active Argonaut IDs and map editor screens to their section', () => {
  assert.deepEqual(DESTINATIONS, ['Argo', 'Map', 'Cargo', 'Technology', 'Argonauts', 'Timeline']);
  assert.equal(destinationPath('Argonauts', 'my argonaut'), '/argonaut/my%20argonaut');
  for (const destination of DESTINATIONS) assert.equal(activeDestination(destinationPath(destination, 'b')), destination);
  assert.equal(activeDestination('/loadout/b'), 'Argonauts');
  assert.equal(activeDestination('/memory/c'), 'Argonauts');
  assert.equal(activeDestination('/gear'), 'Cargo');
  assert.equal(activeDestination('/profiles'), null);
});

test('saved over-allocation warns on import, disabling tracking preserves stock, and late-cycle supply cannot bypass the current cycle', () => {
  let party = track(acquire(reduce(initial(), { type: 'campaign-cycle', cycle: 3 }), hammer));
  party = reduce(party, { type: 'campaign-cycle', cycle: 1 });
  assert.equal(equip(party, hammer, 'base:hand:0', 'late'), party);
  const inventory = party.inventory;
  party = reduce(party, { type: 'inventory-mode', enabled: false });
  assert.deepEqual(party.inventory.gear, inventory.gear);
  party = equip(party, yarn, 'base:attachment:0', 'manual');
  assert.equal(party.argonauts[0].instances[0].definitionId, yarn.id);
  const restored = readBackup(exportProfile({ id: 'p', name: 'Review', party }), catalogue);
  assert.ok(restored.warnings.some(warning => warning.includes('allocated, but only 0 acquired')));
  assert.deepEqual(restored.profile.party, party);
});
