import type { FileRecord, SessionFileContext, StoredEvent, TurnConfig } from '@skillchat/harness-protocol';
import type { HarnessConfig } from '@skillchat/harness-core';
import { isOpenAIResponsesRecord, streamOpenAIResponsesEvents } from '@skillchat/harness-core';
import { HarnessError, toHarnessError } from '@skillchat/harness-core';
import type { TokenUsage } from '@skillchat/harness-core';
import type { AssistantToolService } from './tools/assistant-tool-service.js';
import type { RunnerManager } from '@skillchat/harness-core';
import type { SkillDescriptor } from '@skillchat/harness-core';
import { OpenAIImageService } from './openai-image-service.js';
import {
  buildAssistantToolCatalog,
  toResponsesFunctionTool,
  type ToolRuntimeCallbacks,
} from './tools/tool-catalog.js';
import { ToolCallRuntime, type ParsedLocalToolCall } from './tools/tool-call-runtime.js';
import type { SessionContextState } from './session-context-store.js';
import {
  buildResponsesCompactionInput,
  buildResponsesHistoryInput,
  createCompactionSummaryMessage,
  estimateResponsesInputTokens,
  resolveAutoCompactLimitTokens,
  resolveCompactionSourceBudgetTokens,
  type ResponsesMessageInput,
} from './openai-harness-context.js';
import { formatUserAttachmentReferences } from './attachment-references.js';
import { buildOpenAIHarnessInstructions } from './openai-harness-prompt.js';
import { resolveProviderCapabilities } from './provider-capabilities.js';
import type { ImageGenerationOrchestrator } from './image/image-orchestrator.js';

type JsonRecord = Record<string, unknown>;
type ResponsesInputItem = JsonRecord;

type HarnessCallbacks = ToolRuntimeCallbacks & {
  onRoundStart?: (round: number) => Promise<void> | void;
  onTextDelta?: (content: string) => Promise<void> | void;
  onImageGenerated?: (event: {
    source: 'responses_tool' | 'images_generate_api';
    model: string;
    operation: 'generate' | 'edit';
    file: FileRecord;
    prompt: string;
    revisedPrompt?: string;
    inputFileIds?: string[];
  }) => Promise<void> | void;
  onReasoningDelta?: (event: { content: string; summaryIndex?: number }) => Promise<void> | void;
  onTokenUsage?: (usage: TokenUsage) => Promise<void> | void;
  onContextCompactionStart?: (event: {
    scope: 'mid_turn';
    estimatedTokens: number;
  }) => Promise<void> | void;
};

type PendingHarnessInput = {
  inputId: string;
  content: string;
  createdAt: string;
  attachmentIds?: string[];
};

type SamplingRequestResult = {
  textDeltas: string[];
  completedItems: ResponsesInputItem[];
  localToolCalls: ParsedLocalToolCall[];
  needsFollowUp: boolean;
  tokenUsage?: TokenUsage;
};

const MAX_MODEL_REQUESTS_PER_TURN = 48;
const MAX_TOOL_CALLS_PER_TURN = 128;
const MAX_CONTINUATION_COMPACTIONS_PER_TURN = 8;
const REPLY_STREAM_IDLE_TIMEOUT_MS = 120_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeText = (value: string) => value.replace(/\n{3,}/g, '\n\n').trim();
const isJsonRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null;
const extractMessageText = (message: ResponsesMessageInput) => typeof message.content === 'string'
  ? message.content
  : message.content
    .flatMap((item) => (item.type === 'input_text' ? [item.text] : []))
    .join('\n');

const readImageGenerationResult = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = readImageGenerationResult(item);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (!isJsonRecord(value)) {
    return null;
  }

  if (typeof value.b64_json === 'string' && value.b64_json.trim()) {
    return value.b64_json.trim();
  }

  if (typeof value.image_base64 === 'string' && value.image_base64.trim()) {
    return value.image_base64.trim();
  }

  if (typeof value.result === 'string' && value.result.trim()) {
    return value.result.trim();
  }

  return null;
};

