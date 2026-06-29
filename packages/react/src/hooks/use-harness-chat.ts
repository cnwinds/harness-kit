import { useCallback, useEffect, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type {
  MessageDispatchResponse,
  SessionRuntimeSnapshot,
  SessionSummary,
  SSEEventName,
  StoredEvent,
} from '@skillchat/harness-protocol';
import { useHarnessChatContext } from '../provider.js';
import { applySSEEvent, useStreamStore, type StreamStatus } from '../store/stream-store.js';

const RECONNECT_LIMIT = 5;
const RECONNECT_DELAY_MS = 1200;

export type UseHarnessChatOptions = {
  sessionId?: string | null;
};

export type UseHarnessChatReturn = {
  sessionId: string | null;
  messages: StoredEvent[];
  streamingText: string;
  runtime: SessionRuntimeSnapshot | null;
  streamStatus: StreamStatus;
  send: (content: string, opts?: SendOptions) => Promise<MessageDispatchResponse>;
  interrupt: () => Promise<void>;
  refresh: () => Promise<void>;
};

export type SendOptions = {
  dispatch?: 'auto' | 'new_turn' | 'steer' | 'queue_next';
  attachmentIds?: string[];
};

export const useHarnessChat = (options: UseHarnessChatOptions = {}): UseHarnessChatReturn => {
  const { apiBase, credentials, fetchOptions } = useHarnessChatContext();
  const [sessionId, setSessionId] = useState<string | null>(options.sessionId ?? null);
  const [messages, setMessages] = useState<StoredEvent[]>([]);

  const stream = useStreamStore((s) => (sessionId ? s.streams[sessionId] : undefined));
  const setStreamStatus = useStreamStore((s) => s.setStreamStatus);
  const setRuntime = useStreamStore((s) => s.setRuntime);

  const apiFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`${apiBase}${path}`, {
        credentials,
        ...fetchOptions,
        ...init,
        headers: { 'Content-Type': 'application/json', ...fetchOptions.headers, ...init?.headers },
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      return res.json();
    },
    [apiBase, credentials, fetchOptions],
  );

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const [msgData, rtData] = await Promise.all([
      apiFetch(`/sessions/${sessionId}/messages`) as Promise<{ events: StoredEvent[] }>,
      apiFetch(`/sessions/${sessionId}/runtime`) as Promise<{ runtime: SessionRuntimeSnapshot }>,
    ]);
    setMessages(msgData.events);
    setRuntime(sessionId, rtData.runtime);
  }, [sessionId, apiFetch, setRuntime]);

  useEffect(() => {
    if (options.sessionId !== undefined) {
      setSessionId(options.sessionId);
    }
  }, [options.sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    void refresh();
  }, [sessionId, refresh]);

  useEffect(() => {
    if (!sessionId) return;

    const controller = new AbortController();

    const connect = async () => {
      let attempt = 0;
      while (!controller.signal.aborted && attempt <= RECONNECT_LIMIT) {
        setStreamStatus(sessionId, attempt > 0 ? 'reconnecting' : 'connecting', {
          reconnectAttempt: attempt,
        });

        try {
          await fetchEventSource(`${apiBase}/sessions/${sessionId}/stream`, {
            credentials,
            signal: controller.signal,
            onopen: async (res) => {
              if (!res.ok) throw new Error(`SSE ${res.status}`);
              setStreamStatus(sessionId, 'connected');
            },
            onmessage(ev) {
              const event = ev.event as SSEEventName;
              if (!event || !ev.data) return;
              const data = JSON.parse(ev.data);
              applySSEEvent(sessionId, event, data);
              if (event === 'done' || event === 'turn_completed') {
                void refresh();
              }
            },
            onerror(err) {
              throw err;
            },
          });
          break;
        } catch {
          attempt += 1;
          if (attempt > RECONNECT_LIMIT) {
            setStreamStatus(sessionId, 'error', { reconnectAttempt: attempt });
            break;
          }
          await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
          void refresh();
        }
      }
    };

    void connect();
    return () => controller.abort();
  }, [sessionId, apiBase, credentials, fetchOptions, setStreamStatus, refresh]);

  const send = useCallback(
    async (content: string, opts?: SendOptions) => {
      let sid = sessionId;
      if (!sid) {
        const created = (await apiFetch('/sessions', {
          method: 'POST',
          body: JSON.stringify({ title: content.slice(0, 40) }),
        })) as { session: SessionSummary };
        sid = created.session.id;
        setSessionId(sid);
      }
      const response = (await apiFetch(`/sessions/${sid}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, dispatch: opts?.dispatch, attachmentIds: opts?.attachmentIds }),
      })) as MessageDispatchResponse;
      setRuntime(sid, response.runtime);
      return response;
    },
    [sessionId, apiFetch, setRuntime],
  );

  const interrupt = useCallback(async () => {
    const turnId = stream?.activeTurnId ?? stream?.runtime?.activeTurn?.turnId;
    if (!sessionId || !turnId) return;
    await apiFetch(`/sessions/${sessionId}/turns/${turnId}/interrupt`, { method: 'POST', body: '{}' });
    await refresh();
  }, [sessionId, stream, apiFetch, refresh]);

  return {
    sessionId,
    messages,
    streamingText: stream?.pendingText ?? '',
    runtime: stream?.runtime ?? null,
    streamStatus: stream?.status ?? 'idle',
    send,
    interrupt,
    refresh,
  };
};
