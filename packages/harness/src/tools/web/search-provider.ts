import type { HarnessConfig } from '@harnesskit/core';
import type { FetchPageText, SearchProvider, WebSearchProviderId } from './search-types.js';
import { createBraveSearchProvider } from './providers/brave.js';
import { createSerperSearchProvider } from './providers/serper.js';
import { createTavilySearchProvider } from './providers/tavily.js';

export const getWebSearchProviderLabel = (providerId: WebSearchProviderId) => {
  switch (providerId) {
    case 'openai_native':
      return 'OpenAI Native';
    case 'tavily':
      return 'Tavily';
    case 'serper':
      return 'Serper';
    case 'brave':
      return 'Brave Search';
    default:
      return providerId;
  }
};

export const createConfiguredSearchProvider = (
  providerId: WebSearchProviderId,
  config: HarnessConfig,
  _fetchPageText: FetchPageText,
): SearchProvider => {
  switch (providerId) {
    case 'tavily': {
      const apiKey = config.TAVILY_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('Tavily 搜索未配置 TAVILY_API_KEY');
      }
      return createTavilySearchProvider(apiKey);
    }
    case 'serper': {
      const apiKey = config.SERPER_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('Serper 搜索未配置 SERPER_API_KEY');
      }
      return createSerperSearchProvider(apiKey);
    }
    case 'brave': {
      const apiKey = config.BRAVE_SEARCH_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('Brave 搜索未配置 BRAVE_SEARCH_API_KEY');
      }
      return createBraveSearchProvider(apiKey);
    }
    case 'openai_native':
      throw new Error('openai_native 由专用执行器处理');
    default:
      throw new Error(`未支持的搜索 provider：${String(providerId)}`);
  }
};