type ImageServiceLike = Pick<
  OpenAIImageService,
  'buildResponsesInputImages' | 'saveResponsesImageToolResult'
> & {
  partitionAttachments?: OpenAIImageService['partitionAttachments'];
};

const parseJsonArguments = (raw: unknown) => {
  if (typeof raw === 'string') {
    if (!raw.trim()) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isJsonRecord(parsed)) {
      throw new Error('工具参数必须是 JSON object');
    }
    return parsed as Record<string, unknown>;
  }

  if (isJsonRecord(raw)) {
    return raw as Record<string, unknown>;
  }

  return {};
};

const shouldReplayCompletedItem = (item: ResponsesInputItem) => (
  item.type === 'function_call' || item.type === 'web_search_call'
);

const resolveStreamItemCallId = (
  eventItem: ResponsesInputItem | null,
  dataRecord: JsonRecord | null,
  fallbackIndex: number,
) => {
  if (eventItem && typeof eventItem.id === 'string' && eventItem.id) {
    return eventItem.id;
  }
  if (eventItem && typeof eventItem.call_id === 'string' && eventItem.call_id) {
    return eventItem.call_id;
  }
  if (dataRecord && typeof dataRecord.item_id === 'string' && dataRecord.item_id) {
    return dataRecord.item_id;
  }
  return `img_${fallbackIndex}`;
};

const isGenerateImageFunctionCall = (eventItem: ResponsesInputItem) => (
  eventItem.type === 'function_call' && String(eventItem.name ?? '') === 'generate_image'
);

const buildCompactionInstructions = (productName: string) => [
  `你是 ${productName} 的上下文压缩器。`,
  '你的任务是把已有会话压缩成后续轮次可复用的高密度摘要。',
  '只输出摘要正文，不要寒暄，不要解释你在做压缩。',
  '摘要必须覆盖：',
  '1. 用户目标与当前问题',
  '2. 已确认的事实、约束、偏好和边界',
  '3. 已读取的重要文件、skill、工具结果和关键数据',
  '4. 已生成的产物',
  '5. 后续还未完成的事项',
  '6. 如果本轮已经向用户输出过部分答复，要简要说明已经说到哪里，避免后续重复',
  '如果某项没有内容就省略，不要编造。',
].join('\n');

const readTokenUsage = (value: unknown): TokenUsage | undefined => {
  if (isJsonRecord(value) && isJsonRecord(value.response)) {
    const nestedUsage = readTokenUsage(value.response.usage);
    if (nestedUsage) {
      return nestedUsage;
    }
  }

  if (!isJsonRecord(value)) {
    return undefined;
  }

  const inputTokens = Number(value.input_tokens ?? 0);
  const outputTokens = Number(value.output_tokens ?? 0);
  const totalTokens = Number(value.total_tokens ?? (inputTokens + outputTokens));
  if (![inputTokens, outputTokens, totalTokens].every(Number.isFinite)) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
};

export class OpenAIHarness {
  constructor(
    private readonly config: HarnessConfig,
    private readonly assistantToolService: AssistantToolService,
    private readonly runnerManager: RunnerManager,
    private readonly openAIImageService: ImageServiceLike = {
      buildResponsesInputImages: async () => [],
      saveResponsesImageToolResult: async () => {
        throw new Error('OpenAI image service is not configured');
      },
    },
    private readonly imageOrchestrator?: ImageGenerationOrchestrator,
  ) {}

  private get baseUrl() {
    return this.config.OPENAI_BASE_URL.replace(/\/+$/, '');
  }

  private get apiKey() {
    return this.config.OPENAI_API_KEY;
  }

  private buildReasoning(turnConfig?: TurnConfig) {
    const model = turnConfig?.model ?? this.config.OPENAI_MODEL;
    if (!/^gpt-5|^o\d/i.test(model)) {
      return undefined;
    }

    return {
      effort: turnConfig?.reasoningEffort ?? this.config.OPENAI_REASONING_EFFORT,
      summary: 'auto',
    };
  }

