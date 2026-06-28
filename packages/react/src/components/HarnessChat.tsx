import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FileRecord, SessionRuntimeSnapshot, SessionSummary, StoredEvent } from '@harnesskit/protocol';
import { useHarnessChatContext } from '../provider.js';
import { useSessionStream } from '../hooks/useSessionStream.js';
import { useAutoScrollToBottom } from '../hooks/useAutoScrollToBottom.js';
import { buildRenderableTimeline } from '../lib/timeline.js';
import {
  formatStreamStatusLine,
  isTurnRunning,
  resolveThinkingEvent,
  shouldRenderPendingText,
} from '../lib/chat-view-helpers.js';
import { MessageItem } from './MessageItem.js';
import { Composer } from './chat/Composer.js';
import { ImagePreviewLightbox } from './chat/ImagePreviewLightbox.js';

export type HarnessChatProps = {
  className?: string;
  sessionId?: string | null;
  placeholder?: string;
};

export const HarnessChat = ({
  className,
  sessionId: controlledSessionId,
  placeholder = '输入消息，Enter 发送…',
}: HarnessChatProps) => {
  const { apiBase, credentials, fetchOptions, filesApi } = useHarnessChatContext();
  const queryClient = useQueryClient();
  const [internalSessionId, setInternalSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sendPending, setSendPending] = useState(false);
  const [interruptPending, setInterruptPending] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const sessionId = controlledSessionId !== undefined ? controlledSessionId : internalSessionId;
  const stream = useSessionStream(sessionId);

  const apiFetch = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(`${apiBase}${path}`, {
        credentials,
        ...fetchOptions,
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
          ...init?.headers,
        },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    [apiBase, credentials, fetchOptions],
  );

  const messagesQuery = useQuery({
    queryKey: ['messages', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const data = await apiFetch(`/sessions/${sessionId}/messages`) as { events: StoredEvent[] };
      return data.events;
    },
  });

  const runtimeQuery = useQuery({
    queryKey: ['runtime', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const data = await apiFetch(`/sessions/${sessionId}/runtime`) as { runtime: SessionRuntimeSnapshot };
      return data.runtime;
    },
  });

  const { items: timeline, activeThinking } = useMemo(
    () => buildRenderableTimeline([...(messagesQuery.data ?? []), ...stream.transientEvents]),
    [messagesQuery.data, stream.transientEvents],
  );

  const thinkingEvent = useMemo(
    () => resolveThinkingEvent(sessionId, stream, activeThinking),
    [sessionId, stream, activeThinking],
  );

  const turnRunning = isTurnRunning(stream);

  const showPendingText = useMemo(
    () => shouldRenderPendingText(stream.pendingText, timeline),
    [stream.pendingText, timeline],
  );

  const messageListRef = useAutoScrollToBottom<HTMLDivElement>([
    timeline,
    thinkingEvent,
    stream.pendingText,
    stream.reasoningSummary,
    pageError,
    sessionId,
  ]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sendPending || interruptPending) {
      return;
    }

    setSendPending(true);
    setPageError(null);
    setDraft('');

    try {
      let activeId = sessionId;
      if (!activeId) {
        const created = await apiFetch('/sessions', {
          method: 'POST',
          body: JSON.stringify({ title: content.slice(0, 40) }),
        }) as { session: SessionSummary };
        activeId = created.session.id;
        if (controlledSessionId === undefined) {
          setInternalSessionId(activeId);
        }
      }

      await apiFetch(`/sessions/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, dispatch: 'new_turn' }),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages', activeId] }),
        queryClient.invalidateQueries({ queryKey: ['runtime', activeId] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
      ]);
    } catch (error) {
      setDraft(content);
      setPageError(error instanceof Error ? error.message : '发送失败');
    } finally {
      setSendPending(false);
    }
  }, [
    apiFetch,
    controlledSessionId,
    draft,
    interruptPending,
    queryClient,
    sendPending,
    sessionId,
  ]);

  const handleInterrupt = useCallback(async () => {
    const turnId = stream.activeTurnId ?? runtimeQuery.data?.activeTurn?.turnId;
    if (!sessionId || !turnId) {
      return;
    }

    setInterruptPending(true);
    setPageError(null);

    try {
      await apiFetch(`/sessions/${sessionId}/turns/${turnId}/interrupt`, {
        method: 'POST',
        body: '{}',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages', sessionId] }),
        queryClient.invalidateQueries({ queryKey: ['runtime', sessionId] }),
      ]);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '中断失败');
    } finally {
      setInterruptPending(false);
    }
  }, [apiFetch, queryClient, runtimeQuery.data?.activeTurn?.turnId, sessionId, stream.activeTurnId]);

  const handleDownload = useCallback(async (file: FileRecord) => {
    if (!filesApi) {
      setPageError('文件下载未配置');
      return;
    }

    setDownloadingFileId(file.id);
    setPageError(null);

    try {
      const blob = await filesApi.fetchFileBlob(file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.displayName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '下载失败');
    } finally {
      setDownloadingFileId(null);
    }
  }, [filesApi]);

  const statusLine = formatStreamStatusLine(stream);
  const showEmptyState = timeline.length === 0 && !showPendingText && !thinkingEvent;

  return (
    <div className={['flex h-full min-h-0 flex-col bg-background text-foreground', className].filter(Boolean).join(' ')}>
      <header className="border-b border-border px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">HarnessKit Chat</div>
            <div className="truncate text-xs text-foreground-muted">{statusLine}</div>
          </div>
          {turnRunning ? (
            <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              处理中
            </span>
          ) : null}
        </div>
      </header>

      <div ref={messageListRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
          {showEmptyState ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
              <h3 className="text-base font-medium">开始对话</h3>
              <p className="mt-2 text-sm text-foreground-muted">
                发送消息后，这里会显示完整时间线：思考状态、工具调用、流式输出与错误提示。
              </p>
            </div>
          ) : null}

          {timeline.map((event) => (
            <div key={event.id} className="scroll-mt-6">
              <MessageItem
                event={event}
                canExpandToolTrace
                onDownload={(file) => void handleDownload(file)}
                downloading={event.kind === 'image' && downloadingFileId === event.file.id}
                streamingReasoningSegmentId={
                  turnRunning ? stream.activeReasoningSegmentId : null
                }
              />
            </div>
          ))}

          {showPendingText ? (
            <MessageItem
              event={{ kind: 'pending_text', content: stream.pendingText }}
              assistantMeta={{
                durationMs: stream.activeTurnStartedAt
                  ? Math.max(0, Date.now() - new Date(stream.activeTurnStartedAt).getTime())
                  : undefined,
                tokenUsage: stream.currentTurnTokenUsage ?? undefined,
              }}
            />
          ) : null}

          {thinkingEvent && !showPendingText ? (
            <MessageItem key={thinkingEvent.id} event={thinkingEvent} />
          ) : null}

          {pageError ? (
            <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
              {pageError}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-border bg-background">
        <div className="mx-auto max-w-3xl">
          <Composer
            value={draft}
            onValueChange={setDraft}
            onSend={() => void handleSend()}
            attachments={[]}
            onSelectFiles={() => undefined}
            isTurnRunning={turnRunning}
            onInterrupt={() => void handleInterrupt()}
            interruptPending={interruptPending}
            sendPending={sendPending}
            placeholder={turnRunning ? '可继续补充，系统会按顺序处理…' : placeholder}
          />
        </div>
      </div>

      <ImagePreviewLightbox />
    </div>
  );
};
