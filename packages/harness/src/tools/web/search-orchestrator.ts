import type { HarnessConfig } from '@harnesskit/core';
import { buildSearchQueries } from './query-planner.js';
import {
  canonicalizeUrl,
  extractHtmlExcerpt,
  normalizeWhitespace,
  truncate,
} from './html-utils.js';
import type {
  FetchPageText,
  SearchMatch,
  SearchPageAnalysis,
  SearchProvider,
  WebSearchToolInput,
  WebSearchToolResult,
} from './search-types.js';

const SEARCH_QUERY_LIMIT = 4;
const SEARCH_RESULT_LIMIT = 8;
const SEARCH_FETCH_LIMIT = 4;
const SEARCH_PAGE_EXCERPT_CHARS = 1_600;
const MODEL_CONTEXT_EXCERPT_CHARS = 900;

const fetchSearchResultPage = async (
  fetchPageText: FetchPageText,
  result: SearchMatch,
  maxChars: number,
): Promise<SearchPageAnalysis> => {
  try {
    const response = await fetchPageText(result.url, '抓取搜索结果页');
    const excerpt = response.contentType.includes('text/html')
      ? extractHtmlExcerpt(response.body, maxChars)
      : truncate(normalizeWhitespace(response.body), maxChars);

    return {
      ...result,
      finalUrl: response.finalUrl || result.url,
      excerpt,
    };
  } catch (error) {
    return {
      ...result,
      fetchError: error instanceof Error ? error.message : '抓取搜索结果页失败',
    };
  }
};

export const runConfiguredWebSearch = async (args: {
  config: HarnessConfig;
  input: WebSearchToolInput;
  fetchPageText: FetchPageText;
  provider: SearchProvider;
}): Promise<WebSearchToolResult> => {
  const provider = args.provider;
  const searchQueries = buildSearchQueries(args.input.query, SEARCH_QUERY_LIMIT);
  const searchBatches = await Promise.all(
    searchQueries.map(async (query) => {
      const batch = await provider.search(query, args.input.maxResults);
      return {
        query,
        results: batch.results.map<SearchMatch>((result) => ({
          ...result,
          query,
          provider: provider.displayName,
        })),
        attempts: batch.attempts,
      };
    }),
  );
  const attempts = searchBatches.flatMap((batch) => batch.attempts);

  const dedupedResults: SearchMatch[] = [];
  const seenUrls = new Set<string>();
  for (const result of searchBatches.flatMap((batch) => batch.results)) {
    const key = canonicalizeUrl(result.url);
    if (seenUrls.has(key)) {
      continue;
    }
    seenUrls.add(key);
    dedupedResults.push(result);
    if (dedupedResults.length >= Math.min(SEARCH_RESULT_LIMIT, args.input.maxResults + 3)) {
      break;
    }
  }

  if (dedupedResults.length === 0) {
    const detail = attempts.length > 0 ? attempts.join('；') : `${provider.displayName} 未返回任何结果`;
    throw new Error(`网页搜索失败（${provider.displayName}）：${detail}`);
  }

  const pageCandidates = dedupedResults.slice(0, Math.min(SEARCH_FETCH_LIMIT, dedupedResults.length));
  const pageAnalyses = await Promise.all(
    pageCandidates.map((result) => fetchSearchResultPage(args.fetchPageText, result, SEARCH_PAGE_EXCERPT_CHARS)),
  );
  const pageAnalysisMap = new Map<string, SearchPageAnalysis>();
  for (const analysis of pageAnalyses) {
    pageAnalysisMap.set(canonicalizeUrl(analysis.url), analysis);
    if (analysis.finalUrl) {
      pageAnalysisMap.set(canonicalizeUrl(analysis.finalUrl), analysis);
    }
  }

  const resultSections = dedupedResults.map((result, index) => {
    const analysis = pageAnalysisMap.get(canonicalizeUrl(result.url));
    return [
      `${index + 1}. ${result.title}`,
      `命中查询: ${result.query}`,
      `搜索引擎: ${result.provider}`,
      `URL: ${result.url}`,
      result.snippet ? `搜索摘要: ${result.snippet}` : '',
      analysis?.finalUrl && analysis.finalUrl !== result.url ? `最终地址: ${analysis.finalUrl}` : '',
      analysis?.excerpt ? `结果页分析:\n${analysis.excerpt}` : '',
      analysis?.fetchError ? `结果页抓取失败: ${analysis.fetchError}` : '',
    ].filter(Boolean).join('\n');
  });

  const modelContextSections = dedupedResults
    .slice(0, Math.min(SEARCH_FETCH_LIMIT, dedupedResults.length))
    .map((result) => {
      const analysis = pageAnalysisMap.get(canonicalizeUrl(result.url));
      return [
        `${result.title}`,
        `命中查询: ${result.query}`,
        `链接: ${analysis?.finalUrl || result.url}`,
        result.snippet ? `搜索摘要: ${truncate(result.snippet, 220)}` : '',
        analysis?.excerpt ? `页面关键信息: ${truncate(analysis.excerpt, MODEL_CONTEXT_EXCERPT_CHARS)}` : '',
      ].filter(Boolean).join('\n');
    });

  const successFetchCount = pageAnalyses.filter((analysis) => Boolean(analysis.excerpt)).length;
  const content = [
    `原始问题：${args.input.query}`,
    `搜索 Provider：${provider.displayName}`,
    `搜索关键词组合：\n${searchQueries.map((query, index) => `${index + 1}. ${query}`).join('\n')}`,
    `分查询命中情况：\n${searchBatches.map((batch, index) => `${index + 1}. ${batch.query} -> ${batch.results.length} 条`).join('\n')}`,
    `搜索命中结果（去重后 ${dedupedResults.length} 条）：`,
    ...resultSections,
    attempts.length > 0 ? `搜索备注：\n${attempts.map((item) => `- ${item}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  return {
    tool: 'web_search',
    arguments: args.input,
    summary: `已通过 ${provider.displayName} 检索到 ${dedupedResults.length} 条去重结果，已抓取 ${successFetchCount} 个结果页`,
    content,
    context: [
      '以下搜索信息仅供内部参考，用于组织结论；不要向用户原样复述，不要输出“引用资料”“工具结果”“上下文”等标签。',
      `原始问题：${args.input.query}`,
      `搜索 Provider：${provider.displayName}`,
      `使用的查询组合：${searchQueries.join('；')}`,
      ...modelContextSections,
    ].join('\n\n'),
  };
};
