import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { StoredEvent, TextMessageEvent } from '@harnesskit/protocol';
import { useHarnessChatContext } from '../provider.js';
import { useStreamUiStore } from '../store/stream-ui-store.js';

const STREAM_RECONNECT_LIMIT = 5;
const STREAM_RECONNECT_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 1200;

const getStreamClearSignature = (sessionId: string) => {
  const current = useStreamUiStore.getState().streams[sessionId];
  const lastTransientEvent = current?.transientEvents[current.transientEvents.length - 1];
  return {
    activeTurnId: current?.activeTurnId ?? null,
    pendingText: current?.pendingText ?? '',
    transientEventCount: current?.transientEvents.length ?? 0,
    lastTransientEventId: lastTransientEvent?.id ?? null,
  };
};

const delay = async (ms: number, signal: AbortSignal) => {
  if (ms <= 0 || signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timer);
      resolve();
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });
};

export const useSessionStream = (sessionId: string | null) => {
  const { apiBase, credentials, auth } = useHarnessChatContext();
  const user = auth.user;
  const ready = auth.ready;
  const onUnauthorized = auth.onUnauthorized;
  const queryClient = useQueryClient();
  const stream = useStreamUiStore((state) => (sessionId ? state.streams[sessionId] : undefined));
  const appendTextDelta = useStreamUiStore((state) => state.appendTextDelta);
  const pushThinking = useStreamUiStore((state) => state.pushThinking);
  const pushToolCall = useStreamUiStore((state) => state.pushToolCall);
  const pushToolProgress = useStreamUiStore((state) => state.pushToolProgress);
  const pushToolResult = useStreamUiStore((state) => state.pushToolResult);
  const appendReasoningDelta = useStreamUiStore((state) => state.appendReasoningDelta);
  const setCurrentTurnTokenUsage = useStreamUiStore((state) => state.setCurrentTurnTokenUsage);
  const pushError = useStreamUiStore((state) => state.pushError);
  const setStreamStatus = useStreamUiStore((state) => state.setStreamStatus);
  const applyTurnStarted = useStreamUiStore((state) => state.applyTurnStarted);
  const applyTurnStatus = useStreamUiStore((state) => state.applyTurnStatus);
  const applyAssistantMessageCommitted = useStreamUiStore((state) => state.applyAssistantMessageCommitted);
  const applyUserMessageCommitted = useStreamUiStore((state) => state.applyUserMessageCommitted);
  const applyTurnCompleted = useStreamUiStore((state) => state.applyTurnCompleted);
  const clearActiveTurn = useStreamUiStore((state) => state.clearActiveTurn);
  const clearStreamContent = useStreamUiStore((state) => state.clearStreamContent);

  useEffect(() => {
    if (!sessionId || !ready || !user) {
      return;
    }

    const controller = new AbortController();
    const runStream = async () => {
      let reconnectAttempt = 0;

      while (!controller.signal.aborted) {
        setStreamStatus(
          sessionId,
          reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
          reconnectAttempt > 0
            ? {
              reconnectAttempt,
              reconnectLimit: STREAM_RECONNECT_LIMIT,
            }
            : undefined,
        );

        if (reconnectAttempt > 0) {
          await delay(STREAM_RECONNECT_DELAY_MS, controller.signal);
          if (controller.signal.aborted) {
            return;
          }
        }

        let shouldReconnect = false;
        let reconnectMessage = '连接断开';

        try {
          await fetchEventSource(`${apiBase}/sessions/${sessionId}/stream`, {
            signal: controller.signal,
            openWhenHidden: true,
            credentials,
            async onopen(response) {
              if (!response.ok) {
                if (response.status === 401) {
                  onUnauthorized?.();
                }
                throw new Error(`Stream open failed: ${response.status}`);
              }
              const wasReconnect = reconnectAttempt > 0;
              reconnectAttempt = 0;
              setStreamStatus(sessionId, 'open');
              if (wasReconnect) {
                // The server StreamHub does not buffer events for offline
                // subscribers, so anything emitted while we were
                // disconnected (text_delta, file_ready, turn_completed,
                // done, ...) is lost permanently. Pull authoritative state
                // back from REST so the reconciliation effect in ChatPage
                // can clear stuck thinking/timer when the turn already
                // finished server-side.
                void queryClient.invalidateQueries({ queryKey: ['runtime', sessionId] });
                void queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
                void queryClient.invalidateQueries({ queryKey: ['files', sessionId] });
                void queryClient.invalidateQueries({ queryKey: ['sessions'] });
              }
            },
            onmessage(event) {
              if (!event.event) {
                return;
              }

              const payload = event.data ? JSON.parse(event.data) as Record<string, unknown> : {};

              if (event.event === 'text_delta') {
                appendTextDelta(sessionId, String(payload.content ?? ''));
                return;
              }

              if (event.event === 'thinking') {
                pushThinking(sessionId, {
                  id: event.id || crypto.randomUUID(),
                  sessionId,
                  kind: 'thinking',
                  content: String(payload.message ?? '处理中'),
                  createdAt: new Date().toISOString(),
                });
                return;
              }

              if (event.event === 'reasoning_delta') {
                appendReasoningDelta(sessionId, String(payload.content ?? ''));
                return;
              }

              if (event.event === 'token_count') {
                setCurrentTurnTokenUsage(sessionId, {
                  inputTokens: typeof payload.inputTokens === 'number' ? payload.inputTokens : 0,
                  outputTokens: typeof payload.outputTokens === 'number' ? payload.outputTokens : 0,
                  totalTokens: typeof payload.totalTokens === 'number' ? payload.totalTokens : 0,
                  cumulativeInputTokens: typeof payload.cumulativeInputTokens === 'number' ? payload.cumulativeInputTokens : undefined,
                  cumulativeOutputTokens: typeof payload.cumulativeOutputTokens === 'number' ? payload.cumulativeOutputTokens : undefined,
                  cumulativeTotalTokens: typeof payload.cumulativeTotalTokens === 'number' ? payload.cumulativeTotalTokens : undefined,
                });
                return;
              }

              if (event.event === 'tool_start') {
                const skill = (payload.skill as { name?: string; status?: string } | undefined) ?? {};
                pushToolCall(sessionId, {
                  id: event.id || crypto.randomUUID(),
                  sessionId,
                  kind: 'tool_call',
                  callId: typeof payload.callId === 'string' ? payload.callId : undefined,
                  skill: skill.name ?? 'tool',
                  arguments: typeof payload.arguments === 'object' && payload.arguments
                    ? payload.arguments as Record<string, unknown>
                    : {},
                  meta: typeof payload.meta === 'object' && payload.meta
                    ? payload.meta as Record<string, unknown>
                    : undefined,
                  createdAt: new Date().toISOString(),
                });
                return;
              }

              if (event.event === 'tool_progress') {
                const skill = (payload.skill as { name?: string; status?: string } | undefined) ?? {};
                pushToolProgress(sessionId, {
                  id: event.id || crypto.randomUUID(),
                  sessionId,
                  kind: 'tool_progress',
                  callId: typeof payload.callId === 'string' ? payload.callId : undefined,
                  skill: skill.name ?? 'tool',
                  message: String(payload.message ?? '任务执行中'),
                  percent: typeof payload.percent === 'number' ? payload.percent : undefined,
                  status: skill.status,
                  meta: typeof payload.meta === 'object' && payload.meta
                    ? payload.meta as Record<string, unknown>
                    : undefined,
                  createdAt: new Date().toISOString(),
                });
                return;
              }

              if (event.event === 'tool_result') {
                const skill = (payload.skill as { name?: string; status?: string } | undefined) ?? {};
                pushToolResult(sessionId, {
                  id: event.id || crypto.randomUUID(),
                  sessionId,
                  kind: 'tool_result',
                  callId: typeof payload.callId === 'string' ? payload.callId : undefined,
                  skill: skill.name ?? 'tool',
                  message: String(payload.message ?? '工具执行完成'),
                  content: typeof payload.content === 'string' ? payload.content : undefined,
                  meta: typeof payload.meta === 'object' && payload.meta
                    ? payload.meta as Record<string, unknown>
                    : undefined,
                  createdAt: new Date().toISOString(),
                });
                return;
              }

              if (event.event === 'file_ready') {
                void queryClient.invalidateQueries({ queryKey: ['files', sessionId] });
                void queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
                return;
              }

              if (event.event === 'turn_started') {
                applyTurnStarted(sessionId, {
                  turnId: String(payload.turnId ?? ''),
                  kind: (payload.kind as 'regular' | 'review' | 'compact' | 'maintenance' | undefined) ?? 'regular',
                  status: (payload.status as 'running' | 'completed' | 'failed' | 'interrupted' | undefined) ?? 'running',
                  phase: (
                    payload.phase as
                      | 'sampling'
                      | 'tool_call'
                      | 'waiting_tool_result'
                      | 'streaming_assistant'
                      | 'finalizing'
                      | 'non_steerable'
                      | undefined
                  ) ?? 'sampling',
                  phaseStartedAt: typeof payload.phaseStartedAt === 'string'
                    ? payload.phaseStartedAt
                    : (typeof payload.startedAt === 'string' ? payload.startedAt : new Date().toISOString()),
                  canSteer: Boolean(payload.canSteer),
                  startedAt: typeof payload.startedAt === 'string' ? payload.startedAt : undefined,
                  round: typeof payload.round === 'number' ? payload.round : 1,
                  followUpQueueCount: typeof payload.followUpQueueCount === 'number' ? payload.followUpQueueCount : 0,
                });
                return;
              }

              if (event.event === 'turn_status') {
                applyTurnStatus(sessionId, {
                  turnId: String(payload.turnId ?? ''),
                  kind: (payload.kind as 'regular' | 'review' | 'compact' | 'maintenance' | undefined) ?? 'regular',
                  status: (
                    payload.status as
                      | 'running'
                      | 'interrupting'
                      | 'completed'
                      | 'failed'
                      | 'interrupted'
                      | undefined
                  ) ?? 'running',
                  phase: (
                    payload.phase as
                      | 'sampling'
                      | 'tool_call'
                      | 'waiting_tool_result'
                      | 'streaming_assistant'
                      | 'finalizing'
                      | 'non_steerable'
                      | undefined
                  ) ?? 'sampling',
                  phaseStartedAt: typeof payload.phaseStartedAt === 'string'
                    ? payload.phaseStartedAt
                    : (typeof payload.startedAt === 'string' ? payload.startedAt : new Date().toISOString()),
                  canSteer: Boolean(payload.canSteer),
                  startedAt: typeof payload.startedAt === 'string' ? payload.startedAt : undefined,
                  round: typeof payload.round === 'number' ? payload.round : 1,
                  followUpQueueCount: typeof payload.followUpQueueCount === 'number' ? payload.followUpQueueCount : 0,
                });
                return;
              }

              if (event.event === 'assistant_message_committed') {
                const rawMessage = typeof payload.message === 'object' && payload.message
                  ? payload.message as Partial<TextMessageEvent>
                  : null;
                if (
                  !rawMessage ||
                  rawMessage.kind !== 'message' ||
                  rawMessage.role !== 'assistant' ||
                  rawMessage.type !== 'text' ||
                  typeof rawMessage.id !== 'string' ||
                  typeof rawMessage.content !== 'string'
                ) {
                  return;
                }

                const message: TextMessageEvent = {
                  id: rawMessage.id,
                  sessionId,
                  kind: 'message',
                  role: 'assistant',
                  type: 'text',
                  content: rawMessage.content,
                  createdAt: typeof rawMessage.createdAt === 'string' ? rawMessage.createdAt : new Date().toISOString(),
                  meta: rawMessage.meta,
                };

                applyAssistantMessageCommitted(sessionId, message);
                queryClient.setQueryData(['messages', sessionId], (current: StoredEvent[] | undefined) => {
                  const messages = current ?? [];
                  const exists = messages.some((item) => (
                    item.kind === 'message' &&
                    'role' in item &&
                    item.role === 'assistant' &&
                    (
                      item.id === message.id ||
                      (item.content === message.content && item.createdAt === message.createdAt)
                    )
                  ));
                  return exists ? messages : [...messages, message];
                });
                return;
              }

              if (event.event === 'user_message_committed') {
                const inputId = String(payload.inputId ?? '');
                const content = String(payload.content ?? '');
                const createdAt = typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString();
                const consumedInputIds = Array.isArray(payload.consumedInputIds)
                  ? payload.consumedInputIds.filter((value): value is string => typeof value === 'string')
                  : undefined;

                applyUserMessageCommitted(sessionId, {
                  turnId: String(payload.turnId ?? ''),
                  inputId,
                  content,
                  createdAt,
                  consumedInputIds,
                });
                queryClient.setQueryData(['messages', sessionId], (current: StoredEvent[] | undefined) => {
                  const messages = current ?? [];
                  const optimisticFollowUpIds = new Set(
                    [inputId, ...(consumedInputIds ?? [])].map(
                      (pendingInputId) => `optimistic-followup-${pendingInputId}`,
                    ),
                  );
                  const optimisticFollowUpIndexes = messages
                    .map((item, index) => ({
                      item,
                      index,
                    }))
                    .filter(({ item }) => (
                      item.kind === 'message' &&
                      'role' in item &&
                      item.role === 'user' &&
                      optimisticFollowUpIds.has(item.id)
                    ));
                  const exists = messages.some((item) => (
                    item.kind === 'message' &&
                    'role' in item &&
                    item.role === 'user' &&
                    item.type === 'text' &&
                    item.content === content &&
                    item.createdAt === createdAt
                  ));

                  if (optimisticFollowUpIndexes.length > 0) {
                    const firstIndex = optimisticFollowUpIndexes[0]!.index;
                    const optimisticAttachments = optimisticFollowUpIndexes.flatMap(({ item }) =>
                      item.kind === 'message' && 'role' in item && item.role === 'user'
                        ? item.attachments ?? []
                        : [],
                    );
                    const mergedAttachments = optimisticAttachments.filter((attachment, index, attachments) =>
                      attachments.findIndex((candidate) => candidate.id === attachment.id) === index,
                    );
                    const next = messages.filter((item) => !(
                      item.kind === 'message' &&
                      'role' in item &&
                      item.role === 'user' &&
                      optimisticFollowUpIds.has(item.id)
                    ));
                    if (exists) {
                      return next;
                    }
                    next.splice(firstIndex, 0, {
                      id: `committed-${inputId}`,
                      sessionId,
                      kind: 'message',
                      role: 'user',
                      type: 'text',
                      content,
                      createdAt,
                      ...(mergedAttachments.length > 0
                        ? { attachments: mergedAttachments }
                        : {}),
                    });
                    return next;
                  }

                  if (exists) {
                    return messages;
                  }

                  const optimisticIndex = messages.findIndex((item) => (
                    item.kind === 'message' &&
                    'role' in item &&
                    item.role === 'user' &&
                    item.type === 'text' &&
                    item.id.startsWith('optimistic-') &&
                    item.content === content
                  ));
                  if (optimisticIndex >= 0) {
                    const optimistic = messages[optimisticIndex];
                    const optimisticAttachments =
                      optimistic && optimistic.kind === 'message' && 'role' in optimistic && optimistic.role === 'user'
                        ? optimistic.attachments
                        : undefined;
                    const next = [...messages];
                    next[optimisticIndex] = {
                      id: `committed-${inputId}`,
                      sessionId,
                      kind: 'message',
                      role: 'user',
                      type: 'text',
                      content,
                      createdAt,
                      // Preserve the attachments locally so the UI doesn't
                      // flicker until the messages query refetch lands with
                      // the server-side persisted snapshot.
                      ...(optimisticAttachments && optimisticAttachments.length > 0
                        ? { attachments: optimisticAttachments }
                        : {}),
                    };
                    return next;
                  }

                  return [
                    ...messages,
                    {
                      id: `committed-${inputId}`,
                      sessionId,
                      kind: 'message',
                      role: 'user',
                      type: 'text',
                      content,
                      createdAt,
                    },
                  ];
                });
                void queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
                void queryClient.invalidateQueries({ queryKey: ['sessions'] });
                return;
              }

              if (event.event === 'turn_completed') {
                applyTurnCompleted(sessionId, {
                  turnId: String(payload.turnId ?? ''),
                  kind: (payload.kind as 'regular' | 'review' | 'compact' | 'maintenance' | undefined) ?? 'regular',
                  status: (
                    payload.status as
                      | 'running'
                      | 'interrupting'
                      | 'completed'
                      | 'failed'
                      | 'interrupted'
                      | undefined
                  ) ?? 'completed',
                });
                void queryClient.invalidateQueries({ queryKey: ['sessions'] });
                return;
              }

              if (event.event === 'error') {
                pushError(sessionId, {
                  id: event.id || crypto.randomUUID(),
                  sessionId,
                  kind: 'error',
                  message: String(payload.message ?? '处理失败'),
                  createdAt: new Date().toISOString(),
                });
                return;
              }

              if (event.event === 'done') {
                void queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
                void queryClient.invalidateQueries({ queryKey: ['files', sessionId] });
                void queryClient.invalidateQueries({ queryKey: ['sessions'] });
                clearActiveTurn(sessionId);
                const clearSignature = getStreamClearSignature(sessionId);
                window.setTimeout(() => {
                  const latestSignature = getStreamClearSignature(sessionId);
                  if (
                    latestSignature.activeTurnId !== null ||
                    latestSignature.pendingText !== clearSignature.pendingText ||
                    latestSignature.transientEventCount !== clearSignature.transientEventCount ||
                    latestSignature.lastTransientEventId !== clearSignature.lastTransientEventId
                  ) {
                    return;
                  }
                  clearStreamContent(sessionId);
                }, 160);
              }
            },
            onclose() {
              if (controller.signal.aborted) {
                return;
              }
              shouldReconnect = true;
              reconnectMessage = '连接断开';
            },
            onerror(error) {
              if (controller.signal.aborted) {
                return;
              }
              reconnectMessage = error instanceof Error ? error.message : '连接断开';
              throw error;
            },
          });
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          reconnectMessage = error instanceof Error ? error.message : '连接断开';
          shouldReconnect = true;
        }

        if (!shouldReconnect) {
          return;
        }

        if (reconnectAttempt >= STREAM_RECONNECT_LIMIT) {
          setStreamStatus(sessionId, 'error', { lastError: reconnectMessage });
          return;
        }

        reconnectAttempt += 1;
        setStreamStatus(sessionId, 'reconnecting', {
          lastError: reconnectMessage,
          reconnectAttempt,
          reconnectLimit: STREAM_RECONNECT_LIMIT,
        });
      }
    };

    void runStream();

    return () => {
      controller.abort();
      setStreamStatus(sessionId, 'idle');
    };
  }, [
    appendTextDelta,
    appendReasoningDelta,
    applyTurnCompleted,
    applyTurnStarted,
    applyTurnStatus,
    applyAssistantMessageCommitted,
    applyUserMessageCommitted,
    clearActiveTurn,
    clearStreamContent,
    pushError,
    pushThinking,
    pushToolCall,
    pushToolProgress,
    pushToolResult,
    queryClient,
    ready,
    sessionId,
    setCurrentTurnTokenUsage,
    apiBase,
    credentials,
    onUnauthorized,
    setStreamStatus,
    user,
  ]);

  return stream ?? {
    pendingText: '',
    transientEvents: [],
    status: 'idle' as const,
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
    reasoningSummary: '',
    currentTurnTokenUsage: null,
    followUpQueue: [],
    recovery: null,
  };
};
