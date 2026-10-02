import { createContext, useContext, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { getCatalogue } from '../catalogue';
import { createParty } from '../domain/party';
import type { Party } from '../domain/party';
import { partyReducer } from './party-reducer';
import type { PartyAction } from './party-reducer';

const PartyContext = createContext<{ party: Party; dispatch: Dispatch<PartyAction> } | null>(null);

export function PartyProvider({ children }: { children: ReactNode }) {
  const [party, dispatch] = useReducer((party: Party, action: PartyAction) => partyReducer(party, action, getCatalogue()), undefined, () => createParty('party-local', ['arg-1', 'arg-2', 'arg-3', 'arg-4'], getCatalogue().version));
  const value = useMemo(() => ({ party, dispatch }), [party]);
  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>;
}

export function useParty() {
  const context = useContext(PartyContext);
  if (!context) throw new Error('PartyProvider is missing');
  return context;
}
