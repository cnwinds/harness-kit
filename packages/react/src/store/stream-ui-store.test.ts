import { beforeEach, describe, expect, it } from 'vitest';
import type { SessionRuntimeSnapshot } from '@harnesskit/protocol';
import { useStreamUiStore } from './stream-ui-store.js';

const snapshot: SessionRuntimeSnapshot = {
  sessionId: 's1',
  activeTurn: {
    turnId: 'turn_1',
    kind: 'regular',
    status: 'running',
    phase: 'model',
    phaseStartedAt: '2026-04-13T10:00:00.000Z',
    startedAt: '2026-04-13T10:00:00.000Z',
    canSteer: true,
    round: 1,
  },
  followUpQueue: [{
    inputId: 'input_1',
    content: 'queued follow-up',
    createdAt: '2026-04-13T10:00:01.000Z',
  }],
  recovery: null,
};

describe('useStreamUiStore', () => {
  beforeEach(() => {
    useStreamUiStore.setState({ streams: {} });
  });

  it('hydrates runtime snapshot into session stream state', () => {
    useStreamUiStore.getState().hydrateRuntime('s1', snapshot);

    const stream = useStreamUiStore.getState().streams.s1;
    expect(stream?.activeTurnId).toBe('turn_1');
    expect(stream?.activeTurnCanSteer).toBe(true);
    expect(stream?.followUpQueue).toHaveLength(1);
    expect(stream?.followUpQueue[0]?.content).toBe('queued follow-up');
  });

  it('accumulates pending text deltas and clears on reset', () => {
    useStreamUiStore.getState().appendTextDelta('s1', 'Hello');
    useStreamUiStore.getState().appendTextDelta('s1', ' world');

    expect(useStreamUiStore.getState().streams.s1?.pendingText).toBe('Hello world');

    useStreamUiStore.getState().resetStream('s1');
    expect(useStreamUiStore.getState().streams.s1?.pendingText).toBe('');
    expect(useStreamUiStore.getState().streams.s1?.status).toBe('idle');
  });
});
