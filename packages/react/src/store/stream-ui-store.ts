import { create } from 'zustand';
import type {
  ErrorEvent,
  RuntimeInputPreview,
  SessionRuntimeRecovery,
  SessionRuntimeSnapshot,
  StoredEvent,
  TokenCountPayload,
  TextMessageEvent,
  ThinkingEvent,
  ToolCallEvent,
  ToolProgressEvent,
  ToolResultEvent,
  ReasoningSegmentEvent,
  TurnCompletedPayload,
  TurnKind,
  TurnLifecyclePayload,
  TurnPhase,
  TurnStatus,
  UserMessageCommittedPayload,
} from '@harnesskit/protocol';

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error';

export type SessionStreamState = {
  pendingText: string;
  transientEvents: StoredEvent[];
  status: StreamStatus;
  lastError: string | null;
  reconnectAttempt: number | null;
  reconnectLimit: number | null;
  activeTurnId: string | null;
  activeTurnKind: TurnKind | null;
  activeTurnStatus: TurnStatus | null;
  activeTurnPhase: TurnPhase | null;
  activeTurnPhaseStartedAt: string | null;
  activeTurnStartedAt: string | null;
  activeTurnCanSteer: boolean;
  activeTurnRound: number | null;
  activeReasoningSegmentId: string | null;
  reasoningSummary: string;
  currentTurnTokenUsage: TokenCountPayload | null;
  followUpQueue: RuntimeInputPreview[];
  removedFollowUpInputIds: string[];
  recovery: SessionRuntimeRecovery | null;
};

type StreamUiState = {
  streams: Record<string, SessionStreamState>;
  appendTextDelta: (sessionId: string, chunk: string) => void;
  pushThinking: (sessionId: string, event: ThinkingEvent) => void;
  pushToolCall: (sessionId: string, event: ToolCallEvent) => void;
  pushToolProgress: (sessionId: string, event: ToolProgressEvent) => void;
  pushToolResult: (sessionId: string, event: ToolResultEvent) => void;
  appendReasoningDelta: (sessionId: string, content: string, segmentId?: string) => void;
  upsertReasoningSegment: (sessionId: string, event: ReasoningSegmentEvent) => void;
  setCurrentTurnTokenUsage: (sessionId: string, usage: TokenCountPayload) => void;
  pushError: (sessionId: string, event: ErrorEvent) => void;
  setStreamStatus: (
    sessionId: string,
    status: StreamStatus,
    options?: {
      lastError?: string | null;
      reconnectAttempt?: number | null;
      reconnectLimit?: number | null;
    },
  ) => void;
  hydrateRuntime: (sessionId: string, snapshot: SessionRuntimeSnapshot) => void;
  applyTurnStarted: (sessionId: string, payload: TurnLifecyclePayload) => void;
  applyTurnStatus: (sessionId: string, payload: TurnLifecyclePayload) => void;
  applyAssistantMessageCommitted: (sessionId: string, message: TextMessageEvent) => void;
  applyUserMessageCommitted: (sessionId: string, payload: UserMessageCommittedPayload) => void;
  applyTurnCompleted: (sessionId: string, payload: TurnCompletedPayload) => void;
  clearActiveTurn: (sessionId: string) => void;
  confirmRemovedFollowUpInput: (sessionId: string, inputId: string) => void;
  clearStreamContent: (sessionId: string) => void;
  resetStream: (sessionId: string) => void;
};

const emptyStream = (): SessionStreamState => ({
  pendingText: '',
  transientEvents: [],
  status: 'idle',
  lastError: null,
  reconnectAttempt: null,
  reconnectLimit: null,
  activeTurnId: null,
  activeTurnKind: null,
  activeTurnStatus: null,
  activeTurnPhase: null,
  activeTurnPhaseStartedAt: null,
  activeTurnStartedAt: null,
  activeTurnCanSteer: false,
  activeTurnRound: null,
  activeReasoningSegmentId: null,
  reasoningSummary: '',
  currentTurnTokenUsage: null,
  followUpQueue: [],
  removedFollowUpInputIds: [],
  recovery: null,
});

const filterFollowUpQueue = (queue: RuntimeInputPreview[], removedInputIds: string[]) => (
  removedInputIds.length === 0
    ? queue
    : queue.filter((input) => !removedInputIds.includes(input.inputId))
);

const createReasoningSegmentId = () => `reasoning_${crypto.randomUUID()}`;

