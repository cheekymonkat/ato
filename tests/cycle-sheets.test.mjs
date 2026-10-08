import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(`data/reference/cycle-sheets/${name}`, root), 'utf8'));
const manifest = read('manifest.json');
const cycles = [1, 2, 3, 4, 5].map(c => read(`cycle-${c}.json`));
const registry = read('resources.json').resources;
const markers = day => day.markers.map(m => m.type).sort();
const dayAt = (cycle, label) => cycles[cycle - 1].timeline.days.find(d => d.label === label);

test('all five sheets retain verified adventure counts, endpoint boxes and special Greek tracks', () => {
  assert.deepEqual(manifest.cycleFiles.map(c => [c.adventureTracks, c.adventureBoxes]), [[8, 36], [8, 32], [7, 32], [8, 43], [8, 41]]);
  for (const cycle of cycles) {
    assert.equal(cycle.adventureTracks.reduce((n, t) => n + t.progressBoxCount, 0), manifest.cycleFiles[cycle.cycle - 1].adventureBoxes);
    assert.equal(new Set(cycle.adventureTracks.map(t => t.id)).size, cycle.adventureTracks.length);
    for (const track of cycle.adventureTracks) {
      assert.equal(track.boxes.length, track.progressBoxCount);
      assert.equal(track.boxes[0].label, 'α');
      assert.equal(track.boxes.at(-1).label, 'Ω');
      assert.deepEqual(track.boxes.map(b => b.position), Array.from({ length: track.progressBoxCount }, (_, n) => n + 1));
      if (['Tutorial', 'Ten Thousand Nights and Days', 'Sermons on the Shoals'].includes(track.title)) {
        assert.equal(track.storyReferencesStatus, 'awaiting-user-list');
        assert.deepEqual(track.storyReferences, []);
      } else {
        assert.equal(track.storyReferencesStatus, 'supplied-adventure-tracker');
        assert.equal(track.storyReferences[0].kind, 'opening');
        assert.equal(track.storyReferences.at(-1).kind, 'closing');
        assert.ok(track.storyReferences.every(r => r.entryId && r.title && r.storybookPage));
      }
    }
  }
  for (const cycle of cycles.slice(3)) {
    const special = cycle.adventureTracks.find(t => t.progressBoxCount === 10);
    assert.deepEqual(special.boxes.map(b => b.label), ['α', 'β', 'γ', 'δ', 'ε', 'λ', 'ο', 'σ', 'ψ', 'Ω']);
    assert.equal(special.layout.columnSpan, 2);
  }
});

