import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultHarnessConfig } from '@harnesskit/core';

type StreamEvent = { event: string; data: Record<string, unknown> };

let mockStreamEvents: StreamEvent[] = [
  { event: 'response.output_text.delta', data: { delta: 'hello' } },
  { event: 'response.output_text.delta', data: { delta: ' world' } },
  { event: 'response.completed', data: {} },
];

vi.mock('@harnesskit/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    streamOpenAIResponsesEvents: async function* () {
      for (const event of mockStreamEvents) {
        yield event;
      }
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
    mockStreamEvents = [
      { event: 'response.output_text.delta', data: { delta: 'hello' } },
      { event: 'response.output_text.delta', data: { delta: ' world' } },
      { event: 'response.completed', data: {} },
    ];
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

  it('allows empty final text when the model produces no assistant message', async () => {
    mockStreamEvents = [
      { event: 'response.completed', data: {} },
    ];

    const harness = new OpenAIHarness(
      createConfig(),
      { execute: vi.fn() } as never,
      { run: vi.fn() } as never,
    );

    const result = await harness.run({
      userId: 'u1',
      sessionId: 's1',
      message: 'only images please',
      history: [],
      files: [],
      availableSkills: [],
    });

    expect(result.finalText).toBe('');
  });
});
