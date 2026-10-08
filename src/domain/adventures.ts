import type { CatalogueRepository } from '../catalogue/repository.ts';
import { adventureDefinitions, adventureEntry, allAdventureDefinitions } from './adventure-definitions.ts';
import type { AdventureEntry, AdventureHub, AdventureTable } from './adventure-definitions.ts';
import { campaignCycle } from './campaign.ts';
import type { CampaignCycle } from './campaign.ts';
import { isRecord } from './json.ts';
import { currentMilestone } from './milestones.ts';
import type { Party } from './party.ts';

export interface AdventureState {
  version: 1;
  /** Entries begun in order; campaign hub progress is distinct from replay history. */
  hubs: Record<string, string[]>;
  boxes: Record<string, boolean[]>;
  /** Legacy save field; Party Leader is no longer tracked by this page. */
  leaderId?: string;
  secretCodes: string[];
  lastAdventure?: { entryId: string; passage?: string; leaderId?: string; tableReset?: boolean };
}
export interface AdventureReplay {
  version: 1; boxes: Record<string, boolean[]>;
}
export type AdventureEdit =
  | { type: 'begin'; entryId: string; expectedProgress: number; expectedStage: string; expectedBoxes: boolean[] }
  | { type: 'story-box'; entryId: string; index: number; checked: boolean; expectedProgress: number; expectedStage: string; expectedBoxes: boolean[] }
  | { type: 'undo-hub'; id: string; expectedProgress: number; confirmed: boolean }
  | { type: 'fated-box'; entryId: string; index: number; expected: boolean; checked: boolean }
  | { type: 'box'; id: string; index: number; expected: boolean; checked: boolean }
  | { type: 'secret'; code: string; resolved: boolean; expected: boolean; confirmed?: boolean };
