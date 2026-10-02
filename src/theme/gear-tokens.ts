export const gearTheme = { width: 270, height: 414, papyrus: '#DFDBCD', papyrusDark: '#CAC7B9', stat: '#BFBCAB', reference: '#C7683F', accent: '#44A0A1' } as const;
const cycles: Record<string, string> = { Tutorial: '#270F03', 'Cycle I': '#270F03', 'Cycle II': '#4D120B', 'Cycle III': '#271A2B', 'Cycle IV': '#131004', 'Cycle V': '#19232F', 'Mnestis Theatre': '#A07800', Mnestis: '#A07800', Adversary: '#FFFFFF' };
const gates: Record<string, string> = { hits: '#9B2315', 'full hit': '#9B2315', danger: '#9B2315', energy: '#9B2315', fate: '#557DBD', paradox: '#557DBD', rage: '#040404', bleeding: '#040404', ambrosia: '#5D0D69', labyrinth: '#7D4921', despair: '#07302F', midas: '#D4AE43', pain: '#707070', aether: '#071530', death: '#000000' };
export const cycleColour = (cycle: string) => cycles[cycle] || '#FFFFFF';
export const gateColour = (gate: string) => gates[gate.toLowerCase()] || '#C09513';
