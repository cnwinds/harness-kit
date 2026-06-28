import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const files = {
  'packages/harness/src/openai-harness.test.ts': `import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultHarnessConfig } from '@harnesskit/core';

vi.mock('@harnesskit/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    streamOpenAIResponsesEvents: async function* () {
      yield { event: 'response.output_text.delta', data: { delta: 'hello' } };
      yield { event: 'response.output_text.delta', data: { delta: ' world' } };
      yield { event: 'response.completed', data: {} };
    },
  };
});

import { OpenAIHarness } from './openai-harness.js';

const createConfig = () => defaultHarnessConfig({
  CWD: '/workspace/demo',
  DATA_ROOT: '/tmp/harness-data',
  SKILLS_ROOT: '/tmp/harness-data/skills',
  OPENAI_API_KEY: 'test-token',
  OPENAI_BASE_URL: 'http://example.com/v1',
  NODE_ENV: 'test',
  LLM_REQUEST_TIMEOUT_MS: 1_000,
  TOOL_MAX_OUTPUT_TOKENS: 3072,
});

describe('OpenAIHarness', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams text deltas and returns final text from mocked responses stream', async () => {
    const textDeltas = [];
    const harness = new OpenAIHarness(
      createConfig(),
      { execute: vi.fn() } as never,
      { run: vi.fn() } as never,
    );

    const result = await harness.run({
      userId: 'u1',
      sessionId: 's1',
      message: 'hello',
      history: [],
      files: [],
      availableSkills: [],
      callbacks: {
        onTextDelta: async (content) => {
          textDeltas.push(content);
        },
      },
    });

    expect(result.finalText).toBe('hello world');
    expect(textDeltas.join('')).toBe('hello world');
  });
});
`,
  'packages/server/src/orchestrator/chat-orchestrator.test.ts': `import { describe, expect, it, vi } from 'vitest';
import { defaultHarnessConfig } from '@harnesskit/core';
import { ChatOrchestrator } from './chat-orchestrator.js';

const createOrchestrator = () => {
  const appendEvent = vi.fn(async () => undefined);
  const publish = vi.fn();

  const orchestrator = new ChatOrchestrator(
    {
      appendEvent,
      readEvents: vi.fn(async () => []),
    } as never,
    { publish } as never,
    {
      get: vi.fn((name: string) => ({
        id: \`skill_\${name}\`,
        name,
        description: \`\${name} desc\`,
        directory: \`/tmp/skills/\${name}\`,
        source: 'legacy' as const,
      })),
    } as never,
    { hasUserInstalled: vi.fn(() => true) } as never,
    { getFileContext: vi.fn(() => []) } as never,
    {
      requireOwned: vi.fn(() => ({
        id: 's1',
        title: 'demo',
        createdAt: '',
        updatedAt: '',
        lastMessageAt: null,
        activeSkills: [],
      })),
      renameFromMessage: vi.fn(async () => undefined),
      touch: vi.fn(async () => undefined),
    } as never,
    defaultHarnessConfig({
      CWD: '/tmp',
      DATA_ROOT: '/tmp/harness-orchestrator',
      SKILLS_ROOT: '/tmp/harness-orchestrator/skills',
      OPENAI_API_KEY: 'test-token',
      INLINE_JOBS: true,
      NODE_ENV: 'test',
    }),
    { run: vi.fn(), compactContext: vi.fn(async () => 'summary') } as never,
    {
      load: vi.fn(async () => ({ version: 1, latestCompaction: null })),
      save: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    } as never,
  );

  return { orchestrator, appendEvent, publish };
};

describe('ChatOrchestrator', () => {
  it('handleFailure persists error event and publishes done', async () => {
    const { orchestrator, appendEvent, publish } = createOrchestrator();

    await orchestrator.handleFailure('u1', 's1', new Error('OpenAI API key is not configured'));

    expect(appendEvent).toHaveBeenCalledWith(
      'u1',
      's1',
      expect.objectContaining({ kind: 'error', message: 'OpenAI API key is not configured' }),
    );
    expect(publish).toHaveBeenCalledWith('s1', expect.objectContaining({ event: 'done' }));
  });

  it('handleFailure can skip done when publishDone is false', async () => {
    const { orchestrator, publish } = createOrchestrator();

    await orchestrator.handleFailure('u1', 's1', new Error('boom'), { publishDone: false });

    expect(publish).toHaveBeenCalledWith('s1', expect.objectContaining({ event: 'error' }));
    expect(publish).not.toHaveBeenCalledWith('s1', expect.objectContaining({ event: 'done' }));
  });
});
`,
};

for (const [relativePath, content] of Object.entries(files)) {
  const target = path.join(root, relativePath);
  fs.writeFileSync(target, content, 'utf8');
  console.log('wrote', relativePath);
}