const shouldIgnoreStaleIdleSnapshot = (
  current: SessionStreamState,
  snapshot: SessionRuntimeSnapshot,
) => (
  snapshot.activeTurn === null &&
  snapshot.followUpQueue.length === 0 &&
  snapshot.recovery === null &&
  (
    current.activeTurnId !== null ||
    current.pendingText.length > 0 ||
    current.transientEvents.length > 0
  )
);

const mutateStream = (
  streams: Record<string, SessionStreamState>,
  sessionId: string,
  updater: (current: SessionStreamState) => SessionStreamState,
) => ({
  ...streams,
  [sessionId]: updater(streams[sessionId] ?? emptyStream()),
});

const clearActiveTurnFields = (current: SessionStreamState): SessionStreamState => ({
  ...current,
  activeTurnId: null,
  activeTurnKind: null,
  activeTurnStatus: null,
  activeTurnPhase: null,
  activeTurnPhaseStartedAt: null,
  activeTurnCanSteer: false,
  activeTurnRound: null,
});

const trimCommittedAssistantText = (pendingText: string, committedContent: string) => {
  if (!committedContent) {
    return pendingText;
  }
  if (pendingText.startsWith(committedContent)) {
    return pendingText.slice(committedContent.length);
  }
  return pendingText === committedContent ? '' : pendingText;
};

