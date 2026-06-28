import type { WebSearchProviderId } from './provider-types.js';
import { WEB_SEARCH_PROVIDER_IDS } from './provider-types.js';

export const parseWebSearchProviderId = (value: string): WebSearchProviderId | null => (
  WEB_SEARCH_PROVIDER_IDS.includes(value as WebSearchProviderId)
    ? value as WebSearchProviderId
    : null
);
