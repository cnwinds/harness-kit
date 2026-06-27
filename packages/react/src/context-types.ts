import type { HarnessChatTheme } from './theme/types.js';
import type { HarnessAuthState } from './auth-types.js';
import type { FileApiLike } from './file-api-types.js';

export type HarnessChatContextValue = {
  apiBase: string;
  credentials: RequestCredentials;
  fetchOptions: RequestInit;
  theme: HarnessChatTheme;
  auth: HarnessAuthState;
  filesApi?: FileApiLike;
};
