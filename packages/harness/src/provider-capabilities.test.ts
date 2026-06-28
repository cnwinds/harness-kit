import { describe, expect, it } from 'vitest';
import { defaultHarnessConfig } from '@harnesskit/core';
import {
  buildImageProviderChain,
  buildWebSearchProviderChain,
  resolveProviderCapabilities,
  supportsOpenAINativeResponsesTools,
} from './provider-capabilities.js';

const baseConfig = defaultHarnessConfig({
  CWD: '/tmp',
  DATA_ROOT: '/tmp/data',
  SKILLS_ROOT: '/tmp/data/skills',
  OPENAI_API_KEY: 'test',
});

describe('provider capabilities', () => {
  it('detects OpenAI native endpoints', () => {
    expect(supportsOpenAINativeResponsesTools('https://api.openai.com/v1')).toBe(true);
    expect(supportsOpenAINativeResponsesTools('https://dashscope.aliyuncs.com/compatible-mode/v1')).toBe(false);
  });

  it('auto-enables native tools on official OpenAI and disables on relay by default', () => {
    const official = resolveProviderCapabilities({
      ...baseConfig,
      OPENAI_BASE_URL: 'https://api.openai.com/v1',
    });
    const relay = resolveProviderCapabilities({
      ...baseConfig,
      OPENAI_BASE_URL: 'https://relay.example.com/v1',
    });

    expect(official.nativeWebSearchEnabled).toBe(true);
    expect(official.nativeImageGenerationEnabled).toBe(true);
    expect(relay.nativeWebSearchEnabled).toBe(false);
    expect(relay.nativeImageGenerationEnabled).toBe(false);
  });

  it('activates third-party search providers from configured keys', () => {
    const config = {
      ...baseConfig,
      OPENAI_BASE_URL: 'https://relay.example.com/v1',
      TAVILY_API_KEY: 'tvly-test',
      SERPER_API_KEY: 'serper-test',
    };

    expect(resolveProviderCapabilities(config).activeWebSearchProviderIds).toEqual([
      'tavily',
      'serper',
    ]);
  });

  it('orders providers with preferred id first', () => {
    const config = {
      ...baseConfig,
      OPENAI_BASE_URL: 'https://relay.example.com/v1',
      TAVILY_API_KEY: 'tvly-test',
      SERPER_API_KEY: 'serper-test',
    };

    expect(buildWebSearchProviderChain(config, 'serper')).toEqual([
      'serper',
      'tavily',
    ]);
  });

  it('activates image providers only when key and model are configured', () => {
    const config = {
      ...baseConfig,
      OPENAI_IMAGE_API_KEY: 'img-key',
      OPENAI_IMAGE_MODEL: 'gpt-image-2',
      ZHIPU_IMAGE_API_KEY: 'zhipu-key',
      ZHIPU_IMAGE_MODEL: 'glm-image',
      DASHSCOPE_IMAGE_API_KEY: 'dash-key',
    };

    expect(resolveProviderCapabilities(config).activeImageProviderIds).toEqual([
      'openai_images',
      'zhipu',
    ]);

    const withBailian = {
      ...config,
      DASHSCOPE_IMAGE_MODEL: 'wan2.1-t2i-turbo',
    };
    expect(resolveProviderCapabilities(withBailian).activeImageProviderIds).toEqual([
      'openai_images',
      'zhipu',
      'bailian',
    ]);
    expect(buildImageProviderChain(withBailian, 'zhipu')).toEqual([
      'zhipu',
      'openai_images',
      'bailian',
    ]);
  });
});
