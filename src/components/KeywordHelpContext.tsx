import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

const KeywordHelpContext = createContext<{ keyword: string | null; open: (name: string) => void; dismiss: () => void } | null>(null);

/** Each existing modal has its own host, avoiding a second native modal. */
export function KeywordHelpProvider({ children }: { children: ReactNode }) {
  const [keyword, setKeyword] = useState<string | null>(null);
  return <KeywordHelpContext.Provider value={{ keyword, open: setKeyword, dismiss: () => setKeyword(null) }}>{children}</KeywordHelpContext.Provider>;
}
export function useKeywordHelp() { return useContext(KeywordHelpContext); }
