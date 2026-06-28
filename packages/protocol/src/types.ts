import type {
  DISPATCH_MODES,
  DISPATCH_RESULTS,
  FILE_BUCKETS,
  FILE_SOURCES,
  FILE_VISIBILITIES,
  MESSAGE_KINDS,
  SSE_EVENT_NAMES,
  TURN_KINDS,
  TURN_PHASES,
  TURN_STATUSES,
} from './constants.js';

export type SSEEventName = (typeof SSE_EVENT_NAMES)[number];
export type MessageKind = (typeof MESSAGE_KINDS)[number];
export type FileBucket = (typeof FILE_BUCKETS)[number];
export type FileSource = (typeof FILE_SOURCES)[number];
export type FileVisibility = (typeof FILE_VISIBILITIES)[number];
export type MessageDispatchMode = (typeof DISPATCH_MODES)[number];
export type MessageDispatchResult = (typeof DISPATCH_RESULTS)[number];
export type TurnKind = (typeof TURN_KINDS)[number];
export type TurnStatus = (typeof TURN_STATUSES)[number];
export type TurnPhase = (typeof TURN_PHASES)[number];

export type MessageRole = 'user' | 'assistant' | 'system';

/** Minimal user identity for chat operations — apps extend via AuthResolver */
export interface ChatUser {
  id: string;
  username: string;
  role?: 'admin' | 'member';
}

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  activeSkills: string[];
  metadata?: Record<string, unknown>;
}

export interface FileRecord {
  id: string;
  userId: string;
  sessionId: string | null;
  displayName: string;
  relativePath: string;
  mimeType: string | null;
  size: number;
  bucket: FileBucket;
  source?: FileSource;
  visibility?: FileVisibility;
  createdAt: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
}

export interface StoredEventBase {
  id: string;
  sessionId: string;
  kind: MessageKind;
  createdAt: string;
}

export interface TokenUsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AssistantMessageMeta {
  turnId?: string;
  durationMs?: number;
  tokenUsage?: TokenUsageStats;
  reasoningSummary?: string;
}

export interface TextMessageEvent extends StoredEventBase {
  kind: 'message';
  role: MessageRole;
  type: 'text';
  content: string;
  meta?: AssistantMessageMeta;
  attachments?: FileRecord[];
}

export interface ThinkingEvent extends StoredEventBase {
  kind: 'thinking';
  content: string;
}

export interface ReasoningSegmentEvent extends StoredEventBase {
  kind: 'reasoning_segment';
  content: string;
}

export interface ToolCallEvent extends StoredEventBase {
  kind: 'tool_call';
  callId?: string;
  skill: string;
  arguments: Record<string, unknown>;
  hidden?: boolean;
  meta?: Record<string, unknown>;
}

export interface ToolProgressEvent extends StoredEventBase {
  kind: 'tool_progress';
  callId?: string;
  skill: string;
  message: string;
  percent?: number;
  status?: string;
  hidden?: boolean;
  meta?: Record<string, unknown>;
}

export interface ToolResultEvent extends StoredEventBase {
  kind: 'tool_result';
  callId?: string;
  skill: string;
  message: string;
  content?: string;
  hidden?: boolean;
  meta?: Record<string, unknown>;
}

export interface ImageMessageEvent extends StoredEventBase {
  kind: 'image';
  file: FileRecord;
  operation: 'generate' | 'edit';
  provider: 'openai' | string;
  model: string;
  source?: 'responses_tool' | 'images_generate_api' | 'images_edit_api';
  prompt: string;
  revisedPrompt?: string;
  inputFileIds?: string[];
}

export interface FileEvent extends StoredEventBase {
  kind: 'file';
  file: FileRecord;
}

export interface ErrorEvent extends StoredEventBase {
  kind: 'error';
  message: string;
}

export type StoredEvent =
  | TextMessageEvent
  | ThinkingEvent
  | ReasoningSegmentEvent
  | ToolCallEvent
  | ToolProgressEvent
  | ToolResultEvent
  | ImageMessageEvent
  | FileEvent
  | ErrorEvent;

export interface SSEvent<T = unknown> {
  id: string;
  event: SSEEventName;
  data: T;
}

export interface RuntimeInputPreview {
  inputId: string;
  content: string;
  createdAt: string;
}

export interface ActiveTurnRuntime {
  turnId: string;
  kind: TurnKind;
  status: TurnStatus;
  phase: TurnPhase;
  phaseStartedAt: string;
  canSteer: boolean;
  startedAt: string;
  round: number;
}

export interface SessionRuntimeRecovery {
  recoveredAt: string;
  previousTurnId: string;
  previousTurnKind: TurnKind;
  reason: 'process_restarted';
}

export interface SessionRuntimeSnapshot {
  sessionId: string;
  activeTurn: ActiveTurnRuntime | null;
  followUpQueue: RuntimeInputPreview[];
  recovery: SessionRuntimeRecovery | null;
  tokenUsage?: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    turnCount: number;
    lastUpdatedAt: string;
  } | null;
}

export interface TurnConfig {
  model?: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  maxOutputTokens?: number;
  webSearchMode?: 'disabled' | 'cached' | 'live';
}

export interface MessageDispatchRequest {
  content: string;
  attachmentIds?: string[];
  dispatch?: MessageDispatchMode;
  turnId?: string;
  kind?: TurnKind;
  turnConfig?: TurnConfig;
}

export interface MessageDispatchResponse {
  accepted: boolean;
  dispatch: MessageDispatchResult;
  messageId: string;
  runId: string;
  turnId?: string;
  inputId: string;
  runtime: SessionRuntimeSnapshot;
}

export interface TurnLifecyclePayload {
  turnId: string;
  kind: TurnKind;
  status: TurnStatus;
  phase: TurnPhase;
  phaseStartedAt: string;
  canSteer: boolean;
  startedAt?: string;
  round: number;
  followUpQueueCount: number;
}

export interface TurnCompletedPayload {
  turnId: string;
  kind: TurnKind;
  status: TurnStatus;
}

export interface TurnInterruptResponse {
  accepted: boolean;
  turnId: string;
  runtime: SessionRuntimeSnapshot;
}

export interface FollowUpQueueMutationResponse {
  accepted: boolean;
  inputId: string;
  runtime: SessionRuntimeSnapshot;
}

export interface UserMessageCommittedPayload {
  turnId: string;
  inputId: string;
  content: string;
  createdAt: string;
  consumedInputIds?: string[];
  attachments?: FileRecord[];
}

export interface AssistantMessageCommittedPayload {
  message: TextMessageEvent;
}

export interface ReasoningDeltaPayload {
  content: string;
  summaryIndex?: number;
}

export interface SessionFileContext {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  bucket: FileBucket;
  relativePath: string;
}

export interface TokenCountPayload {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cumulativeInputTokens?: number;
  cumulativeOutputTokens?: number;
  cumulativeTotalTokens?: number;
}

export interface TextDeltaPayload {
  content: string;
}

export interface ErrorPayload {
  message: string;
  code?: string;
}
