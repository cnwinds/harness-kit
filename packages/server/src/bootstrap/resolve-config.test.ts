import { describe, expect, it } from 'vitest';
import { resolveBootstrapConfig } from './resolve-config.js';

describe('resolveBootstrapConfig', () => {
  it('maps bootstrap llm options into HarnessConfig', () => {
    const config = resolveBootstrapConfig({
      llm: {
        apiKey: 'secret',
        model: 'gpt-4.1-mini',
        baseUrl: 'https://example.com/v1',
        reasoningEffort: 'low',
      },
      dataRoot: '/tmp/harness-demo',
      productName: 'DemoApp',
      nodeEnv: 'test',
      inlineJobs: true,
      webSearchMode: 'disabled',
    });

    expect(config.OPENAI_API_KEY).toBe('secret');
    expect(config.OPENAI_MODEL).toBe('gpt-4.1-mini');
    expect(config.OPENAI_BASE_URL).toBe('https://example.com/v1');
    expect(config.OPENAI_REASONING_EFFORT).toBe('low');
    expect(config.DATA_ROOT).toMatch(/harness-demo$/);
    expect(config.productName).toBe('DemoApp');
    expect(config.INLINE_JOBS).toBe(true);
    expect(config.WEB_SEARCH_MODE).toBe('disabled');
  });
});
