import cycle1 from '../../data/reference/adventures/cycle-1.json' with { type: 'json' };
import cycle2 from '../../data/reference/adventures/cycle-2.json' with { type: 'json' };
import cycle3 from '../../data/reference/adventures/cycle-3.json' with { type: 'json' };
import cycle4 from '../../data/reference/adventures/cycle-4.json' with { type: 'json' };
import cycle5 from '../../data/reference/adventures/cycle-5.json' with { type: 'json' };
import type { CampaignCycle } from './campaign.ts';

export interface AdventureEntry {
  id: string; title: string; kind: 'opening' | 'rolled' | 'closing'; label: string;
  roll: [number, number] | null; fatedBoxes: { passage?: string }[];
}
export interface AdventureTable { id: string; title: string; storybookPage: number; entries: AdventureEntry[]; kind?: 'rr' | 'pharos' }
export interface AdventureHub extends AdventureTable {
  trackId: string; progressBoxCount: number; progressLabels: string[]; terrain: string;
  selection: Record<string, [number, number] | null>;
}
export interface AdventureTrack { id: string; title: string; kind: 'special' | 'code' | 'breakthrough'; boxCount: number; code?: string; printedId?: string }
export interface AdventureDefinitions {
  schemaVersion: 1; cycle: CampaignCycle; hubs: AdventureHub[]; tables: AdventureTable[]; tracks: AdventureTrack[];
  unlistedSheetTracks: { id: string; title: string; boxCount: number; labels: string[] }[];
}
const cycles = { 1: cycle1, 2: cycle2, 3: cycle3, 4: cycle4, 5: cycle5 };
export function adventureDefinitions(cycle: CampaignCycle): AdventureDefinitions { return cycles[cycle] as unknown as AdventureDefinitions; }
export const allAdventureDefinitions = () => ([1, 2, 3, 4, 5] as const).map(adventureDefinitions);
export function adventureTables(cycle: CampaignCycle): AdventureTable[] { const data = adventureDefinitions(cycle); return [...data.hubs, ...data.tables]; }
export function adventureEntry(id: string) {
  for (const data of allAdventureDefinitions()) for (const table of adventureTables(data.cycle)) {
    const entry = table.entries.find(entry => entry.id === id);
    if (entry) return { cycle: data.cycle, table, entry };
  }
  return null;
}