  async run(args: {
    userId: string;
    sessionId: string;
    message: string;
    attachmentIds?: string[];
    history: StoredEvent[];
    files: SessionFileContext[];
    availableSkills?: SkillDescriptor[];
    contextState?: SessionContextState | null;
    signal?: AbortSignal;
    drainPendingInputs?: () => Promise<PendingHarnessInput[]>;
    startingRound?: number;
    callbacks?: HarnessCallbacks;
    turnConfig?: TurnConfig;
  }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const availableSkills = args.availableSkills ?? [];
    const capabilities = resolveProviderCapabilities(this.config);
    const webSearchMode = args.turnConfig?.webSearchMode ?? this.config.WEB_SEARCH_MODE;
    const toolCatalog = buildAssistantToolCatalog({
      assistantToolsEnabled: this.config.ENABLE_ASSISTANT_TOOLS,
      webSearchAvailable: webSearchMode !== 'disabled' && capabilities.webSearchToolAvailable,
      imageGenerationAvailable: capabilities.imageFunctionToolAvailable,
      enabledSkillNames: availableSkills.map((skill) => skill.name),
    });
    const tools = [
      ...toolCatalog.map(toResponsesFunctionTool),
      ...(capabilities.nativeImageToolAvailable
        ? [{
            type: 'image_generation',
            action: 'auto',
          }]
        : []),
    ];
    const instructions = buildOpenAIHarnessInstructions({
      config: this.config,
      files: args.files,
      availableSkills,
      webSearchEnabled: webSearchMode !== 'disabled' && capabilities.webSearchToolAvailable,
      imageGenerationEnabled: capabilities.nativeImageToolAvailable || capabilities.imageFunctionToolAvailable,
    });

    const historyInput = buildResponsesHistoryInput({
      config: this.config,
      history: args.history,
      currentMessage: args.message,
      contextState: args.contextState,
      appendCurrentMessage: false,
      injectionStrategy: 'prepend',
    });
    const initialUserMessage = await this.buildUserMessageItem(args.userId, args.message, args.attachmentIds);
    let inputItems: ResponsesInputItem[] = [
      ...historyInput.input as unknown as ResponsesInputItem[],
      initialUserMessage as unknown as ResponsesInputItem,
    ];
    let currentTurnUserMessages: ResponsesMessageInput[] = [initialUserMessage];
    let currentTurnAttachmentIds = [...new Set(args.attachmentIds ?? [])];
    const finalTextChunks: string[] = [];
    let cumulativeTokenUsage: TokenUsage | undefined;

    let roundsUsed = 0;
    const roundBase = args.startingRound ?? 1;
    let toolCallsUsed = 0;
    let continuationCompactionsUsed = 0;

    while (true) {
      this.throwIfAborted(args.signal);
      roundsUsed += 1;
      if (roundsUsed > MAX_MODEL_REQUESTS_PER_TURN) {
        throw new Error('单个 turn 的模型续跑次数过多，已中止');
      }

      await args.callbacks?.onRoundStart?.(roundBase + roundsUsed - 1);
      const samplingResult = await this.runSamplingRequest({
        instructions,
        inputItems,
        tools,
        userId: args.userId,
        sessionId: args.sessionId,
        currentPrompt: currentTurnUserMessages.map(extractMessageText).filter(Boolean).join('\n'),
        currentInputFileIds: currentTurnAttachmentIds,
        signal: args.signal,
        callbacks: args.callbacks,
        turnConfig: args.turnConfig,
      });
      finalTextChunks.push(...samplingResult.textDeltas);
      cumulativeTokenUsage = this.mergeTokenUsage(cumulativeTokenUsage, samplingResult.tokenUsage);

      if (samplingResult.localToolCalls.length === 0) {
        const pendingInputs = await args.drainPendingInputs?.() ?? [];
        if (pendingInputs.length > 0) {
          const pendingInputItems = await Promise.all(
            pendingInputs.map((input) => this.buildUserMessageItem(args.userId, input.content, input.attachmentIds)),
          );
          const roundText = samplingResult.textDeltas.join('');
          currentTurnUserMessages = [
            ...currentTurnUserMessages,
            ...pendingInputItems,
          ];
          currentTurnAttachmentIds = [
            ...new Set([
              ...currentTurnAttachmentIds,
              ...pendingInputs.flatMap((input) => input.attachmentIds ?? []),
            ]),
          ];
          inputItems = [
            ...inputItems,
            ...(roundText ? [{ role: 'assistant', content: roundText }] : []),
            ...pendingInputItems,
          ] as ResponsesInputItem[];

          const continuation = await this.maybeCompactContinuationInput({
            inputItems,
            currentTurnUserMessages,
            tokenUsage: samplingResult.tokenUsage,
            signal: args.signal,
            callbacks: args.callbacks,
          });
          inputItems = continuation.inputItems;
          continuationCompactionsUsed += continuation.didCompact ? 1 : 0;
          if (continuationCompactionsUsed > MAX_CONTINUATION_COMPACTIONS_PER_TURN) {
            throw new Error('单个 turn 的上下文压缩次数过多，已中止');
          }
          continue;
        }

        const hasReplayableNativeItems = samplingResult.completedItems.some(shouldReplayCompletedItem);
        if (hasReplayableNativeItems) {
          const roundText = samplingResult.textDeltas.join('');
          inputItems = [
            ...inputItems,
            ...(roundText ? [{ role: 'assistant', content: roundText }] : []),
            ...samplingResult.completedItems.filter(shouldReplayCompletedItem),
          ] as ResponsesInputItem[];
          continue;
        }

        return {
          finalText: finalTextChunks.join(''),
          roundsUsed,
          tokenUsage: cumulativeTokenUsage,
        };
      }

      const toolRuntime = new ToolCallRuntime(
        toolCatalog,
        this.assistantToolService,
        this.runnerManager,
        args.callbacks,
      );
      const toolResults = await toolRuntime.executeAll({
        userId: args.userId,
        sessionId: args.sessionId,
        files: args.files,
        availableSkills,
        toolCalls: samplingResult.localToolCalls,
        signal: args.signal,
      });

      toolCallsUsed += samplingResult.localToolCalls.length;
      if (toolCallsUsed > MAX_TOOL_CALLS_PER_TURN) {
        throw new Error('单个 turn 的工具调用次数过多，已中止');
      }

      const roundText = samplingResult.textDeltas.join('');
      inputItems = [
        ...inputItems,
        ...(roundText ? [{ role: 'assistant', content: roundText }] : []),
        ...samplingResult.completedItems.filter(shouldReplayCompletedItem),
        ...toolResults.outputs,
      ];

      const pendingInputs = await args.drainPendingInputs?.() ?? [];
      if (pendingInputs.length > 0) {
        const pendingInputItems = await Promise.all(
          pendingInputs.map((input) => this.buildUserMessageItem(args.userId, input.content, input.attachmentIds)),
        );
        currentTurnUserMessages = [
          ...currentTurnUserMessages,
          ...pendingInputItems,
        ];
        currentTurnAttachmentIds = [
          ...new Set([
            ...currentTurnAttachmentIds,
            ...pendingInputs.flatMap((input) => input.attachmentIds ?? []),
          ]),
        ];
        inputItems = [
          ...inputItems,
          ...pendingInputItems,
        ] as ResponsesInputItem[];
      }

      const continuation = await this.maybeCompactContinuationInput({
        inputItems,
        currentTurnUserMessages,
        tokenUsage: samplingResult.tokenUsage,
        signal: args.signal,
        callbacks: args.callbacks,
      });
      inputItems = continuation.inputItems;
      continuationCompactionsUsed += continuation.didCompact ? 1 : 0;
      if (continuationCompactionsUsed > MAX_CONTINUATION_COMPACTIONS_PER_TURN) {
        throw new Error('单个 turn 的上下文压缩次数过多，已中止');
      }
    }
  }

