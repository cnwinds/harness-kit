import type { HarnessConfig, ImageProviderId, WebSearchProviderId } from '@harnesskit/core';
import {
  parseProviderListFromEnv,
  resolveNativeToolsPolicy,
} from '@harnesskit/core';
import { IMAGE_PROVIDER_IDS, WEB_SEARCH_PROVIDER_IDS } from '@harnesskit/core';

export const supportsOpenAINativeResponsesTools = (baseUrl: string) => {
  const normalized = baseUrl.replace(/\/+$/, '');
  return /^https:\/\/api\.openai\.com(?:\/|$)/i.test(normalized);
};

export type ProviderCapabilities = {
  isOfficialOpenAI: boolean;
  nativeWebSearchEnabled: boolean;
  nativeImageGenerationEnabled: boolean;
  activeWebSearchProviderIds: WebSearchProviderId[];
  activeImageProviderIds: ImageProviderId[];
  webSearchToolAvailable: boolean;
  imageFunctionToolAvailable: boolean;
  nativeImageToolAvailable: boolean;
};

const DEFAULT_WEB_SEARCH_ORDER: WebSearchProviderId[] = ['openai_native', 'tavily', 'serper', 'brave'];
const DEFAULT_IMAGE_ORDER: ImageProviderId[] = ['openai_images', 'zhipu', 'bailian'];

const isWebSearchProviderId = (value: string): value is WebSearchProviderId => (
  WEB_SEARCH_PROVIDER_IDS.includes(value as WebSearchProviderId)
);

const isImageProviderId = (value: string): value is ImageProviderId => (
  IMAGE_PROVIDER_IDS.includes(value as ImageProviderId)
);

export const resolveActiveWebSearchProviderIds = (config: HarnessConfig): WebSearchProviderId[] => {
  const active: WebSearchProviderId[] = [];

  if (resolveNativeToolsPolicy(config.OPENAI_NATIVE_WEB_SEARCH, config.OPENAI_BASE_URL)) {
    active.push('openai_native');
  }
  if (config.TAVILY_API_KEY?.trim()) {
    active.push('tavily');
  }
  if (config.SERPER_API_KEY?.trim()) {
    active.push('serper');
  }
  if (config.BRAVE_SEARCH_API_KEY?.trim()) {
    active.push('brave');
  }

  return active;
};

export const resolveDashScopeImageApiKey = (config: HarnessConfig) => (
  config.DASHSCOPE_IMAGE_API_KEY?.trim() || undefined
);

export const resolveActiveImageProviderIds = (config: HarnessConfig): ImageProviderId[] => {
  const active: ImageProviderId[] = [];

  if (config.OPENAI_IMAGE_API_KEY?.trim() && (config.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2')) {
    active.push('openai_images');
  }
  if (config.ZHIPU_IMAGE_API_KEY?.trim() && (config.ZHIPU_IMAGE_MODEL?.trim() || 'glm-image')) {
    active.push('zhipu');
  }
  const dashScopeKey = resolveDashScopeImageApiKey(config);
  if (dashScopeKey && config.DASHSCOPE_IMAGE_MODEL?.trim()) {
    active.push('bailian');
  }

  return active;
};

export const buildOrderedProviderChain = <T extends string>(args: {
  configuredOrder?: string[];
  defaultOrder: readonly T[];
  activeIds: readonly T[];
  preferredId: T | null;
  isKnownId: (value: string) => value is T;
}): T[] => {
  const active = new Set(args.activeIds);
  const sourceOrder = (args.configuredOrder ?? [...args.defaultOrder])
    .filter(args.isKnownId)
    .filter((id) => active.has(id));

  for (const id of args.activeIds) {
    if (!sourceOrder.includes(id)) {
      sourceOrder.push(id);
    }
  }

  if (args.preferredId && sourceOrder.includes(args.preferredId)) {
    return [args.preferredId, ...sourceOrder.filter((id) => id !== args.preferredId)];
  }

  return sourceOrder;
};

export const buildWebSearchProviderChain = (
  config: HarnessConfig,
  preferredId: WebSearchProviderId | null,
) => buildOrderedProviderChain({
  configuredOrder: parseProviderListFromEnv(config.WEB_SEARCH_PROVIDERS),
  defaultOrder: DEFAULT_WEB_SEARCH_ORDER,
  activeIds: resolveActiveWebSearchProviderIds(config),
  preferredId,
  isKnownId: isWebSearchProviderId,
});

export const buildImageProviderChain = (
  config: HarnessConfig,
  preferredId: ImageProviderId | null,
) => buildOrderedProviderChain({
  configuredOrder: parseProviderListFromEnv(config.IMAGE_PROVIDERS),
  defaultOrder: DEFAULT_IMAGE_ORDER,
  activeIds: resolveActiveImageProviderIds(config),
  preferredId,
  isKnownId: isImageProviderId,
});

export const resolveProviderCapabilities = (config: HarnessConfig): ProviderCapabilities => {
  const isOfficialOpenAI = supportsOpenAINativeResponsesTools(config.OPENAI_BASE_URL);
  const nativeWebSearchEnabled = resolveNativeToolsPolicy(config.OPENAI_NATIVE_WEB_SEARCH, config.OPENAI_BASE_URL);
  const nativeImageGenerationEnabled = resolveNativeToolsPolicy(
    config.OPENAI_NATIVE_IMAGE_GENERATION,
    config.OPENAI_BASE_URL,
  );
  const activeWebSearchProviderIds = resolveActiveWebSearchProviderIds(config);
  const activeImageProviderIds = resolveActiveImageProviderIds(config);
  const webSearchToolAvailable = config.WEB_SEARCH_MODE !== 'disabled' && activeWebSearchProviderIds.length > 0;
  const imageFunctionToolAvailable = activeImageProviderIds.length > 0;
  const nativeImageToolAvailable = nativeImageGenerationEnabled;

  return {
    isOfficialOpenAI,
    nativeWebSearchEnabled,
    nativeImageGenerationEnabled,
    activeWebSearchProviderIds,
    activeImageProviderIds,
    webSearchToolAvailable,
    imageFunctionToolAvailable,
    nativeImageToolAvailable,
  };
};

/** @deprecated Use resolveNativeToolsPolicy from @harnesskit/core */
export const resolveApiWebSearchMode = (
  baseUrl: string,
  configured: 'disabled' | 'cached' | 'live',
) => (
  supportsOpenAINativeResponsesTools(baseUrl) ? configured : 'disabled'
);
