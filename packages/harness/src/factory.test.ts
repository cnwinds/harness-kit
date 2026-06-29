import { describe, expect, it } from 'vitest';
import { createOpenAIHarnessStack } from './factory.js';
import { defaultHarnessConfig } from '@skillchat/harness-core';

describe('createOpenAIHarnessStack', () => {
  it('wires runner, tools, image service, and harness together', () => {
    const config = defaultHarnessConfig({
      CWD: process.cwd(),
      DATA_ROOT: '/tmp/harness-factory',
      SKILLS_ROOT: '/tmp/harness-factory/skills',
      OPENAI_API_KEY: 'test-token',
    });
    const stack = createOpenAIHarnessStack(config, {
      getById: () => { throw new Error('missing'); },
      list: () => [],
      saveUpload: async () => { throw new Error('missing'); },
      recordGeneratedFile: async () => { throw new Error('missing'); },
      saveGeneratedBinary: async () => { throw new Error('missing'); },
      getFileContext: () => [],
      resolveDownloadPath: async () => { throw new Error('missing'); },
    });

    expect(stack.runnerManager).toBeDefined();
    expect(stack.assistantToolService).toBeDefined();
    expect(stack.openAIImageService).toBeDefined();
    expect(stack.imageOrchestrator).toBeDefined();
    expect(stack.prefsStore).toBeDefined();
    expect(stack.openAIHarness).toBeDefined();
    expect(typeof stack.openAIHarness.run).toBe('function');
  });
});
