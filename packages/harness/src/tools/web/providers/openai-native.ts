import type { HarnessConfig } from '@harnesskit/core';
import { isOpenAIResponsesRecord, streamOpenAIResponsesEvents } from '@harnesskit/core';
import { buildSearchQueries } from '../query-planner.js';
import { normalizeWhitespace } from '../html-utils.js';
import type { WebSearchToolInput, WebSearchToolResult } from '../search-types.js';

type NativeWebSearchAction = {
  type?: string;
  query?: string;
  queries?: string[];
  url?: string;
  pattern?: string;
};

const NATIVE_WEB_SEARCH_TIMEOUT_MS = 45_000;
const API_RETRY_LIMIT = 5;
const API_RETRY_DELAY_MS = 1_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const describeNativeWebSearchAction = (action: NativeWebSearchAction, index: number) => {
  if (action.type === 'search') {
    const queries = Array.isArray(action.queries) && action.queries.length > 0
      ? action.queries
      : action.query
        ? [action.query]
        : [];
    return `${index + 1}. Search\n${queries.map((query, queryIndex) => `  ${queryIndex + 1}. ${query}`).join('\n')}`;
  }

  if (action.type === 'open_page') {
    return `${index + 1}. OpenPage\n  URL: ${action.url ?? '未提供'}`;
  }

  if (action.type === 'find_in_page') {
    return `${index + 1}. FindInPage\n  Pattern: ${action.pattern ?? '未提供'}\n  URL: ${action.url ?? '未提供'}`;
  }

  return `${index + 1}. ${action.type ?? 'Other'}\n  详情: ${JSON.stringify(action, null, 2)}`;
};

export const executeOpenAINativeWebSearch = async (
  config: HarnessConfig,
  input: WebSearchToolInput,
): Promise<WebSearchToolResult> => {
  if (!config.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  const suggestedQueries = buildSearchQueries(input.query);
  const instructions = [
    '你是 HarnessKit 的联网搜索执行器。',
    '必须先调用 web_search，再给出中文结论。',
    '优先使用最新公开网页信息；如果问题涉及专业、院校、就业、薪资、政策、排名或分数线，优先权威与官方来源。',
    '不要说自己不能联网。',
    '最终输出格式：先给出简洁结论摘要，再列出来源链接，每行一个。',
    `原始问题：${input.query}`,
    suggestedQueries.length > 0
      ? `建议检索词（可按需组合、改写或扩展）：\n${suggestedQueries.map((query, index) => `${index + 1}. ${query}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n');

  for (let attempt = 0; attempt < API_RETRY_LIMIT; attempt += 1) {
    try {
      const searchActions: NativeWebSearchAction[] = [];
      let finalText = '';

      for await (const event of streamOpenAIResponsesEvents({
        apiKey: config.OPENAI_API_KEY,
        baseUrl: config.OPENAI_BASE_URL,
        timeoutMs: Math.max(config.LLM_REQUEST_TIMEOUT_MS, NATIVE_WEB_SEARCH_TIMEOUT_MS),
        body: {
          model: config.OPENAI_MODEL,
          instructions,
          input: [
            {
              role: 'user',
              content: input.query,
            },
          ],
          tool_choice: 'required',
          tools: [
            {
              type: 'web_search',
            },
          ],
          max_output_tokens: config.TOOL_MAX_OUTPUT_TOKENS,
          text: {
            format: {
              type: 'text',
            },
            verbosity: 'medium',
          },
        },
      })) {
        if (event.event === 'response.output_text.delta' && isOpenAIResponsesRecord(event.data) && typeof event.data.delta === 'string') {
          finalText += event.data.delta;
          continue;
        }

        if (event.event !== 'response.output_item.done' || !isOpenAIResponsesRecord(event.data)) {
          continue;
        }

        const item = isOpenAIResponsesRecord(event.data.item) ? event.data.item : null;
        if (!item || item.type !== 'web_search_call' || !isOpenAIResponsesRecord(item.action)) {
          continue;
        }

        searchActions.push({
          type: typeof item.action.type === 'string' ? item.action.type : undefined,
          query: typeof item.action.query === 'string' ? item.action.query : undefined,
          queries: Array.isArray(item.action.queries)
            ? item.action.queries.filter((query): query is string => typeof query === 'string')
            : undefined,
          url: typeof item.action.url === 'string' ? item.action.url : undefined,
          pattern: typeof item.action.pattern === 'string' ? item.action.pattern : undefined,
        });
      }

      const normalizedText = normalizeWhitespace(finalText);
      if (!normalizedText) {
        throw new Error('OpenAI 原生 web_search 未返回可用结果');
      }

      const actionSection = searchActions.length > 0
        ? searchActions.map((action, index) => describeNativeWebSearchAction(action, index)).join('\n')
        : 'provider 未暴露可见的搜索动作细节';

      return {
        tool: 'web_search',
        arguments: input,
        summary: `已通过 OpenAI 原生 web_search 完成联网检索${searchActions.length > 0 ? `（${searchActions.length} 个搜索动作）` : ''}`,
        content: [
          `原始问题：${input.query}`,
          '执行方式：OpenAI Responses API 原生 web_search',
          `模型：${config.OPENAI_MODEL}`,
          suggestedQueries.length > 0
            ? `建议检索词：\n${suggestedQueries.map((query, index) => `${index + 1}. ${query}`).join('\n')}`
            : '',
          `搜索动作：\n${actionSection}`,
          `联网搜索总结：\n${normalizedText}`,
        ].filter(Boolean).join('\n\n'),
        context: [
          '以下搜索信息仅供内部参考，用于组织结论；不要向用户原样复述，不要输出“引用资料”“工具结果”“上下文”等标签。',
          `原始问题：${input.query}`,
          `OpenAI 原生 web_search 动作：\n${actionSection}`,
          `联网搜索总结：\n${normalizedText}`,
        ].join('\n\n'),
      };
    } catch (error) {
      const shouldRetry = attempt < API_RETRY_LIMIT - 1;
      if (!shouldRetry) {
        throw error;
      }
      const retryDelayMs = config.NODE_ENV === 'test' ? 0 : API_RETRY_DELAY_MS * (attempt + 1);
      await wait(retryDelayMs);
    }
  }

  throw new Error('OpenAI 原生 web_search 未返回可用结果');
};
