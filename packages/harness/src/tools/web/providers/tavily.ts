import type { SearchHit, SearchProvider, SearchProviderResult } from '../search-types.js';

const parseTavilyResponse = (payload: unknown, maxResults: number): SearchHit[] => {
  if (typeof payload !== 'object' || payload === null || !('results' in payload)) {
    return [];
  }

  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    return [];
  }

  return results.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }
    const record = item as { title?: unknown; url?: unknown; content?: unknown };
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    const snippet = typeof record.content === 'string' ? record.content.trim() : '';
    if (!title || !url || !/^https?:\/\//i.test(url)) {
      return [];
    }
    return [{ title, url, snippet }];
  }).slice(0, maxResults);
};

export const createTavilySearchProvider = (apiKey: string): SearchProvider => ({
  id: 'tavily',
  displayName: 'Tavily',
  async search(query, maxResults): Promise<SearchProviderResult> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Tavily 搜索失败：HTTP ${response.status} ${bodyText.slice(0, 200)}`.trim());
    }

    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      throw new Error('Tavily 搜索失败：响应不是合法 JSON');
    }

    const results = parseTavilyResponse(payload, maxResults);
    if (results.length === 0) {
      throw new Error(`Tavily 搜索未返回可用结果（查询：${query}）`);
    }

    return { query, results, attempts: [] };
  },
});
