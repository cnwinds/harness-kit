import path from 'node:path';
import {
  defaultHarnessConfig,
  parseNativeToolsPolicy,
  type HarnessConfig,
} from '@harnesskit/core';
import type { HarnessChatBootstrapOptions } from './types.js';

const readEnv = (key: string) => {
  const value = process.env[key];
  return value?.trim() ? value.trim() : undefined;
};

export const resolveBootstrapConfig = (options: HarnessChatBootstrapOptions): HarnessConfig => {
  const dataRoot = path.resolve(
    options.dataRoot
    ?? process.env.HARNESSKIT_DATA_ROOT
    ?? path.join(process.cwd(), 'data'),
  );
  const cwd = path.resolve(options.cwd ?? process.cwd());

  return defaultHarnessConfig({
    CWD: cwd,
    DATA_ROOT: dataRoot,
    SKILLS_ROOT: path.join(dataRoot, 'skills'),
    INSTALLED_SKILLS_ROOT: path.join(dataRoot, 'installed-skills'),
    OPENAI_API_KEY: options.llm.apiKey,
    OPENAI_BASE_URL: options.llm.baseUrl ?? process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: options.llm.model ?? process.env.OPENAI_MODEL,
    OPENAI_REASONING_EFFORT: options.llm.reasoningEffort
      ?? (readEnv('OPENAI_REASONING_EFFORT') as HarnessConfig['OPENAI_REASONING_EFFORT'] | undefined),
    WEB_SEARCH_MODE: options.webSearchMode
      ?? (process.env.WEB_SEARCH_MODE === 'disabled'
        || process.env.WEB_SEARCH_MODE === 'cached'
        || process.env.WEB_SEARCH_MODE === 'live'
        ? process.env.WEB_SEARCH_MODE
        : undefined),
    WEB_SEARCH_PROVIDERS: options.webSearchProviders ?? process.env.WEB_SEARCH_PROVIDERS,
    OPENAI_NATIVE_WEB_SEARCH: options.openaiNativeWebSearch
      ?? parseNativeToolsPolicy(process.env.OPENAI_NATIVE_WEB_SEARCH)
      ?? 'auto',
    TAVILY_API_KEY: readEnv('TAVILY_API_KEY'),
    SERPER_API_KEY: readEnv('SERPER_API_KEY'),
    BRAVE_SEARCH_API_KEY: readEnv('BRAVE_SEARCH_API_KEY'),
    OPENAI_NATIVE_IMAGE_GENERATION: options.openaiNativeImageGeneration
      ?? parseNativeToolsPolicy(process.env.OPENAI_NATIVE_IMAGE_GENERATION)
      ?? 'auto',
    IMAGE_PROVIDERS: options.imageProviders ?? process.env.IMAGE_PROVIDERS,
    OPENAI_IMAGE_API_KEY: readEnv('OPENAI_IMAGE_API_KEY'),
    OPENAI_IMAGE_BASE_URL: readEnv('OPENAI_IMAGE_BASE_URL'),
    OPENAI_IMAGE_MODEL: readEnv('OPENAI_IMAGE_MODEL'),
    ZHIPU_IMAGE_API_KEY: readEnv('ZHIPU_IMAGE_API_KEY'),
    ZHIPU_IMAGE_BASE_URL: readEnv('ZHIPU_IMAGE_BASE_URL'),
    ZHIPU_IMAGE_MODEL: readEnv('ZHIPU_IMAGE_MODEL'),
    DASHSCOPE_IMAGE_API_KEY: readEnv('DASHSCOPE_IMAGE_API_KEY'),
    DASHSCOPE_IMAGE_BASE_URL: readEnv('DASHSCOPE_IMAGE_BASE_URL'),
    DASHSCOPE_IMAGE_MODEL: readEnv('DASHSCOPE_IMAGE_MODEL'),
    INLINE_JOBS: options.inlineJobs ?? process.env.HARNESSKIT_INLINE_JOBS === 'true',
    productName: options.productName ?? 'HarnessKit',
    NODE_ENV: options.nodeEnv ?? (process.env.NODE_ENV as HarnessConfig['NODE_ENV']) ?? 'development',
  });
};
