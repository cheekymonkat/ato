import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { checkGate, gateValues } from '../../domain/rules-assistance';
import type { GateValues } from '../../domain/rules-assistance';
import type { DisplayGate } from '../../domain/card-presentation';
import type { Argonaut } from '../../domain/party';
import { getCatalogue } from '../../catalogue';

const Context = createContext<GateValues | null>(null);
/** Scoped to the card owner; catalogue previews never inherit another Argonaut’s counters. */
export function GateAssistance({ enabled, argonaut, children }: { enabled: boolean; argonaut: Argonaut; children: ReactNode }) {
  const values = useMemo(() => enabled ? gateValues(argonaut, getCatalogue()) : null, [enabled, argonaut]);
  return <Context.Provider value={values}>{children}</Context.Provider>;
}
export function useGateCheck(gate: DisplayGate) {
  const values = useContext(Context);
  return values ? checkGate(gate, values) : null;
}
