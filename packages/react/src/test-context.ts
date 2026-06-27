import type { HarnessChatContextValue } from './context-types.js';
import { lightTheme } from './theme/resolve-theme.js';

const TEST_CONTEXT_KEY = '__HARNESS_CHAT_TEST_CONTEXT__';

type GlobalWithHarnessTestContext = typeof globalThis & {
  [TEST_CONTEXT_KEY]?: HarnessChatContextValue;
};

export const defaultHarnessChatTestContext = (): HarnessChatContextValue => ({
  apiBase: '/api',
  credentials: 'include',
  fetchOptions: {},
  theme: lightTheme,
  auth: {
    user: null,
    ready: true,
  },
});

export const setHarnessChatTestContext = (value: HarnessChatContextValue) => {
  (globalThis as GlobalWithHarnessTestContext)[TEST_CONTEXT_KEY] = value;
};

export const clearHarnessChatTestContext = () => {
  delete (globalThis as GlobalWithHarnessTestContext)[TEST_CONTEXT_KEY];
};

export const getHarnessChatTestContext = (): HarnessChatContextValue | undefined =>
  (globalThis as GlobalWithHarnessTestContext)[TEST_CONTEXT_KEY];
