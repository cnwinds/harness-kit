import type {
  CreateHarnessEngineOptions,
  HarnessEngine,
  HarnessProvider,
  HarnessRunContext,
  HarnessStreamEvent,
  ToolCatalog,
} from './types.js';

class StubHarnessEngine implements HarnessEngine {
  constructor(private readonly provider: HarnessProvider) {}

  async runTurn(ctx: HarnessRunContext): Promise<void> {
    let assistantContent = '';
    for await (const event of this.provider.streamRound(ctx, ctx.turnCtx.signal)) {
      switch (event.type) {
        case 'text_delta':
          assistantContent += event.content;
          ctx.callbacks.onTextDelta(event.content);
          break;
        case 'reasoning_delta':
          ctx.callbacks.onReasoningDelta(event.content);
          break;
        case 'tool_call':
          ctx.callbacks.onToolStart({
            callId: event.callId,
            name: event.name,
            arguments: event.arguments,
          });
          break;
        case 'token_count':
          ctx.callbacks.onTokenCount({
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            totalTokens: event.totalTokens,
          });
          break;
        case 'done':
          assistantContent = event.assistantContent;
          break;
      }
      ctx.turnCtx.throwIfAborted();
    }
    void assistantContent;
  }
}

const defaultToolCatalog: ToolCatalog = {
  list: () => [],
  get: () => undefined,
};

/**
 * Create a harness engine instance.
 * Phase 2: migrate OpenAIHarness from SkillChat with full agent loop.
 */
export const createHarnessEngine = (options: CreateHarnessEngineOptions): HarnessEngine => {
  const provider =
    options.provider ??
    createStubOpenAIProvider({
      apiKey: options.llm.apiKey,
      baseUrl: options.llm.baseUrl,
      model: options.llm.model ?? 'gpt-4.1',
    });

  void (options.tools ?? defaultToolCatalog);
  return new StubHarnessEngine(provider);
};

/** Stub provider — replaced by openai-responses.ts in Phase 2 */
export const createStubOpenAIProvider = (config: {
  apiKey: string;
  baseUrl?: string;
  model: string;
}): HarnessProvider => ({
  name: 'openai-stub',
  async *streamRound(ctx, signal): AsyncIterable<HarnessStreamEvent> {
    void config;
    void signal;
    const reply = `[HarnessKit stub] Received: ${ctx.turnCtx.initialInput.content.slice(0, 80)}`;
    for (const char of reply) {
      yield { type: 'text_delta', content: char };
    }
    yield {
      type: 'token_count',
      inputTokens: 10,
      outputTokens: reply.length,
      totalTokens: 10 + reply.length,
    };
    yield { type: 'done', assistantContent: reply };
  },
});

export type { CreateHarnessEngineOptions, HarnessEngine, HarnessProvider } from './types.js';
export { defineTool, createToolCatalog } from './tools/catalog.js';
