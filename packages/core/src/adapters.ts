import type {
  ChatUser,
  SessionRuntimeSnapshot,
  SessionSummary,
  StoredEvent,
  TurnKind,
  TurnPhase,
} from '@harnesskit/protocol';

/** Published SSE envelope */
export type PublishEvent = {
  id: string;
  event: string;
  data: unknown;
};

export type EventPublisher = {
  publish: (sessionId: string, event: PublishEvent) => void;
  subscribe: (
    sessionId: string,
    handler: (event: PublishEvent) => void,
  ) => () => void;
};

/** Message event log — append-only */
export interface MessageStore {
  append(userId: string, sessionId: string, event: StoredEvent): Promise<void>;
  list(
    userId: string,
    sessionId: string,
    opts?: { limit?: number; after?: string; before?: string },
  ): Promise<StoredEvent[]>;
}

/** Turn runtime persistence */
export interface RuntimePersistence {
  load(userId: string, sessionId: string): Promise<PersistedRuntimeState | null>;
  save(userId: string, sessionId: string, state: PersistedRuntimeState): Promise<void>;
  clear(userId: string, sessionId: string): Promise<void>;
}

/** Context compaction + token usage */
export interface ContextCompactionStore {
  loadSummary(userId: string, sessionId: string): Promise<string | null>;
  saveSummary(userId: string, sessionId: string, summary: string): Promise<void>;
  getTokenUsage(userId: string, sessionId: string): Promise<TokenUsageRecord | null>;
  addTokenUsage(userId: string, sessionId: string, usage: TokenUsageRecord): Promise<void>;
}

export type TokenUsageRecord = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  turnCount: number;
  lastUpdatedAt: string;
};

/** Session metadata CRUD */
export interface SessionStore {
  create(userId: string, input: CreateSessionInput): Promise<SessionSummary>;
  list(userId: string): Promise<SessionSummary[]>;
  get(userId: string, sessionId: string): Promise<SessionSummary | null>;
  update(userId: string, sessionId: string, patch: Partial<SessionSummary>): Promise<SessionSummary>;
  delete(userId: string, sessionId: string): Promise<void>;
}

export type CreateSessionInput = {
  title?: string;
  activeSkills?: string[];
  metadata?: Record<string, unknown>;
};

export type PersistenceBundle = {
  messages: MessageStore;
  runtime: RuntimePersistence;
  context: ContextCompactionStore;
  sessions: SessionStore;
};

/** Auth plugin — resolve HTTP request to chat user */
export interface AuthResolver {
  resolve(request: unknown): Promise<ChatUser | null>;
}

/** File attachment resolution */
export interface FileContextProvider {
  resolveAttachments(
    userId: string,
    sessionId: string,
    attachmentIds: string[],
  ): Promise<FileRef[]>;
}

export type FileRef = {
  id: string;
  displayName: string;
  relativePath: string;
  mimeType: string | null;
  size: number;
};

/** Skill catalog for harness instructions */
export interface SkillCatalogProvider {
  listAvailable(userId: string): Promise<SkillSummary[]>;
  resolveActiveSkills(userId: string, sessionId: string): Promise<string[]>;
  buildInstructions(skillIds: string[]): Promise<string>;
}

export type SkillSummary = {
  id: string;
  name: string;
  description: string;
};

/** Script execution for runtime skills */
export interface ScriptExecutor {
  run(ctx: ScriptRunContext): AsyncIterable<ScriptProgressEvent>;
}

export type ScriptRunContext = {
  userId: string;
  sessionId: string;
  scriptPath: string;
  args: Record<string, unknown>;
  signal: AbortSignal;
};

export type ScriptProgressEvent =
  | { type: 'progress'; message: string; percent?: number }
  | { type: 'artifact'; path: string; displayName?: string }
  | { type: 'result'; content: string; exitCode: number };

// --- Turn Runtime types ---

export type RuntimeInput = {
  inputId: string;
  content: string;
  createdAt: string;
  source: 'direct' | 'steer' | 'queued';
  requestedKind: TurnKind;
  attachmentIds?: string[];
  turnConfig?: import('@harnesskit/protocol').TurnConfig;
};

export type TurnExecutionContext = {
  user: ChatUser;
  sessionId: string;
  turnId: string;
  kind: TurnKind;
  initialInput: RuntimeInput;
  signal: AbortSignal;
  updatePhase: (phase: TurnPhase) => void;
  setCanSteer: (canSteer: boolean) => void;
  setRound: (round: number) => void;
  drainPendingInputs: () => Promise<RuntimeInput[]>;
  isAborted: () => boolean;
  throwIfAborted: () => void;
};

export type TurnDispatchArgs = {
  user: ChatUser;
  sessionId: string;
  content: string;
  attachmentIds?: string[];
  mode?: import('@harnesskit/protocol').MessageDispatchMode;
  turnId?: string;
  kind?: TurnKind;
  turnConfig?: import('@harnesskit/protocol').TurnConfig;
};

export type TurnDispatchResult = {
  response: import('@harnesskit/protocol').MessageDispatchResponse;
  task?: Promise<void>;
};

export type RuntimeCallbacks = {
  onInputCommitted: (args: {
    user: ChatUser;
    sessionId: string;
    turnId: string;
    kind: TurnKind;
    input: RuntimeInput;
  }) => Promise<void>;
  onExecuteTurn: (args: TurnExecutionContext) => Promise<void>;
  onTurnFailure: (args: {
    user: ChatUser;
    sessionId: string;
    turnId: string;
    error: unknown;
  }) => Promise<void>;
  publish: (event: PublishEvent) => void;
};

export type PersistedRuntimeState = {
  activeTurn: PersistedActiveTurn | null;
  followUpQueue: RuntimeInput[];
  recovery: SessionRuntimeSnapshot['recovery'];
};

export type PersistedActiveTurn = {
  turnId: string;
  kind: TurnKind;
  status: import('@harnesskit/protocol').TurnStatus;
  phase: TurnPhase;
  phaseStartedAt: string;
  canSteer: boolean;
  startedAt: string;
  round: number;
  pendingInputs: RuntimeInput[];
};

/** Public Turn Runtime interface */
export interface TurnRuntime {
  dispatchMessage(args: TurnDispatchArgs): Promise<TurnDispatchResult>;
  steer(args: { user: ChatUser; turnId: string; content: string; attachmentIds?: string[] }): Promise<TurnDispatchResult>;
  interrupt(args: { user: ChatUser; turnId: string }): Promise<SessionRuntimeSnapshot>;
  removeQueuedInput(args: { user: ChatUser; inputId: string }): Promise<SessionRuntimeSnapshot>;
  getSnapshot(): SessionRuntimeSnapshot;
  recover(state: PersistedRuntimeState): Promise<void>;
}

export type CreateTurnRuntimeOptions = {
  sessionId: string;
  callbacks: RuntimeCallbacks;
  persistence?: RuntimePersistence;
  userId: string;
};
