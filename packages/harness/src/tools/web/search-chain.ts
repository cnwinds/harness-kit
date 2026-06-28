import type { HarnessConfig, ProviderPrefsStore, WebSearchProviderId } from '@harnesskit/core';
import { buildWebSearchProviderChain } from '../../provider-capabilities.js';
import { executeOpenAINativeWebSearch } from './providers/openai-native.js';
import { getWebSearchProviderLabel, createConfiguredSearchProvider } from './search-provider.js';
import { runConfiguredWebSearch } from './search-orchestrator.js';
import type { FetchPageText, WebSearchToolInput, WebSearchToolResult } from './search-types.js';

const formatProviderError = (providerId: WebSearchProviderId, error: unknown) => {
  const label = getWebSearchProviderLabel(providerId);
  const message = error instanceof Error ? error.message : String(error);
  return `[${label}] ${message}`;
};

const buildSearchFailureResult = (
  input: WebSearchToolInput,
  chain: WebSearchProviderId[],
  errors: string[],
): WebSearchToolResult => ({
  tool: 'web_search',
  arguments: input,
  isError: true,
  summary: '搜索失败：所有已配置的搜索服务均不可用',
  content: [
    `原始问题：${input.query}`,
    `已尝试：${chain.map((id) => getWebSearchProviderLabel(id)).join(' → ')}`,
    `失败详情：\n${errors.map((error, index) => `${index + 1}. ${error}`).join('\n')}`,
    '请向用户说明暂时无法联网检索，并基于已有知识回答或建议稍后重试；不要编造最新事实或链接。',
  ].join('\n\n'),
  context: [
    '搜索工具执行失败。不要向用户原样复述本段技术错误。',
    `原始问题：${input.query}`,
    `失败详情：${errors.join('；')}`,
    '请用自然语言向用户说明联网搜索暂时不可用。',
  ].join('\n\n'),
});

export const runWebSearchProviderChain = async (args: {
  config: HarnessConfig;
  prefsStore: ProviderPrefsStore;
  input: WebSearchToolInput;
  fetchPageText: FetchPageText;
}): Promise<WebSearchToolResult> => {
  const preferredId = await args.prefsStore.getPreferredWebSearchProvider();
  const chain = buildWebSearchProviderChain(args.config, preferredId);

  if (chain.length === 0) {
    throw new Error('当前未配置任何可用的搜索 provider');
  }

  const errors: string[] = [];

  for (const providerId of chain) {
    try {
      const result = providerId === 'openai_native'
        ? await executeOpenAINativeWebSearch(args.config, args.input)
        : await runConfiguredWebSearch({
          config: args.config,
          input: args.input,
          fetchPageText: args.fetchPageText,
          provider: createConfiguredSearchProvider(providerId, args.config, args.fetchPageText),
        });

      await args.prefsStore.setPreferredWebSearchProvider(providerId);
      return result;
    } catch (error) {
      errors.push(formatProviderError(providerId, error));
    }
  }

  return buildSearchFailureResult(args.input, chain, errors);
};
