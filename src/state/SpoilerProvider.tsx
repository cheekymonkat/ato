import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CardDefinition } from '../domain/cards';
import { isSecretCard } from '../domain/card-presentation';

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
