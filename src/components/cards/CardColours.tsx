import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { grayscaleColour, grayscaleSvg } from '../../domain/card-colour';

const CardColoursContext = createContext(false);
const unchanged = (value: string) => value;
const ready = { inactive: false, colour: unchanged, svg: unchanged };
const exhausted = { inactive: true, colour: grayscaleColour, svg: grayscaleSvg };

export function CardColours({ exhausted, children }: { exhausted: boolean; children: ReactNode }) {
  return <CardColoursContext.Provider value={exhausted}>{children}</CardColoursContext.Provider>;
}
export function useCardColours() {
  return useContext(CardColoursContext) ? exhausted : ready;
}
