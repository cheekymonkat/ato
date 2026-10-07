import type { CampaignCycle } from './campaign.ts';

export interface PrimordialTrack {
  printedId: string; name: string;
  /** Traits disabled while another printed trait is active. These are derived, not saved overrides. */
  traitDisables?: Readonly<Record<string, readonly string[]>>;
}
export interface EvolutionNode { id: string; row: number; lane: 'left' | 'shared' | 'right'; level: number }
export interface EvolutionRules {
  regular: readonly [PrimordialTrack, PrimordialTrack];
  nodes: readonly EvolutionNode[];
  boss: PrimordialTrack;
  adversaries: readonly PrimordialTrack[];
  defaultAdversary: string | null;
}
const hekaton = { printedId: 'AU0447', name: 'Hekaton' };
const hermesian = { printedId: 'AU0622', name: 'Hermesian Pursuer', traitDisables: { Toying: ['End of Hope'] } };
const burden = { printedId: 'BU1149', name: 'The Burden' };
const dahaka = { printedId: 'DU2514', name: 'Dahaka' };
const titanX = { printedId: 'EU3144', name: 'Titan X' };
/** Each shared diamond is one physical box, used by both regular Primordial paths. */
function nodes(rows: readonly (readonly [number, 'both' | 'shared' | 'left'])[]): EvolutionNode[] {
  return rows.flatMap(([level, layout], row) => (layout === 'both' ? ['left', 'right'] as const : [layout] as const)
    .map(lane => ({ id: `${row}-${lane}`, row, lane, level })));
}
const standard = [[1, 'both'], [1, 'shared'], [2, 'both'], [2, 'shared'], [3, 'shared'], [3, 'both'], [4, 'both'], [4, 'both'], [4, 'shared']] as const;
/** Audited against the supplied screenshots and publisher's printable Argo sheets. See docs/EVOLUTION.md. */
export const EVOLUTION_RULES: Readonly<Record<CampaignCycle, EvolutionRules>> = {
  1: { regular: [hekaton, { printedId: 'AU0448', name: 'Labyrinthauros' }], nodes: nodes([[0, 'left'], ...standard]),
    boss: { printedId: 'AU0563', name: 'Alpha Temenos' }, adversaries: [hermesian], defaultAdversary: hermesian.printedId },
  2: { regular: [{ printedId: 'BU0724', name: 'Cyclonus' }, { printedId: 'BU0780', name: 'Chimera Metastasios' }], nodes: nodes(standard),
    boss: { printedId: 'BU1051', name: 'The Nietzschean' }, adversaries: [hermesian, burden], defaultAdversary: null },
  3: { regular: [{ printedId: 'CU1384', name: 'Hypertime Oracle' }, { printedId: 'CU1678', name: 'Icarian Harpy' }],
    nodes: nodes([...standard.slice(0, 8), [4, 'both'], [5, 'shared']]),
    boss: { printedId: 'CU1792', name: 'Sun Descendant' }, adversaries: [hermesian, burden], defaultAdversary: null },
  4: { regular: [{ printedId: 'DU2394', name: 'Midascore' }, { printedId: 'DU2434', name: 'Demidjinn' }],
    nodes: nodes([...standard, [5, 'both'], [5, 'shared'], [5, 'both'], [5, 'shared'], [6, 'shared'], [6, 'shared']]),
    boss: { printedId: 'DU2475', name: 'Babelian Lunacy' }, adversaries: [dahaka], defaultAdversary: dahaka.printedId },
  5: { regular: [{ printedId: 'EU3022', name: 'Dragon of Phobos' }, { printedId: 'EU3061', name: 'Meduketos' }], nodes: nodes(standard),
    boss: { printedId: 'EU3100', name: 'Ur-Fleece' }, adversaries: [titanX], defaultAdversary: titanX.printedId },
};
export function primordialPath(rules: EvolutionRules, printedId: string): readonly EvolutionNode[] {
  const lane = rules.regular[0].printedId === printedId ? 'left' : rules.regular[1].printedId === printedId ? 'right' : null;
  return lane ? rules.nodes.filter(node => node.lane === lane || node.lane === 'shared') : [];
}
export function evolutionPredecessors(rules: EvolutionRules, nodeId: string): readonly EvolutionNode[] {
  return rules.regular.flatMap(track => {
    const path = primordialPath(rules, track.printedId), index = path.findIndex(node => node.id === nodeId);
    return index > 0 ? [path[index - 1]] : [];
  });
}
/** A shared box needs either incoming branch, not both. */
export function connectedEvolutionMarks(rules: EvolutionRules, marked: readonly string[]): string[] {
  const connected = new Set<string>();
  for (const node of rules.nodes) {
    const previous = evolutionPredecessors(rules, node.id);
    if (marked.includes(node.id) && (!previous.length || previous.some(parent => connected.has(parent.id)))) connected.add(node.id);
  }
  return [...connected];
}
export function canMarkEvolutionNode(rules: EvolutionRules, marked: readonly string[], nodeId: string): boolean {
  if (!rules.nodes.some(node => node.id === nodeId) || marked.includes(nodeId)) return false;
  const previous = evolutionPredecessors(rules, nodeId), connected = connectedEvolutionMarks(rules, marked);
  return !previous.length || previous.some(parent => connected.includes(parent.id));
}
export function campaignPrimordialMaximum(rules: EvolutionRules, printedId: string): number {
  const path = primordialPath(rules, printedId);
  return path.length ? Math.max(...path.map(node => node.level)) : 1;
}
export function levelNumeral(level: number): string { return ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][level] ?? String(level); }