  async compactContext(args: {
    history: StoredEvent[];
    contextState?: SessionContextState | null;
    currentMessage?: string;
    appendCurrentMessage?: boolean;
    signal?: AbortSignal;
  }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const compactionInput = buildResponsesHistoryInput({
      config: this.config,
      history: args.history,
      currentMessage: args.currentMessage,
      contextState: args.contextState,
      appendCurrentMessage: args.appendCurrentMessage ?? false,
      maxTokens: resolveCompactionSourceBudgetTokens(this.config),
      injectionStrategy: 'prepend',
    }).input as unknown as ResponsesInputItem[];

    return this.summarizeInputItems({
      inputItems: compactionInput,
      signal: args.signal,
    });
  }

  private mergeTokenUsage(previous: TokenUsage | undefined, next: TokenUsage | undefined) {
    if (!previous) {
      return next;
    }
    if (!next) {
      return previous;
    }
    return {
      inputTokens: previous.inputTokens + next.inputTokens,
      outputTokens: previous.outputTokens + next.outputTokens,
      totalTokens: previous.totalTokens + next.totalTokens,
    };
  }

  private async buildUserMessageItem(userId: string, content: string, attachmentIds?: string[]): Promise<ResponsesMessageInput> {
    const normalizedAttachmentIds = [...new Set(attachmentIds ?? [])];
    if (normalizedAttachmentIds.length === 0) {
      return {
        role: 'user',
        content,
      };
    }

    const partition = this.openAIImageService.partitionAttachments?.(userId, normalizedAttachmentIds) ?? {
      imageIds: normalizedAttachmentIds,
      nonImageFiles: [],
    };
    const attachmentNote = formatUserAttachmentReferences(partition.nonImageFiles);
    const textContent = attachmentNote
      ? [content.trim(), attachmentNote].filter(Boolean).join('\n\n')
      : content;

    const inputImages = partition.imageIds.length > 0
      ? await this.openAIImageService.buildResponsesInputImages(userId, partition.imageIds)
      : [];

    if (inputImages.length === 0) {
      return {
        role: 'user',
        content: textContent,
      };
    }

    return {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: textContent,
        },
        ...inputImages,
      ],
    };
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (!signal?.aborted) {
      return;
    }

    throw signal.reason instanceof Error ? signal.reason : new DOMException('Turn interrupted', 'AbortError');
  }

  private async runSamplingRequest(args: {
    instructions: string;
    inputItems: ResponsesInputItem[];
    tools: Array<Record<string, unknown>>;
    userId: string;
    sessionId: string;
    currentPrompt: string;
    currentInputFileIds: string[];
    signal?: AbortSignal;
    callbacks?: HarnessCallbacks;
    turnConfig?: TurnConfig;
  }): Promise<SamplingRequestResult> {
    const textDeltas: string[] = [];
    const completedItems: ResponsesInputItem[] = [];
    const localToolCalls: ParsedLocalToolCall[] = [];
    const startedGenerateImageToolCalls = new Set<string>();
    let tokenUsage: TokenUsage | undefined;

    const ensureGenerateImageToolStarted = async (callId: string, toolArguments: Record<string, unknown>) => {
      if (startedGenerateImageToolCalls.has(callId)) {
        return;
      }
      startedGenerateImageToolCalls.add(callId);
      await args.callbacks?.onToolCall?.({
        callId,
        tool: 'generate_image',
        arguments: toolArguments,
      });
      await args.callbacks?.onToolProgress?.({
        callId,
        tool: 'generate_image',
        message: '正在生成图片',
        status: 'running',
      });
    };

    const updateGenerateImageToolProgress = async (
      callId: string,
      message: string,
    ) => {
      if (!startedGenerateImageToolCalls.has(callId)) {
        await ensureGenerateImageToolStarted(callId, { prompt: args.currentPrompt });
      }
      await args.callbacks?.onToolProgress?.({
        callId,
        tool: 'generate_image',
        message,
        status: 'running',
      });
    };

    await this.streamWithRetry({
      signal: args.signal,
      body: {
        model: args.turnConfig?.model ?? this.config.OPENAI_MODEL,
        instructions: args.instructions,
        input: args.inputItems,
        tools: args.tools,
        parallel_tool_calls: true,
        max_output_tokens: args.turnConfig?.maxOutputTokens ?? this.config.LLM_MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: 'text',
          },
          verbosity: 'medium',
        },
        reasoning: this.buildReasoning(args.turnConfig),
      },
      onEvent: async (event) => {
        const dataRecord = isOpenAIResponsesRecord(event.data) ? event.data : null;
        const eventItem = dataRecord && isOpenAIResponsesRecord(dataRecord.item) ? dataRecord.item : null;

        switch (event.event) {
          case 'response.output_text.delta':
            if (dataRecord && typeof dataRecord.delta === 'string') {
              textDeltas.push(dataRecord.delta);
              await args.callbacks?.onTextDelta?.(dataRecord.delta);
            }
            return;
          case 'response.reasoning_summary_text.delta':
          case 'response.reasoning_text.delta':
            if (dataRecord && typeof dataRecord.delta === 'string') {
              await args.callbacks?.onReasoningDelta?.({
                content: dataRecord.delta,
                summaryIndex: typeof dataRecord.summary_index === 'number' ? dataRecord.summary_index : undefined,
              });
            }
            return;
          case 'response.output_item.added':
            if (!eventItem || typeof eventItem.type !== 'string') {
              return;
            }
            if (eventItem.type === 'image_generation_call') {
              const callId = resolveStreamItemCallId(eventItem, dataRecord, localToolCalls.length + 1);
              await ensureGenerateImageToolStarted(callId, { prompt: args.currentPrompt });
              return;
            }
            if (isGenerateImageFunctionCall(eventItem)) {
              const callId = resolveStreamItemCallId(eventItem, dataRecord, localToolCalls.length + 1);
              await ensureGenerateImageToolStarted(
                callId,
                parseJsonArguments(eventItem.arguments),
              );
            }
            return;
          case 'response.image_generation_call.in_progress':
            if (dataRecord) {
              const callId = resolveStreamItemCallId(null, dataRecord, localToolCalls.length + 1);
              await updateGenerateImageToolProgress(callId, '正在准备生图…');
            }
            return;
          case 'response.image_generation_call.generating':
            if (dataRecord) {
              const callId = resolveStreamItemCallId(null, dataRecord, localToolCalls.length + 1);
              await updateGenerateImageToolProgress(callId, '正在绘制图片…');
            }
            return;
          case 'response.output_item.done':
            if (!dataRecord || !eventItem || typeof eventItem.type !== 'string') {
              return;
            }
            if (shouldReplayCompletedItem(eventItem)) {
              completedItems.push(eventItem);
            }
            if (eventItem.type === 'image_generation_call') {
              const callId = resolveStreamItemCallId(eventItem, dataRecord, localToolCalls.length + 1);
              const prompt = args.currentPrompt;
              await ensureGenerateImageToolStarted(callId, { prompt });

              const emitImageToolSuccess = async (savedImage: {
                model: string;
                operation: 'generate' | 'edit';
                file: FileRecord;
                prompt: string;
                revisedPrompt?: string;
                inputFileIds?: string[];
                source: 'responses_tool' | 'images_generate_api';
              }) => {
                await args.callbacks?.onToolResult?.({
                  callId,
                  tool: 'generate_image',
                  summary: `已通过 ${savedImage.model} 生成图片`,
                  content: [
                    `提示词：${savedImage.prompt}`,
                    savedImage.revisedPrompt ? `优化后提示词：${savedImage.revisedPrompt}` : '',
                    `模型：${savedImage.model}`,
                    `文件：${savedImage.file.displayName}`,
                  ].filter(Boolean).join('\n\n'),
                });
                await args.callbacks?.onImageGenerated?.({
                  source: savedImage.source,
                  model: savedImage.model,
                  operation: savedImage.operation,
                  file: savedImage.file,
                  prompt: savedImage.prompt,
                  revisedPrompt: savedImage.revisedPrompt,
                  inputFileIds: savedImage.inputFileIds,
                });
              };

              try {
                const base64Image = readImageGenerationResult(eventItem.result);
                if (!base64Image) {
                  throw new Error('图片生成工具未返回可用图片');
                }
                const savedImage = await this.openAIImageService.saveResponsesImageToolResult({
                  userId: args.userId,
                  sessionId: args.sessionId,
                  prompt,
                  base64Image,
                  revisedPrompt: typeof eventItem.revised_prompt === 'string' ? eventItem.revised_prompt : undefined,
                  inputFileIds: args.currentInputFileIds,
                });
                await emitImageToolSuccess({
                  ...savedImage,
                  source: 'responses_tool',
                });
              } catch (nativeError) {
                if (!this.imageOrchestrator) {
                  const message = nativeError instanceof Error ? nativeError.message : String(nativeError);
                  await args.callbacks?.onToolResult?.({
                    callId,
                    tool: 'generate_image',
                    summary: `图片生成失败：${message}`,
                    content: message,
                  });
                  throw nativeError;
                }
                const savedImage = await this.imageOrchestrator.generate({
                  userId: args.userId,
                  sessionId: args.sessionId,
                  request: {
                    prompt,
                  },
                });
                await emitImageToolSuccess({
                  ...savedImage,
                  source: 'images_generate_api',
                });
              }
            }
            if (eventItem.type === 'function_call') {
              const callId = typeof eventItem.call_id === 'string' && eventItem.call_id
                ? eventItem.call_id
                : typeof eventItem.id === 'string' && eventItem.id
                  ? eventItem.id
                  : `call_${localToolCalls.length + 1}`;

              localToolCalls.push({
                tool: String(eventItem.name ?? ''),
                arguments: parseJsonArguments(eventItem.arguments),
                callId,
              });
            }
            return;
          case 'response.completed':
            tokenUsage = readTokenUsage(dataRecord);
            if (tokenUsage && this.config.ENABLE_TOKEN_TRACKING) {
              await args.callbacks?.onTokenUsage?.(tokenUsage);
            }
            return;
          case 'response.failed':
          case 'response.incomplete':
            throw new HarnessError(
              'stream_disconnected',
              typeof dataRecord?.message === 'string' ? dataRecord.message : `响应异常结束：${event.event}`,
              true,
            );
          default:
            return;
        }
      },
    });

    return {
      textDeltas,
      completedItems,
      localToolCalls,
      needsFollowUp: localToolCalls.length > 0,
      tokenUsage,
    };
  }

  private async streamWithRetry(args: {
    signal?: AbortSignal;
    body: Record<string, unknown>;
    onEvent: (event: { event: string; data: unknown }) => Promise<void>;
  }) {
    const maxRetries = this.config.STREAM_MAX_RETRIES;
    let transport: 'sse' | 'http' = 'sse';

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      let sawEvent = false;

      try {
        for await (const event of streamOpenAIResponsesEvents({
          apiKey: this.apiKey,
          baseUrl: this.baseUrl,
          timeoutMs: Math.max(this.config.LLM_REQUEST_TIMEOUT_MS, REPLY_STREAM_IDLE_TIMEOUT_MS),
          signal: args.signal,
          body: args.body,
        })) {
          sawEvent = true;
          await args.onEvent(event);
        }
        return;
      } catch (error) {
        const harnessError = toHarnessError(error);
        if (harnessError.kind === 'turn_aborted') {
          throw harnessError;
        }

        const canRetry = attempt < maxRetries - 1 && (harnessError.retryable || !sawEvent);
        if (!canRetry) {
          throw harnessError;
        }

        if (transport === 'sse' && harnessError.fallbackTransport === 'http') {
          transport = 'http';
        }

        const delayMs = this.config.NODE_ENV === 'test'
          ? 0
          : harnessError.serverDelayMs
            ?? Math.round(this.config.STREAM_BACKOFF_BASE_MS * (this.config.STREAM_BACKOFF_MULTIPLIER ** attempt));
        await wait(delayMs);
      }
    }
  }

  private async summarizeInputItems(args: {
    inputItems: ResponsesInputItem[];
    signal?: AbortSignal;
  }) {
    if (args.inputItems.length === 0) {
      return '暂无需要压缩的上下文。';
    }

    const textDeltas: string[] = [];

    await this.streamWithRetry({
      signal: args.signal,
      body: {
        model: this.config.OPENAI_MODEL,
        instructions: buildCompactionInstructions(this.config.productName ?? 'HarnessKit'),
        input: args.inputItems,
        tools: [],
        max_output_tokens: Math.min(this.config.LLM_MAX_OUTPUT_TOKENS, 4_096),
        text: {
          format: {
            type: 'text',
          },
          verbosity: 'low',
        },
        reasoning: this.buildReasoning(),
      },
      onEvent: async (event) => {
        const dataRecord = isOpenAIResponsesRecord(event.data) ? event.data : null;
        if (event.event === 'response.output_text.delta' && dataRecord && typeof dataRecord.delta === 'string') {
          textDeltas.push(dataRecord.delta);
        }
      },
    });

    const summary = normalizeText(textDeltas.join(''));
    if (!summary) {
      throw new Error('上下文压缩未返回可用摘要');
    }

    return summary;
  }

  private async maybeCompactContinuationInput(args: {
    inputItems: ResponsesInputItem[];
    currentTurnUserMessages: ResponsesMessageInput[];
    tokenUsage?: TokenUsage;
    signal?: AbortSignal;
    callbacks?: HarnessCallbacks;
  }): Promise<{
    inputItems: ResponsesInputItem[];
    didCompact: boolean;
  }> {
    const estimatedTokens = Math.max(
      estimateResponsesInputTokens(args.inputItems),
      args.tokenUsage?.totalTokens ?? 0,
    );
    const compactLimit = resolveAutoCompactLimitTokens(this.config);

    if (estimatedTokens < compactLimit) {
      return {
        inputItems: args.inputItems,
        didCompact: false,
      };
    }

    const compactionSource = buildResponsesCompactionInput({
      inputItems: args.inputItems,
      maxTokens: resolveCompactionSourceBudgetTokens(this.config),
      stickyMessages: args.currentTurnUserMessages,
    });

    if (compactionSource.input.length === 0) {
      return {
        inputItems: args.inputItems,
        didCompact: false,
      };
    }

    await args.callbacks?.onContextCompactionStart?.({
      scope: 'mid_turn',
      estimatedTokens,
    });

    const summary = await this.summarizeInputItems({
      inputItems: compactionSource.input as ResponsesInputItem[],
      signal: args.signal,
    });
    const summaryMessage = createCompactionSummaryMessage(summary);

    if (!summaryMessage) {
      return {
        inputItems: args.inputItems,
        didCompact: false,
      };
    }

    const lastUserIndex = args.currentTurnUserMessages.map((item) => item.role).lastIndexOf('user');
    if (lastUserIndex < 0) {
      return {
        inputItems: [...args.currentTurnUserMessages, summaryMessage] as ResponsesInputItem[],
        didCompact: true,
      };
    }

    return {
      inputItems: [
        ...args.currentTurnUserMessages.slice(0, lastUserIndex),
        summaryMessage,
        ...args.currentTurnUserMessages.slice(lastUserIndex),
      ] as ResponsesInputItem[],
      didCompact: true,
    };
  }
}
