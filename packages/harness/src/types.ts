import type { StoredEvent, TurnConfig } from '@harnesskit/protocol';
import type { ChatUser } from '@harnesskit/protocol';
import type { TurnExecutionContext } from '@harnesskit/core';

export type LLMConfig = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  reasoningEffort?: TurnConfig['reasoningEffort'];
  maxOutputTokens?: number;
};

export type HarnessToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ) => Promise<unknown>;
};

export type ToolExecutionContext = {
  user: ChatUser;
  sessionId: string;
  turnId: string;
  signal: AbortSignal;
};

export type ToolCatalog = {
  list(): HarnessToolDefinition[];
  get(name: string): HarnessToolDefinition | undefined;
};

export type HarnessCallbacks = {
  onTextDelta: (content: string) => void;
  onReasoningDelta: (content: string) => void;
  onThinking: (content: string) => void;
  onToolStart: (call: { callId: string; name: string; arguments: Record<string, unknown> }) => void;
  onToolProgress: (update: { callId: string; message: string; percent?: number }) => void;
  onToolResult: (result: { callId: string; name: string; content: string }) => void;
  onTokenCount: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => void;
};

export type HarnessRunContext = {
  user: ChatUser;
  sessionId: string;
  turnCtx: TurnExecutionContext;
  history: StoredEvent[];
  instructions: string;
  activeSkillIds: string[];
  turnConfig?: TurnConfig;
  callbacks: HarnessCallbacks;
};

/** Pluggable LLM backend — default is OpenAI Responses */
export interface HarnessProvider {
  readonly name: string;
  streamRound(ctx: HarnessRunContext, signal: AbortSignal): AsyncIterable<HarnessStreamEvent>;
}

export type HarnessStreamEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'reasoning_delta'; content: string }
  | { type: 'tool_call'; callId: string; name: string; arguments: Record<string, unknown> }
  | { type: 'token_count'; inputTokens: number; outputTokens: number; totalTokens: number }
  | { type: 'done'; assistantContent: string };

export interface HarnessEngine {
  /** Execute one harness round within a turn (may loop internally for tool calls) */
  runTurn(ctx: HarnessRunContext): Promise<void>;
}

export type CreateHarnessEngineOptions = {
  llm: LLMConfig;
  provider?: HarnessProvider;
  tools?: ToolCatalog;
  maxModelRequests?: number;
  maxToolCalls?: number;
};

export type HarnessEngineFactory = (options: CreateHarnessEngineOptions) => HarnessEngine;
