import type { SearchHit, SearchProvider, SearchProviderResult } from '../search-types.js';

const parseSerperResponse = (payload: unknown, maxResults: number): SearchHit[] => {
  if (typeof payload !== 'object' || payload === null || !('organic' in payload)) {
    return [];
  }

  const organic = (payload as { organic?: unknown }).organic;
  if (!Array.isArray(organic)) {
    return [];
  }

  return organic.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }
    const record = item as { title?: unknown; link?: unknown; snippet?: unknown };
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const url = typeof record.link === 'string' ? record.link.trim() : '';
    const snippet = typeof record.snippet === 'string' ? record.snippet.trim() : '';
    if (!title || !url || !/^https?:\/\//i.test(url)) {
      return [];
    }
    return [{ title, url, snippet }];
  }).slice(0, maxResults);
};

export const createSerperSearchProvider = (apiKey: string): SearchProvider => ({
  id: 'serper',
  displayName: 'Serper',
  async search(query, maxResults): Promise<SearchProviderResult> {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Serper 搜索失败：HTTP ${response.status} ${bodyText.slice(0, 200)}`.trim());
    }

    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      throw new Error('Serper 搜索失败：响应不是合法 JSON');
    }

    const results = parseSerperResponse(payload, maxResults);
    if (results.length === 0) {
      throw new Error(`Serper 搜索未返回可用结果（查询：${query}）`);
    }

    return { query, results, attempts: [] };
  },
});
