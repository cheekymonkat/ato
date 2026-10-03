import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { getCatalogue } from '../../catalogue';
import type { CardFace } from '../../domain/cards';
import { combatAdjustments } from '../../domain/combat-modifiers';
import type { CombatModifier, StatAdjustment } from '../../domain/combat-modifiers';
import type { Argonaut } from '../../domain/party';

const Context = createContext<Map<CardFace, Partial<Record<CombatModifier, StatAdjustment>>> | null>(null);
/** Scoped to assigned dashboard cards; library and selection previews retain printed values. */
export function CombatStats({ argonaut, children }: { argonaut: Argonaut; children: ReactNode }) {
  const value = useMemo(() => combatAdjustments(argonaut, getCatalogue()), [argonaut]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCombatAdjustment(face: CardFace, modifier: CombatModifier) { return useContext(Context)?.get(face)?.[modifier]; }
