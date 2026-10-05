import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CardDefinition } from '../domain/cards';
import { isSecretCard } from '../domain/card-presentation';
import type { Argonaut } from '../domain/party';
import { conditionRecords } from '../domain/conditions';

interface Spoilers { hideSecrets: boolean; toggle: () => void; hidden: (card: CardDefinition) => boolean; reveal: (id: string) => void; conceal: (id: string) => void }
const Context = createContext<Spoilers | null>(null);
export function SpoilerProvider({ children }: { children: ReactNode }) {
  const [hideSecrets, setHideSecrets] = useState(true), [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const value = useMemo(() => ({ hideSecrets, toggle: () => { setHideSecrets(value => !value); setRevealed(new Set()); },
    hidden: (card: CardDefinition) => hideSecrets && isSecretCard(card) && !revealed.has(card.id),
    reveal: (id: string) => setRevealed(previous => new Set([...previous, id])),
    conceal: (id: string) => setRevealed(previous => { const next = new Set(previous); next.delete(id); return next; }),
  }), [hideSecrets, revealed]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSpoilers() { const value = useContext(Context); if (!value) throw new Error('SpoilerProvider is missing'); return value; }

/** Owned cards are always readable on the main page without revealing unassigned library cards. */
export function AssignedCardVisibility({ argonaut, children }: { argonaut: Argonaut; children: ReactNode }) {
  const parent = useSpoilers();
  const value = useMemo(() => {
    const assigned = new Set([...argonaut.instances.map(instance => instance.definitionId),
      ...(argonaut.titan ? [argonaut.titan.definitionId] : []),
      ...conditionRecords(argonaut).flatMap(condition => condition.reference ? [condition.reference.definitionId] : []),
      ...Object.values(argonaut.tableOverrides).flatMap(reference => reference ? [reference.definitionId] : [])]);
    return { ...parent, hidden: (card: CardDefinition) => !assigned.has(card.id) && parent.hidden(card) };
  }, [argonaut, parent]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Campaign-owned cards stay readable without revealing other catalogue entries. */
export function CampaignCardVisibility({ definitionIds, children }: { definitionIds: string[]; children: ReactNode }) {
  const parent = useSpoilers();
  const value = useMemo(() => {
    const known = new Set(definitionIds);
    return { ...parent, hidden: (card: CardDefinition) => !known.has(card.id) && parent.hidden(card) };
  }, [definitionIds, parent]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
