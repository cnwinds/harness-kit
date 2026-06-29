// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { TextMessageEvent } from '@harnesskit/protocol';
import { useSessionStream } from './useSessionStream.js';
import { useStreamUiStore } from '../store/stream-ui-store.js';
import {
  clearHarnessChatTestContext,
  defaultHarnessChatTestContext,
  setHarnessChatTestContext,
} from '../test-context.js';

vi.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: vi.fn(),
}));

const fetchEventSourceMock = vi.mocked(fetchEventSource);

type StreamHandlers = {
  onopen?: (response: Response) => Promise<void> | void;
  onmessage?: (event: { id?: string; event?: string; data?: string }) => void;
  onclose?: () => Promise<void> | void;
  onerror?: (error: unknown) => unknown;
};

const createQueryWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { Wrapper, queryClient };
};

const installStreamMock = (handlers: {
  onInstall?: (handlers: StreamHandlers) => void;
  /** Keep the SSE connection open after onopen (default for message-driven tests). */
  hang?: boolean;
  closeOnOpen?: boolean;
  /** After the first close, block the next connection attempt so reconnect state stays visible. */
  hangOnReconnect?: boolean;
}) => {
  let connectCount = 0;

  fetchEventSourceMock.mockImplementation(async (_url, init) => {
    connectCount += 1;
    const streamHandlers = init as StreamHandlers;

    if (handlers.hangOnReconnect && connectCount > 1) {
      await new Promise<void>(() => undefined);
      return;
    }

    handlers.onInstall?.(streamHandlers);
    await streamHandlers.onopen?.(new Response(null, { status: 200 }));

    if (handlers.closeOnOpen) {
      await streamHandlers.onclose?.();
      return;
    }

    if (handlers.hang !== false) {
      await new Promise<void>(() => undefined);
    }
  });
};

