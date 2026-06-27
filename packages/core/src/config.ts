/** Harness engine configuration — framework-agnostic */
export type HarnessConfig = {
  CWD: string;
  DATA_ROOT: string;
  SKILLS_ROOT: string;
  INSTALLED_SKILLS_ROOT?: string;
  OPENAI_BASE_URL: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  MODEL_CONTEXT_WINDOW_TOKENS?: number;
  MODEL_AUTO_COMPACT_TOKEN_LIMIT?: number;
  WEB_SEARCH_MODE: 'disabled' | 'cached' | 'live';
  OPENAI_REASONING_EFFORT: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  LLM_MAX_OUTPUT_TOKENS: number;
  TOOL_MAX_OUTPUT_TOKENS: number;
  ENABLE_ASSISTANT_TOOLS: boolean;
  LLM_REQUEST_TIMEOUT_MS: number;
  STREAM_MAX_RETRIES: number;
  STREAM_BACKOFF_BASE_MS: number;
  STREAM_BACKOFF_MULTIPLIER: number;
  ENABLE_TOKEN_TRACKING: boolean;
  ENABLE_REASONING_EVENTS: boolean;
  IMAGE_THUMBNAIL_THRESHOLD_BYTES?: number;
  IMAGE_THUMBNAIL_MAX_WIDTH?: number;
  IMAGE_THUMBNAIL_MAX_HEIGHT?: number;
  IMAGE_THUMBNAIL_QUALITY?: number;
  MAX_CONCURRENT_RUNS: number;
  RUN_TIMEOUT_MS: number;
  productName?: string;
  NODE_ENV?: 'development' | 'test' | 'production';
  INLINE_JOBS?: boolean;
};

export const defaultHarnessConfig = (
  partial: Partial<HarnessConfig> & Pick<HarnessConfig, 'CWD' | 'DATA_ROOT' | 'SKILLS_ROOT' | 'OPENAI_API_KEY'>,
): HarnessConfig => ({
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  OPENAI_MODEL: 'gpt-5.4',
  WEB_SEARCH_MODE: 'live',
  OPENAI_REASONING_EFFORT: 'xhigh',
  LLM_MAX_OUTPUT_TOKENS: 10240,
  TOOL_MAX_OUTPUT_TOKENS: 4096,
  ENABLE_ASSISTANT_TOOLS: true,
  LLM_REQUEST_TIMEOUT_MS: 45000,
  STREAM_MAX_RETRIES: 5,
  STREAM_BACKOFF_BASE_MS: 1000,
  STREAM_BACKOFF_MULTIPLIER: 2,
  ENABLE_TOKEN_TRACKING: true,
  ENABLE_REASONING_EVENTS: false,
  MAX_CONCURRENT_RUNS: 5,
  RUN_TIMEOUT_MS: 120_000,
  productName: 'HarnessKit',
  ...partial,
});