export const emptyAdventureReplay = (): AdventureReplay => ({ version: 1, boxes: {} });
export const adventureState = (party: Party): AdventureState => party.argo?.adventures ?? { version: 1, hubs: {}, boxes: {}, secretCodes: [] };
const bools = (value: unknown, length: number): value is boolean[] => Array.isArray(value) && value.length === length && value.every(v => typeof v === 'boolean');
export const inwardReplayId = (cycle: CampaignCycle) => `c${cycle}-inward-odyssey`;
function replayCount(id: string): number | null {
  const found = adventureEntry(id);
  if (found?.entry.fatedBoxes.length) return found.entry.fatedBoxes.length;
  return /^c[1-5]-inward-odyssey$/.test(id) ? 20 : null;
}
export function validAdventureReplay(value: unknown): value is AdventureReplay {
  return isRecord(value) && value.version === 1 && isRecord(value.boxes) && Object.entries(value.boxes).every(([id, boxes]) => {
    const count = replayCount(id); return count !== null && bools(boxes, count);
  });
}
function localBoxCount(id: string): number | null {
  for (const data of allAdventureDefinitions()) {
    const track = [...data.tracks, ...data.unlistedSheetTracks].find(t => t.id === id);
    if (track) return track.boxCount;
  }
  return null;
}
export function validAdventureState(value: unknown): value is AdventureState {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.hubs) || !isRecord(value.boxes) || !Array.isArray(value.secretCodes)) return false;
  if (!value.secretCodes.every(v => typeof v === 'string' && /^\d{4}$/.test(v)) || new Set(value.secretCodes).size !== value.secretCodes.length) return false;
  if (value.leaderId !== undefined && typeof value.leaderId !== 'string') return false;
  if (value.lastAdventure !== undefined && (!isRecord(value.lastAdventure) || typeof value.lastAdventure.entryId !== 'string' || !adventureEntry(value.lastAdventure.entryId)
    || value.lastAdventure.passage !== undefined && typeof value.lastAdventure.passage !== 'string' || value.lastAdventure.leaderId !== undefined && typeof value.lastAdventure.leaderId !== 'string'
    || value.lastAdventure.tableReset !== undefined && typeof value.lastAdventure.tableReset !== 'boolean')) return false;
  return Object.entries(value.hubs).every(([id, entries]) => {
    const hub = allAdventureDefinitions().flatMap(data => data.hubs).find(h => h.trackId === id);
    return hub && Array.isArray(entries) && entries.length <= hub.progressBoxCount && entries.every((id, i) => {
      const entry = hub.entries.find(e => e.id === id);
      return entry && entry.kind === (i === 0 ? 'opening' : i === hub.progressBoxCount - 1 ? 'closing' : 'rolled');
    });
  }) && Object.entries(value.boxes).every(([id, boxes]) => { const count = localBoxCount(id); return count !== null && bools(boxes, count); });
}
export function fatedBoxes(replay: AdventureReplay, id: string): boolean[] { return replay.boxes[id] ?? Array(replayCount(id) ?? 0).fill(false); }
export function hubProgress(party: Party, hub: AdventureHub): number { return adventureState(party).hubs[hub.trackId]?.length ?? 0; }
export function hubRoll(hub: AdventureHub, stage: string): [number, number] | null {
  return Object.entries(hub.selection).find(([key]) => key.split('/').includes(stage) || key === stage.replace(/[AB]$/, ''))?.[1] ?? null;
}
export function hubForRoll(party: Party, roll: number, catalogue: CatalogueRepository): AdventureHub | null {
  if (!Number.isInteger(roll) || roll < 1 || roll > 10) return null;
  const stage = currentMilestone(party, 'story', catalogue).side?.label ?? '';
  return adventureDefinitions(campaignCycle(party)).hubs.find(h => { const range = hubRoll(h, stage); return range && roll >= range[0] && roll <= range[1]; }) ?? null;
}
export function canBeginHub(party: Party, hub: AdventureHub, entry: AdventureEntry, replay: AdventureReplay, stage: string): boolean {
  const progress = hubProgress(party, hub);
  return !!hubRoll(hub, stage) && progress < hub.progressBoxCount && entry.kind === (progress === 0 ? 'opening' : progress === hub.progressBoxCount - 1 ? 'closing' : 'rolled')
    && (!entry.fatedBoxes.length || fatedBoxes(replay, entry.id).some(v => !v));
}
export function availableHubStories(party: Party, replay: AdventureReplay, catalogue: CatalogueRepository) {
  const stage = currentMilestone(party, 'story', catalogue).side?.label ?? '';
  return adventureDefinitions(campaignCycle(party)).hubs.flatMap(hub => {
    const range = hubRoll(hub, stage);
    const entries = hub.entries.filter(entry => canBeginHub(party, hub, entry, replay, stage));
    return range && entries.length ? [{ hub, entries, weight: range[1] - range[0] + 1 }] : [];
  });
}
export interface AdventureChoice { hub: AdventureHub; entry: AdventureEntry; stage: string; progress: number; boxes: boolean[] }
/** Conditional d10 distributions, equivalent to re-rolling invalid results without an unbounded loop. */
export function selectAdventureStory(party: Party, replay: AdventureReplay, catalogue: CatalogueRepository, random: () => number = Math.random): AdventureChoice | null {
  function pick<T>(items: { value: T; weight: number }[]): T | null {
    if (!items.length) return null;
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return null;
    let remaining = roll * items.reduce((n, item) => n + item.weight, 0);
    for (const item of items) { remaining -= item.weight; if (remaining < 0) return item.value; }
    return items.at(-1)!.value;
  }
  const selected = pick(availableHubStories(party, replay, catalogue).map(candidate => ({ value: candidate, weight: candidate.weight })));
  if (!selected) return null;
  const entry = pick(selected.entries.map(entry => ({ value: entry, weight: entry.roll ? entry.roll[1] - entry.roll[0] + 1 : 1 })));
  return entry ? { hub: selected.hub, entry, stage: currentMilestone(party, 'story', catalogue).side?.label ?? '', progress: hubProgress(party, selected.hub), boxes: [...fatedBoxes(replay, entry.id)] } : null;
}
export function adventureChoiceAvailable(party: Party, replay: AdventureReplay, choice: AdventureChoice, catalogue: CatalogueRepository): boolean {
  const stage = currentMilestone(party, 'story', catalogue).side?.label ?? '';
  const hub = adventureDefinitions(campaignCycle(party)).hubs.find(h => h.id === choice.hub.id);
  const entry = hub?.entries.find(e => e.id === choice.entry.id);
  const boxes = fatedBoxes(replay, choice.entry.id);
  return !!hub && !!entry && choice.stage === stage && hubProgress(party, hub) === choice.progress && choice.boxes.length === boxes.length
    && choice.boxes.every((v,i) => v === boxes[i]) && canBeginHub(party, hub, entry, replay, stage);
}
function saveState(party: Party, state: AdventureState): Party {
  const argo = party.argo ?? { version: 1 as const, tracks: {}, limits: {}, records: {} };
  return { ...party, argo: { ...argo, adventures: state } };
}
/** A table resets as soon as its final Fated Box is marked. Last adventure retains the selected variant. */
function markReplay(replay: AdventureReplay, id: string, index: number, checked: boolean, table?: AdventureTable) {
  const current = fatedBoxes(replay, id), boxes = { ...replay.boxes, [id]: current.map((v, i) => i === index ? checked : v) };
  const entries = table?.entries.filter(e => e.fatedBoxes.length).map(e => e.id) ?? [id];
  const tableReset = checked && entries.every(id => (boxes[id] ?? fatedBoxes(replay, id)).every(Boolean));
  if (tableReset) for (const entry of entries) delete boxes[entry];
  return { replay: { version: 1 as const, boxes }, tableReset };
}
/** Apply a campaign edit and any shared Fated history in one transaction. Invalid/stale edits are no-ops. */
export function changeAdventure(party: Party, replay: AdventureReplay, edit: AdventureEdit, catalogue: CatalogueRepository): { party: Party; replay: AdventureReplay } {
  const original = { party, replay }, cycle = campaignCycle(party), state = adventureState(party), data = adventureDefinitions(cycle);
  if (edit.type === 'story-box') {
    const found = adventureEntry(edit.entryId), boxes = fatedBoxes(replay, edit.entryId);
    const hub = data.hubs.find(h => h.id === found?.table.id);
    if (!found || found.cycle !== cycle || currentMilestone(party, 'story', catalogue).side?.label !== edit.expectedStage
      || !Number.isInteger(edit.index) || edit.index < 0 || edit.index >= boxes.length
      || edit.expectedBoxes.length !== boxes.length || boxes.some((v,i) => v !== edit.expectedBoxes[i])
      || hub && hubProgress(party, hub) !== edit.expectedProgress) return original;
    if (edit.checked) {
      if (edit.index !== boxes.findIndex(v => !v)) return original;
      return changeAdventure(party, replay, { ...edit, type: 'begin' }, catalogue);
    }
    // Correct the most recent variant first; never leave a later box marked before an earlier one.
    if (!boxes[edit.index] || boxes.slice(edit.index + 1).some(Boolean)) return original;
    const nextReplay = markReplay(replay, edit.entryId, edit.index, false, found.table).replay;
    const undoVisit = hub && state.hubs[hub.trackId]?.at(-1) === edit.entryId;
    return { replay: nextReplay, party: undoVisit ? saveState(party, { ...state, hubs: { ...state.hubs, [hub.trackId]: state.hubs[hub.trackId].slice(0,-1) } }) : party };
  }
  if (edit.type === 'begin') {
    const found = adventureEntry(edit.entryId), stage = currentMilestone(party, 'story', catalogue).side?.label ?? '';
    if (!found || found.cycle !== cycle || edit.expectedStage !== stage) return original;
    const hub = data.hubs.find(h => h.id === found.table.id), boxes = fatedBoxes(replay, edit.entryId);
    if (boxes.length !== edit.expectedBoxes.length || boxes.some((v,i) => v !== edit.expectedBoxes[i]) || hub && (hubProgress(party, hub) !== edit.expectedProgress || !canBeginHub(party, hub, found.entry, replay, stage))) return original;
    const index = boxes.findIndex(v => !v);
    if (boxes.length && index < 0) return original;
    const result = index >= 0 ? markReplay(replay, edit.entryId, index, true, found.table) : { replay, tableReset: false };
    const next = { ...state, hubs: hub ? { ...state.hubs, [hub.trackId]: [...(state.hubs[hub.trackId] ?? []), edit.entryId] } : state.hubs,
      lastAdventure: { entryId: edit.entryId, ...(found.entry.fatedBoxes[index]?.passage ? { passage: found.entry.fatedBoxes[index].passage } : {}), ...(result.tableReset ? { tableReset: true } : {}) } };
    return { party: saveState(party, next), replay: result.replay };
  }
  if (edit.type === 'undo-hub') {
    const hub = data.hubs.find(h => h.trackId === edit.id), progress = hub && hubProgress(party, hub);
    if (!hub || !edit.confirmed || !progress || progress !== edit.expectedProgress) return original;
    return { party: saveState(party, { ...state, hubs: { ...state.hubs, [edit.id]: state.hubs[edit.id].slice(0,-1) } }), replay };
  }
  if (edit.type === 'fated-box') {
    const found = adventureEntry(edit.entryId), inward = edit.entryId === inwardReplayId(cycle), boxes = fatedBoxes(replay, edit.entryId);
    if ((!inward && found?.cycle !== cycle) || !Number.isInteger(edit.index) || edit.index < 0 || edit.index >= boxes.length || boxes[edit.index] !== edit.expected || edit.checked === edit.expected) return original;
    return { party, replay: markReplay(replay, edit.entryId, edit.index, edit.checked, found?.table).replay };
  }
  if (edit.type === 'box') {
    const track = [...data.tracks, ...data.unlistedSheetTracks].find(t => t.id === edit.id);
    const boxes = state.boxes[edit.id] ?? Array(track?.boxCount ?? 0).fill(false);
    if (!track || !Number.isInteger(edit.index) || edit.index < 0 || edit.index >= boxes.length || boxes[edit.index] !== edit.expected || edit.checked === edit.expected) return original;
    const onceOnly = 'code' in track && track.code && track.boxCount === 1 ? track.code : null;
    return { party: saveState(party, { ...state, boxes: { ...state.boxes, [edit.id]: boxes.map((v,i) => i === edit.index ? edit.checked : v) },
      secretCodes: onceOnly ? edit.checked ? [...new Set([...state.secretCodes, onceOnly])] : state.secretCodes.filter(c => c !== onceOnly) : state.secretCodes }), replay };
  }
  if (edit.type === 'secret') {
    if (!/^\d{4}$/.test(edit.code) || state.secretCodes.includes(edit.code) !== edit.expected || edit.expected === edit.resolved || !edit.resolved && !edit.confirmed) return original;
    const track = data.tracks.find(t => t.code === edit.code && t.boxCount === 1);
    return { party: saveState(party, { ...state, secretCodes: edit.resolved ? [...state.secretCodes, edit.code] : state.secretCodes.filter(c => c !== edit.code),
      boxes: track ? { ...state.boxes, [track.id]: [edit.resolved] } : state.boxes }), replay };
  }
  return original;
}
/** Import by union, applying the normal full-table reset if the combined history completes a table. */
export function mergeAdventureReplay(a: AdventureReplay, b: AdventureReplay): AdventureReplay {
  const merged: AdventureReplay = { version: 1, boxes: Object.fromEntries([...new Set([...Object.keys(a.boxes), ...Object.keys(b.boxes)])].map(id => [id, fatedBoxes(a,id).map((v,i) => v || fatedBoxes(b,id)[i])])) };
  for (const data of allAdventureDefinitions()) {
    const tables = [...data.hubs, ...data.tables].map(t => t.entries.filter(e=>e.fatedBoxes.length).map(e=>e.id));
    tables.push([inwardReplayId(data.cycle)]);
    for (const ids of tables) if (ids.every(id => fatedBoxes(merged,id).every(Boolean))) for (const id of ids) delete merged.boxes[id];
  }
  return merged;
}
