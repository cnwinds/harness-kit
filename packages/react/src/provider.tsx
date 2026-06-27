import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { HarnessChatTheme, HarnessChatThemeInput, CssVariableMap } from './theme/types.js';
import type { ThemePreset } from './theme/presets.js';
import { resolveThemeWithInheritance, themeToCssProperties } from './theme/resolve-theme.js';
import { getHarnessChatTestContext } from './test-context.js';
import type { HarnessAuthState } from './auth-types.js';
import type { FileApiLike } from './file-api-types.js';
import type { HarnessChatContextValue } from './context-types.js';

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

  const value = useMemo(
    () => ({ apiBase, credentials, fetchOptions, theme: resolvedTheme, auth: resolvedAuth, filesApi }),
    [apiBase, credentials, fetchOptions, resolvedTheme, resolvedAuth, filesApi],
  );

  return (
    <HarnessChatContext.Provider value={value}>
      <div
        className={['hk-chat-root', className].filter(Boolean).join(' ')}
        style={{ ...cssVars, ...style } as CSSProperties}
      >
        {children}
      </div>
    </HarnessChatContext.Provider>
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
