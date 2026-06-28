import type { SearchHit, SearchProvider, SearchProviderResult } from '../search-types.js';

const parseBraveResponse = (payload: unknown, maxResults: number): SearchHit[] => {
  if (typeof payload !== 'object' || payload === null || !('web' in payload)) {
    return [];
  }

  const web = (payload as { web?: unknown }).web;
  if (typeof web !== 'object' || web === null || !('results' in web)) {
    return [];
  }

  const results = (web as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    return [];
  }

  return results.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }
    const record = item as { title?: unknown; url?: unknown; description?: unknown };
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    const snippet = typeof record.description === 'string' ? record.description.trim() : '';
    if (!title || !url || !/^https?:\/\//i.test(url)) {
      return [];
    }
    return [{ title, url, snippet }];
  }).slice(0, maxResults);
};

export const createBraveSearchProvider = (apiKey: string): SearchProvider => ({
  id: 'brave',
  displayName: 'Brave Search',
  async search(query, maxResults): Promise<SearchProviderResult> {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(maxResults));

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-subscription-token': apiKey,
      },
      signal: AbortSignal.timeout(20_000),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Brave 搜索失败：HTTP ${response.status} ${bodyText.slice(0, 200)}`.trim());
    }

    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      throw new Error('Brave 搜索失败：响应不是合法 JSON');
    }

    const results = parseBraveResponse(payload, maxResults);
    if (results.length === 0) {
      throw new Error(`Brave 搜索未返回可用结果（查询：${query}）`);
    }

    return { query, results, attempts: [] };
  },
});
