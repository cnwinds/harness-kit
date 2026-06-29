import type { HarnessConfig } from '@skillchat/harness-core';
import type { AuthResolver } from '../auth.js';

export type HarnessChatBootstrapOptions = {
  llm: {
    apiKey: string;
    model?: string;
    baseUrl?: string;
    reasoningEffort?: HarnessConfig['OPENAI_REASONING_EFFORT'];
  };
  dataRoot?: string;
  cwd?: string;
  inlineJobs?: boolean;
  webSearchMode?: HarnessConfig['WEB_SEARCH_MODE'];
  webSearchProviders?: string;
  openaiNativeWebSearch?: HarnessConfig['OPENAI_NATIVE_WEB_SEARCH'];
  openaiNativeImageGeneration?: HarnessConfig['OPENAI_NATIVE_IMAGE_GENERATION'];
  imageProviders?: string;
  productName?: string;
  nodeEnv?: HarnessConfig['NODE_ENV'];
  auth?: AuthResolver;
};
