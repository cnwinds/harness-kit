import { createContext, useContext, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { HarnessChatTheme, HarnessChatThemeInput, CssVariableMap } from './theme/types.js';
import type { ThemePreset } from './theme/presets.js';
import { resolveThemeWithInheritance, themeToCssProperties } from './theme/resolve-theme.js';
import { getHarnessChatTestContext } from './test-context.js';
import type { HarnessAuthState } from './auth-types.js';
import type { FileApiLike } from './file-api-types.js';
import type { HarnessChatContextValue } from './context-types.js';
import { createHarnessFilesApi } from './lib/create-files-api.js';

export type { HarnessAuthState };
export type { HarnessChatContextValue };
export type { FileApiLike } from './file-api-types.js';

export type HarnessChatProviderProps = {
  children: ReactNode;
  /** API base path, e.g. '/api/chat' or '/api' */
  apiBase?: string;
  credentials?: RequestCredentials;
  fetchOptions?: RequestInit;
  /** Auth state — host app provides (e.g. SkillChat auth store) */
  auth?: HarnessAuthState;
  /** File preview/download API — required for image attachments in MessageItem */
  filesApi?: FileApiLike;
  /** Built-in light/dark preset */
  preset?: ThemePreset;
  /** Partial theme overrides on top of preset */
  theme?: HarnessChatThemeInput;
  /** Inherit colors from host app CSS variables (e.g. SkillChat --background) */
  inheritCssVariables?: boolean | CssVariableMap;
  className?: string;
  style?: CSSProperties;
};

const HarnessChatContext = createContext<HarnessChatContextValue | null>(null);

export const HarnessChatProvider = ({
  children,
  apiBase = '/api/chat',
  credentials = 'include',
  fetchOptions = {},
  preset,
  theme,
  inheritCssVariables,
  auth,
  filesApi,
  className,
  style,
}: HarnessChatProviderProps) => {
  const resolvedTheme = useMemo(
    () => resolveThemeWithInheritance({ preset, theme, inheritCssVariables }),
    [preset, theme, inheritCssVariables],
  );

  const cssVars = useMemo(() => themeToCssProperties(resolvedTheme), [resolvedTheme]);

  const resolvedAuth = useMemo<HarnessAuthState>(
    () => auth ?? { user: { id: 'anonymous', username: 'anonymous' }, ready: true },
    [auth],
  );

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  const resolvedFilesApi = useMemo(
    () => filesApi ?? createHarnessFilesApi({ apiBase, credentials, fetchOptions }),
    [apiBase, credentials, fetchOptions, filesApi],
  );

  const value = useMemo(
    () => ({
      apiBase,
      credentials,
      fetchOptions,
      theme: resolvedTheme,
      auth: resolvedAuth,
      filesApi: resolvedFilesApi,
    }),
    [apiBase, credentials, fetchOptions, resolvedTheme, resolvedAuth, resolvedFilesApi],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <HarnessChatContext.Provider value={value}>
        <div
          className={['hk-chat-root', className].filter(Boolean).join(' ')}
          style={{ ...cssVars, ...style } as CSSProperties}
        >
          {children}
        </div>
      </HarnessChatContext.Provider>
    </QueryClientProvider>
  );
};

export const useHarnessChatContext = (): HarnessChatContextValue => {
  const ctx = useContext(HarnessChatContext);
  if (ctx) {
    return ctx;
  }

  const testContext = getHarnessChatTestContext();
  if (testContext) {
    return testContext;
  }

  throw new Error('useHarnessChatContext must be used within HarnessChatProvider');
};

export const useHarnessTheme = (): HarnessChatTheme => useHarnessChatContext().theme;