describe('useSessionStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStreamUiStore.setState({ streams: {} });
    clearHarnessChatTestContext();
    setHarnessChatTestContext({
      ...defaultHarnessChatTestContext(),
      auth: {
        user: { id: 'u1', username: 'member', role: 'member' },
        ready: true,
      },
    });
    installStreamMock({ hang: true });
  });

  afterEach(() => {
    clearHarnessChatTestContext();
  });

  it('opens the session stream when auth is ready', async () => {
    const { unmount } = renderHook(() => useSessionStream('s1'), { wrapper: createQueryWrapper().Wrapper });

    await waitFor(() => {
      expect(fetchEventSourceMock).toHaveBeenCalledWith(
        '/api/sessions/s1/stream',
        expect.objectContaining({ credentials: 'include' }),
      );
    });
    unmount();
  });

  it('appends pending text when text_delta arrives', async () => {
    let handleMessage: StreamHandlers['onmessage'];

    installStreamMock({
      onInstall: (handlers) => {
        handleMessage = handlers.onmessage;
      },
    });

    const { unmount } = renderHook(() => useSessionStream('s1'), { wrapper: createQueryWrapper().Wrapper });

    await waitFor(() => expect(handleMessage!).toBeDefined());

    act(() => {
      handleMessage?.({
        id: 'evt_1',
        event: 'text_delta',
        data: JSON.stringify({ content: 'Hello' }),
      });
    });

    expect(useStreamUiStore.getState().streams.s1?.pendingText).toBe('Hello');
    unmount();
  });

  it('keeps session stream state when the hook switches away and back', async () => {
    useStreamUiStore.getState().hydrateRuntime('s1', {
      sessionId: 's1',
      activeTurn: {
        turnId: 'turn_1',
        kind: 'regular',
        status: 'running',
        phase: 'sampling',
        phaseStartedAt: '2026-04-12T00:00:30.000Z',
        canSteer: true,
        startedAt: '2026-04-12T00:00:00.000Z',
        round: 2,
      },
      followUpQueue: [],
      recovery: null,
    });

    const { rerender, unmount } = renderHook(
      ({ sessionId }: { sessionId: string | null }) => useSessionStream(sessionId),
      {
        initialProps: { sessionId: 's1' as string | null },
        wrapper: createQueryWrapper().Wrapper,
      },
    );

    await waitFor(() => expect(fetchEventSourceMock).toHaveBeenCalled());

    rerender({ sessionId: 's2' });
    rerender({ sessionId: 's1' });

    const stream = useStreamUiStore.getState().streams.s1;
    expect(stream?.activeTurnId).toBe('turn_1');
    expect(stream?.activeTurnPhase).toBe('sampling');
    expect(stream?.activeTurnRound).toBe(2);
    unmount();
  });

  it('marks the stream as reconnecting after the connection closes', async () => {
    installStreamMock({ closeOnOpen: true, hangOnReconnect: true });

    const { unmount } = renderHook(() => useSessionStream('s1'), { wrapper: createQueryWrapper().Wrapper });

    await waitFor(() => {
      expect(useStreamUiStore.getState().streams.s1?.status).toBe('reconnecting');
      expect(useStreamUiStore.getState().streams.s1?.reconnectAttempt).toBe(1);
    });
    unmount();
  });

  it('clears the active turn when done arrives before turn_completed', async () => {
    let handleMessage: StreamHandlers['onmessage'];

    installStreamMock({
      onInstall: (handlers) => {
        handleMessage = handlers.onmessage;
      },
    });

    useStreamUiStore.getState().hydrateRuntime('s1', {
      sessionId: 's1',
      activeTurn: {
        turnId: 'turn_1',
        kind: 'regular',
        status: 'running',
        phase: 'streaming_assistant',
        phaseStartedAt: '2026-04-12T00:00:04.000Z',
        canSteer: true,
        startedAt: '2026-04-12T00:00:04.000Z',
        round: 1,
      },
      followUpQueue: [],
      recovery: null,
    });

    const { unmount } = renderHook(() => useSessionStream('s1'), { wrapper: createQueryWrapper().Wrapper });

    await waitFor(() => expect(handleMessage).toBeDefined());

    act(() => {
      handleMessage?.({ id: 'evt_done', event: 'done', data: '{}' });
    });

    expect(useStreamUiStore.getState().streams.s1?.activeTurnId).toBeNull();
    unmount();
  });

  it('replaces optimistic user messages in the query cache on user_message_committed', async () => {
    let handleMessage: StreamHandlers['onmessage'];
    const { Wrapper, queryClient } = createQueryWrapper();

    installStreamMock({
      onInstall: (handlers) => {
        handleMessage = handlers.onmessage;
      },
    });

    const optimisticMessage: TextMessageEvent = {
      id: 'optimistic-1',
      sessionId: 's1',
      kind: 'message',
      role: 'user',
      type: 'text',
      content: '帮我分析志愿',
      createdAt: '2026-04-12T00:00:00.500Z',
    };

    queryClient.setQueryData(['messages', 's1'], [optimisticMessage]);

    const { unmount } = renderHook(() => useSessionStream('s1'), { wrapper: Wrapper });

    await waitFor(() => expect(handleMessage).toBeDefined());

    act(() => {
      handleMessage?.({
        id: 'evt_commit',
        event: 'user_message_committed',
        data: JSON.stringify({
          turnId: 'turn_1',
          inputId: 'input_1',
          content: optimisticMessage.content,
          createdAt: '2026-04-12T00:00:01.000Z',
        }),
      });
    });

    const messages = queryClient.getQueryData<TextMessageEvent[]>(['messages', 's1']) ?? [];
    expect(messages).toHaveLength(1);
    expect(messages[0]?.id).toBe('committed-input_1');
    expect(messages[0]?.content).toBe(optimisticMessage.content);
    unmount();
  });

  it('trims pending assistant text when assistant_message_committed matches the stream buffer', async () => {
    let handleMessage: StreamHandlers['onmessage'];

    installStreamMock({
      onInstall: (handlers) => {
        handleMessage = handlers.onmessage;
      },
    });

    const { unmount } = renderHook(() => useSessionStream('s1'), { wrapper: createQueryWrapper().Wrapper });

    await waitFor(() => expect(handleMessage!).toBeDefined());

    act(() => {
      handleMessage?.({
        id: 'evt_delta',
        event: 'text_delta',
        data: JSON.stringify({ content: '最终建议。' }),
      });
      handleMessage?.({
        id: 'evt_assistant',
        event: 'assistant_message_committed',
        data: JSON.stringify({
          turnId: 'turn_1',
          message: {
            id: 'msg_1',
            kind: 'message',
            role: 'assistant',
            type: 'text',
            content: '最终建议。',
            createdAt: '2026-04-12T00:00:04.000Z',
          },
        }),
      });
    });

    expect(useStreamUiStore.getState().streams.s1?.pendingText).toBe('');
    unmount();
  });
});
