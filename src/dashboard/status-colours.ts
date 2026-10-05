export interface StatusColours { background: string; foreground: string; invert: boolean }
const darkInk = '#171715', white = '#FFFFFF';
export const CONDITION_COLOURS: StatusColours = { background: '#F2DB65', foreground: darkInk, invert: false };
export const AFFLICTION_COLOURS: StatusColours = { background: '#70429B', foreground: white, invert: true };
export function tokenColours(name: string): StatusColours {
  if (name === 'Bleeding') return { background: '#991E28', foreground: white, invert: true };
  if (name === 'Oxygen') return { background: '#152739', foreground: white, invert: true };
  if (name === 'Aether') return { background: '#FAFAF4', foreground: darkInk, invert: false };
  return { background: '#D6AD3A', foreground: darkInk, invert: false };
}
export function modifierColours(value: number): StatusColours {
  return { background: value < 0 ? '#A3423D' : '#416EAA', foreground: white, invert: true };
}
