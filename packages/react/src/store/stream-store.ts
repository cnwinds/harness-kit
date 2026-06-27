import { create } from 'zustand';
import type {
  SessionRuntimeSnapshot,
  SSEEventName,
  StoredEvent,
} from '@harnesskit/protocol';

export type StreamStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type SessionStreamState = {
  status: StreamStatus;
  pendingText: string;
  pendingReasoning: string;
  transientEvents: StoredEvent[];
  activeTurnId: string | null;
  runtime: SessionRuntimeSnapshot | null;
  reconnectAttempt: number;
};

const defaultStreamState = (): SessionStreamState => ({
  status: 'idle',
  pendingText: '',
  pendingReasoning: '',
  transientEvents: [],
  activeTurnId: null,
  runtime: null,
  reconnectAttempt: 0,
});

type StreamStore = {
  streams: Record<string, SessionStreamState>;
  ensureStream: (sessionId: string) => void;
  setStreamStatus: (sessionId: string, status: StreamStatus, opts?: { reconnectAttempt?: number }) => void;
  appendTextDelta: (sessionId: string, content: string) => void;
  appendReasoningDelta: (sessionId: string, content: string) => void;
  applyTurnStarted: (sessionId: string, turnId: string) => void;
  applyTurnCompleted: (sessionId: string) => void;
  setRuntime: (sessionId: string, runtime: SessionRuntimeSnapshot) => void;
  clearStreamContent: (sessionId: string) => void;
  resetStream: (sessionId: string) => void;
};

export const useStreamStore = create<StreamStore>((set, get) => ({
  streams: {},

  ensureStream: (sessionId) => {
    if (get().streams[sessionId]) return;
    set((s) => ({ streams: { ...s.streams, [sessionId]: defaultStreamState() } }));
  },

  setStreamStatus: (sessionId, status, opts) => {
    get().ensureStream(sessionId);
    set((s) => ({
      streams: {
        ...s.streams,
        [sessionId]: {
          ...s.streams[sessionId]!,
          status,
          reconnectAttempt: opts?.reconnectAttempt ?? s.streams[sessionId]!.reconnectAttempt,
        },
      },
    }));
  },

  appendTextDelta: (sessionId, content) => {
    get().ensureStream(sessionId);
    set((s) => ({
      streams: {
        ...s.streams,
        [sessionId]: {
          ...s.streams[sessionId]!,
          pendingText: s.streams[sessionId]!.pendingText + content,
        },
      },
    }));
  },

  appendReasoningDelta: (sessionId, content) => {
    get().ensureStream(sessionId);
    set((s) => ({
      streams: {
        ...s.streams,
        [sessionId]: {
          ...s.streams[sessionId]!,
          pendingReasoning: s.streams[sessionId]!.pendingReasoning + content,
        },
      },
    }));
  },

  applyTurnStarted: (sessionId, turnId) => {
    get().ensureStream(sessionId);
    set((s) => ({
      streams: {
        ...s.streams,
        [sessionId]: {
          ...s.streams[sessionId]!,
          activeTurnId: turnId,
          pendingText: '',
          pendingReasoning: '',
        },
      },
    }));
  },

  applyTurnCompleted: (sessionId) => {
    get().ensureStream(sessionId);
    set((s) => ({
      streams: {
        ...s.streams,
        [sessionId]: {
          ...s.streams[sessionId]!,
          activeTurnId: null,
        },
      },
    }));
  },

  setRuntime: (sessionId, runtime) => {
    get().ensureStream(sessionId);
    set((s) => ({
      streams: {
        ...s.streams,
        [sessionId]: { ...s.streams[sessionId]!, runtime },
      },
    }));
  },

  clearStreamContent: (sessionId) => {
    get().ensureStream(sessionId);
    set((s) => ({
      streams: {
        ...s.streams,
        [sessionId]: {
          ...s.streams[sessionId]!,
          pendingText: '',
          pendingReasoning: '',
          transientEvents: [],
        },
      },
    }));
  },

  resetStream: (sessionId) => {
    set((s) => ({
      streams: { ...s.streams, [sessionId]: defaultStreamState() },
    }));
  },
}));

/** Map SSE event to store mutations */
export const applySSEEvent = (
  sessionId: string,
  event: SSEEventName,
  data: unknown,
): void => {
  const store = useStreamStore.getState();

  switch (event) {
    case 'text_delta': {
      const payload = data as { content: string };
      store.appendTextDelta(sessionId, payload.content);
      break;
    }
    case 'reasoning_delta': {
      const payload = data as { content: string };
      store.appendReasoningDelta(sessionId, payload.content);
      break;
    }
    case 'turn_started': {
      const payload = data as { turnId: string };
      store.applyTurnStarted(sessionId, payload.turnId);
      break;
    }
    case 'turn_completed':
      store.applyTurnCompleted(sessionId);
      break;
    case 'done':
      store.clearStreamContent(sessionId);
      break;
    default:
      break;
  }
};
