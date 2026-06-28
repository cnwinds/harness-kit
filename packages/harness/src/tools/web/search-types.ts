export type WebSearchProviderId = 'openai_native' | 'tavily' | 'serper' | 'brave';

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchMatch = SearchHit & {
  query: string;
  provider: string;
};

export type SearchPageAnalysis = SearchMatch & {
  finalUrl?: string;
  excerpt?: string;
  fetchError?: string;
};

export type SearchProviderResult = {
  query: string;
  results: SearchHit[];
  attempts: string[];
};

export type SearchProvider = {
  id: WebSearchProviderId;
  displayName: string;
  search: (query: string, maxResults: number) => Promise<SearchProviderResult>;
};

export type FetchPageText = (
  url: string,
  action: string,
) => Promise<{
  body: string;
  contentType: string;
  finalUrl?: string;
}>;

export type WebSearchToolInput = {
  query: string;
  maxResults: number;
};

export type WebSearchToolResult = {
  tool: 'web_search';
  arguments: WebSearchToolInput;
  summary: string;
  content: string;
  context: string;
  isError?: boolean;
};
