import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type HarnessChatProviderProps = {
  children: ReactNode;
  /** API base path, e.g. '/api/chat' */
  apiBase?: string;
  credentials?: RequestCredentials;
  fetchOptions?: RequestInit;
};

export type HarnessChatContextValue = {
  apiBase: string;
  credentials: RequestCredentials;
  fetchOptions: RequestInit;
};

const HarnessChatContext = createContext<HarnessChatContextValue | null>(null);

export const HarnessChatProvider = ({
  children,
  apiBase = '/api/chat',
  credentials = 'include',
  fetchOptions = {},
}: HarnessChatProviderProps) => {
  const value = useMemo(
    () => ({ apiBase, credentials, fetchOptions }),
    [apiBase, credentials, fetchOptions],
  );
  return <HarnessChatContext.Provider value={value}>{children}</HarnessChatContext.Provider>;
};

export const useHarnessChatContext = (): HarnessChatContextValue => {
  const ctx = useContext(HarnessChatContext);
  if (!ctx) {
    throw new Error('useHarnessChatContext must be used within HarnessChatProvider');
  }
  return ctx;
};