test('timeline includes blank days and one T6/00 row, with all reviewed research/battle markers', () => {
  const expectedCounts = [[14, 24, 17], [14, 24, 23], [15, 26, 24], [21, 27, 20], [14, 25, 24]];
  const lastDays = [80, 80, 90, 96, 80];
  for (const [index, cycle] of cycles.entries()) {
    const expectedLabels = (index === 0 ? ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6/00'] : ['00'])
      .concat(Array.from({ length: lastDays[index] }, (_, n) => String(n + 1).padStart(2, '0')));
    assert.deepEqual(cycle.timeline.days.map(d => d.label), expectedLabels);
    assert.equal(cycle.timeline.days.length, manifest.cycleFiles[index].timelineDays);
    assert.equal(new Set(cycle.timeline.days.map(d => d.id)).size, expectedLabels.length);
    assert.deepEqual(['battle', 'battleResearch', 'structuralResearch'].map(type => cycle.timeline.days.filter(d => d.markers.some(m => m.type === type)).length), expectedCounts[index]);
    for (const day of cycle.timeline.days) {
      assert.equal(new Set(markers(day)).size, day.markers.length);
      for (const marker of day.markers) assert.equal(marker.phase, marker.type === 'battle' ? 'encounter' : 'advancement');
    }
  }
  assert.deepEqual(markers(dayAt(1, '01')), ['battle', 'structuralResearch']);
  assert.deepEqual(markers(dayAt(3, '30')), ['battle', 'battleResearch', 'structuralResearch']);
  assert.deepEqual(markers(dayAt(4, '54')), ['battleResearch', 'structuralResearch']);
  assert.deepEqual(markers(dayAt(4, '92')), []);
  assert.deepEqual(markers(dayAt(4, '96')), ['battle']);
});

test('special events, acclimation timing and final story instructions remain separate from notes', () => {
  assert.equal(dayAt(1, '06').events[0].title, 'Cackle Special Event');
  assert.equal(dayAt(3, '01').events[0].storyReference, '0040');
  assert.equal(dayAt(5, '06').events[0].title, 'Painful Awakening Special Event');
  for (const cycle of cycles) {
    const entries = cycle.timeline.days.filter(d => d.events.some(e => e.type === 'acclimation'));
    assert.deepEqual(entries.map(d => d.label), cycle.cycle === 3 ? ['19', '37', '55'] : ['18', '36', '54']);
    assert.deepEqual(entries.flatMap(d => d.events.filter(e => e.type === 'acclimation').map(e => e.number)), [1, 2, 3]);
  }
  assert.equal(dayAt(4, '18').events.find(e => e.type === 'acclimation').printedLockIcon, true);
  assert.equal(dayAt(4, '36').events.length, 2);
  assert.equal(dayAt(4, '36').events.find(e => e.type === 'specialEvent').conditionText, 'If Story card 1');
  assert.equal(cycles[4].timeline.endOfTimeline.storyReference, '3749');
});

test('cargo references real SVGs, preserves cycle resources and keeps Core/Rare lists distinct', () => {
  assert.equal(registry.length, 65);
  const byId = new Map(registry.map(r => [r.id, r]));
  assert.equal(byId.size, registry.length);
  for (const cycle of cycles) {
    const groups = cycle.cargo.groups;
    assert.equal(groups.find(g => g.category === 'mortal').entries.length, 3);
    assert.equal(groups.find(g => g.category === 'divine').hold, 'hidden');
    assert.equal(groups.find(g => g.category === 'rare').hold, cycle.cycle < 3 ? 'hidden' : 'main');
    assert.equal(groups.find(g => g.category === 'rare').kind, 'namedQuantityList');
    for (const group of groups) for (const entry of group.entries ?? []) {
      const resource = byId.get(entry.resourceId);
      assert.ok(resource, entry.resourceId);
      assert.ok(resource.cycles.includes(cycle.cycle));
      assert.equal(resource.category, group.category);
    }
  }
  assert.equal(byId.get('cores').kind, 'namedQuantityList');
  assert.equal(byId.get('cores').subtype, 'core');
  assert.deepEqual(byId.get('liquid-aether').cycles, [5]);
  assert.deepEqual(['raw', 'violent', 'frozen', 'mutable', 'oxidized'].map(a => byId.get(`${a}-ambrosia`).cycles), [[1], [2], [3], [4], [5]]);
  const carcass = byId.get('promised-futures-carcass');
  assert.deepEqual(carcass.cycles, [4, 5]);
  assert.ok(carcass.aliases.includes("Promised Future's Carcass"));
  assert.equal(readdirSync(new URL('assets/resource-icons/', root)).filter(f => f.endsWith('.svg')).length, registry.length);
  for (const resource of registry) {
    const svg = readFileSync(new URL(resource.iconPath, root), 'utf8');
    assert.match(svg, /<svg[^>]*viewBox=/);
    assert.match(svg, /<path /);
    assert.doesNotMatch(svg, /<(?:image|text|script|foreignObject)\b|(?:href|src)=|data:/i);
    assert.ok(resource.sources.every(s => s.vectorPathCount > 0));
  }
});

test('supplemental choice rows expand without changing previous cell identities', () => {
  let previousIds = new Set();
  for (const cycle of cycles) {
    const matrix = cycle.choiceMatrix;
    assert.deepEqual(matrix.columns.map(c => c.number), Array.from({ length: 12 }, (_, n) => n + 1));
    assert.deepEqual(matrix.rows.slice(26).map(r => r.id), cycle.cycle < 4 ? ['Aa', 'Bb'] : ['Aa', 'Bb', 'Cc', 'Dd', 'Ee', 'Ff']);
    const ids = new Set(matrix.rows.flatMap(r => matrix.columns.map(c => `${r.id}${c.number}`)));
    assert.equal(ids.size, cycle.cycle < 4 ? 336 : 384);
    assert.equal(ids.size, matrix.cellCount);
    assert.ok(ids.has('A1') && ids.has('Aa1'));
    for (const id of previousIds) assert.ok(ids.has(id));
    assert.equal(matrix.persistsAcrossCycles, true);
    assert.equal(matrix.toggleGesture, 'longPress');
    previousIds = ids;
  }
});

test('hidden tracks count physical cells once and preserve reward positions without auto-awards', () => {
  assert.deepEqual(cycles.map(c => c.cargo.hiddenTracks.map(t => t.progressBoxCount)), [[], [30], [6], [6, 6], [6, 6]]);
  for (const cycle of cycles) for (const track of cycle.cargo.hiddenTracks) {
    assert.equal(track.hold, 'hidden');
    assert.equal(track.layout.rows * track.layout.columns, track.progressBoxCount);
    assert.equal(new Set(track.boxes.map(b => b.sourceRectPt.join(','))).size, track.progressBoxCount);
    assert.deepEqual(track.boxes.filter(b => b.printedRewardResourceId).map(b => b.position), Array.from({ length: track.progressBoxCount / 3 }, (_, n) => (n + 1) * 3));
    assert.equal(track.automaticRewardRules, null);
  }
  assert.deepEqual(cycles.map(c => c.cargo.hiddenNotes.map(n => n.printedLineCount)), [[], [], [], [6], [7]]);
});

test('source evidence uses finite upright coordinates and identifies all ten source PDFs', () => {
  const files = new Set();
  for (const cycle of cycles) {
    for (const source of Object.values(cycle.sources)) {
      files.add(source.file);
      assert.match(source.sha256, /^[a-f0-9]{64}$/);
      assert.equal(source.page, 1);
      assert.deepEqual(source.uprightSizePt, [841.89, 595.276]);
    }
    const rects = cycle.adventureTracks.flatMap(t => t.boxes.map(b => b.sourceRectPt))
      .concat(cycle.timeline.days.map(d => d.sourceNumberRectPt))
      .concat(cycle.cargo.hiddenTracks.flatMap(t => t.boxes.map(b => b.sourceRectPt)));
    for (const [x0, y0, x1, y1] of rects) {
      assert.ok([x0, y0, x1, y1].every(Number.isFinite));
      assert.ok(0 <= x0 && x0 < x1 && x1 <= 841.89);
      assert.ok(0 <= y0 && y0 < y1 && y1 <= 595.276);
    }
  }
  assert.equal(files.size, 10);
});