export const useStreamUiStore = create<StreamUiState>((set) => ({
  streams: {},
  appendTextDelta: (sessionId, chunk) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => {
      const transientEvents = current.transientEvents.some((event) => event.kind === 'thinking')
        ? current.transientEvents.filter((event) => event.kind !== 'thinking')
        : current.transientEvents;
      return {
        ...current,
        pendingText: `${current.pendingText}${chunk}`,
        transientEvents,
        lastError: null,
      };
    }),
  })),
  pushThinking: (sessionId, event) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      transientEvents: [...current.transientEvents, event],
      lastError: null,
    })),
  })),
  pushToolCall: (sessionId, event) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      transientEvents: [...current.transientEvents, event],
      activeReasoningSegmentId: null,
      lastError: null,
    })),
  })),
  pushToolProgress: (sessionId, event) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      transientEvents: [...current.transientEvents, event],
      lastError: null,
    })),
  })),
  pushToolResult: (sessionId, event) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      transientEvents: [...current.transientEvents, event],
      lastError: null,
    })),
  })),
  appendReasoningDelta: (sessionId, content, segmentId) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => {
      if (!content) {
        return current;
      }

      const resolvedSegmentId = segmentId ?? current.activeReasoningSegmentId ?? createReasoningSegmentId();
      const transientEvents = [...current.transientEvents];
      const existingIndex = transientEvents.findIndex(
        (event) => event.kind === 'reasoning_segment' && event.id === resolvedSegmentId,
      );

      if (existingIndex >= 0) {
        const existing = transientEvents[existingIndex] as ReasoningSegmentEvent;
        transientEvents[existingIndex] = {
          ...existing,
          content: `${existing.content}${content}`,
        };
      } else {
        transientEvents.push({
          id: resolvedSegmentId,
          sessionId,
          kind: 'reasoning_segment',
          content,
          createdAt: new Date().toISOString(),
        });
      }

      return {
        ...current,
        transientEvents,
        activeReasoningSegmentId: resolvedSegmentId,
        lastError: null,
      };
    }),
  })),
  upsertReasoningSegment: (sessionId, event) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => {
      const transientEvents = [...current.transientEvents];
      const existingIndex = transientEvents.findIndex(
        (item) => item.kind === 'reasoning_segment' && item.id === event.id,
      );

      if (existingIndex >= 0) {
        transientEvents[existingIndex] = event;
      } else if (event.content.trim()) {
        transientEvents.push(event);
      }

      return {
        ...current,
        transientEvents,
        activeReasoningSegmentId: null,
        lastError: null,
      };
    }),
  })),
  setCurrentTurnTokenUsage: (sessionId, usage) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      currentTurnTokenUsage: usage,
      lastError: null,
    })),
  })),
  pushError: (sessionId, event) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      transientEvents: [...current.transientEvents, event],
      lastError: event.message,
    })),
  })),
  setStreamStatus: (sessionId, status, options) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      status,
      lastError: options?.lastError ?? null,
      reconnectAttempt: options?.reconnectAttempt ?? null,
      reconnectLimit: options?.reconnectLimit ?? null,
    })),
  })),
  hydrateRuntime: (sessionId, snapshot) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...(shouldIgnoreStaleIdleSnapshot(current, snapshot)
        ? current
        : {
          ...current,
          pendingText: snapshot.activeTurn ? current.pendingText : '',
          transientEvents: snapshot.activeTurn ? current.transientEvents : [],
          activeTurnId: snapshot.activeTurn?.turnId ?? null,
          activeTurnKind: snapshot.activeTurn?.kind ?? null,
          activeTurnStatus: snapshot.activeTurn?.status ?? null,
          activeTurnPhase: snapshot.activeTurn?.phase ?? null,
          activeTurnPhaseStartedAt: snapshot.activeTurn?.phaseStartedAt ?? null,
          activeTurnStartedAt: snapshot.activeTurn?.startedAt ?? null,
          activeTurnCanSteer: snapshot.activeTurn?.canSteer ?? false,
          activeTurnRound: snapshot.activeTurn?.round ?? null,
          followUpQueue: filterFollowUpQueue(snapshot.followUpQueue, current.removedFollowUpInputIds),
          recovery: snapshot.recovery,
        }),
    })),
  })),
  applyTurnStarted: (sessionId, payload) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      activeTurnId: payload.turnId,
      activeTurnKind: payload.kind,
      activeTurnStatus: payload.status,
      activeTurnPhase: payload.phase,
      activeTurnPhaseStartedAt: payload.phaseStartedAt,
      activeTurnStartedAt: payload.startedAt ?? current.activeTurnStartedAt,
      activeTurnCanSteer: payload.canSteer,
      activeTurnRound: payload.round,
      activeReasoningSegmentId: null,
      reasoningSummary: '',
      currentTurnTokenUsage: null,
      pendingText: '',
      transientEvents: payload.turnId === current.activeTurnId ? current.transientEvents : [],
      recovery: null,
    })),
  })),
  applyTurnStatus: (sessionId, payload) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => {
      if (current.activeTurnId && current.activeTurnId !== payload.turnId) {
        return current;
      }

      return {
        ...current,
        activeTurnId: payload.turnId,
        activeTurnKind: payload.kind,
        activeTurnStatus: payload.status,
        activeTurnPhase: payload.phase,
        activeTurnPhaseStartedAt: payload.phaseStartedAt,
        activeTurnStartedAt: payload.startedAt ?? current.activeTurnStartedAt,
        activeTurnCanSteer: payload.canSteer,
        activeTurnRound: payload.round,
      };
    }),
  })),
  applyAssistantMessageCommitted: (sessionId, message) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      pendingText: trimCommittedAssistantText(current.pendingText, message.content),
    })),
  })),
  applyUserMessageCommitted: (sessionId, payload) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      followUpQueue: current.followUpQueue.filter((input) => !(
        payload.consumedInputIds?.includes(input.inputId) ?? input.inputId === payload.inputId
      )),
      removedFollowUpInputIds: current.removedFollowUpInputIds.filter((inputId) => !(
        payload.consumedInputIds?.includes(inputId) ?? inputId === payload.inputId
      )),
    })),
  })),
  applyTurnCompleted: (sessionId, payload) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => {
      if (current.activeTurnId !== payload.turnId) {
        return current;
      }

      return {
        ...clearActiveTurnFields(current),
        activeTurnStatus: payload.status,
      };
    }),
  })),
  clearActiveTurn: (sessionId) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => clearActiveTurnFields(current)),
  })),
  confirmRemovedFollowUpInput: (sessionId, inputId) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      followUpQueue: current.followUpQueue.filter((input) => input.inputId !== inputId),
      removedFollowUpInputIds: current.removedFollowUpInputIds.includes(inputId)
        ? current.removedFollowUpInputIds
        : [...current.removedFollowUpInputIds, inputId],
    })),
  })),
  clearStreamContent: (sessionId) => set((state) => ({
    streams: mutateStream(state.streams, sessionId, (current) => ({
      ...current,
      pendingText: '',
      transientEvents: [],
      activeTurnStartedAt: null,
      activeReasoningSegmentId: null,
      reasoningSummary: '',
      currentTurnTokenUsage: null,
      lastError: null,
    })),
  })),
  resetStream: (sessionId) => set((state) => ({
    streams: {
      ...state.streams,
      [sessionId]: emptyStream(),
    },
  })),
}));
