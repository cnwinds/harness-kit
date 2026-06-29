import { beforeEach, describe, expect, it } from 'vitest';
import type { SessionRuntimeSnapshot } from '@skillchat/harness-protocol';
import { useStreamUiStore } from './stream-ui-store.js';

const idleSnapshot = (sessionId: string): SessionRuntimeSnapshot => ({
  sessionId,
  activeTurn: null,
  followUpQueue: [],
  recovery: null,
});

const runningSnapshot = (sessionId: string): SessionRuntimeSnapshot => ({
  sessionId,
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

describe('useStreamUiStore hydration', () => {
  beforeEach(() => {
    useStreamUiStore.setState({ streams: {} });
  });

  it('ignores a stale idle runtime snapshot while a turn is still active locally', () => {
    useStreamUiStore.getState().hydrateRuntime('s1', runningSnapshot('s1'));
    useStreamUiStore.getState().appendTextDelta('s1', 'partial reply');

    useStreamUiStore.getState().hydrateRuntime('s1', idleSnapshot('s1'));

    const stream = useStreamUiStore.getState().streams.s1;
    expect(stream?.activeTurnId).toBe('turn_1');
    expect(stream?.activeTurnPhase).toBe('sampling');
    expect(stream?.pendingText).toBe('partial reply');
  });

  it('restores active turn fields from a running runtime snapshot', () => {
    useStreamUiStore.getState().hydrateRuntime('s1', runningSnapshot('s1'));

    const stream = useStreamUiStore.getState().streams.s1;
    expect(stream?.activeTurnId).toBe('turn_1');
    expect(stream?.activeTurnRound).toBe(2);
    expect(stream?.activeTurnCanSteer).toBe(true);
  });

  it('preserves pending text when a stale idle runtime snapshot arrives with only pending text', () => {
    useStreamUiStore.getState().appendTextDelta('s1', 'orphaned pending');
    useStreamUiStore.getState().hydrateRuntime('s1', idleSnapshot('s1'));

    const stream = useStreamUiStore.getState().streams.s1;
    expect(stream?.pendingText).toBe('orphaned pending');
    expect(stream?.activeTurnId).toBeNull();
  });

  it('records completed turn status on turn_completed', () => {
    useStreamUiStore.getState().hydrateRuntime('s1', runningSnapshot('s1'));

    useStreamUiStore.getState().applyTurnCompleted('s1', {
      turnId: 'turn_1',
      kind: 'regular',
      status: 'completed',
    });

    const stream = useStreamUiStore.getState().streams.s1;
    expect(stream?.activeTurnId).toBeNull();
    expect(stream?.activeTurnStatus).toBe('completed');
  });

  it('clears active turn fields on clearActiveTurn', () => {
    useStreamUiStore.getState().hydrateRuntime('s1', runningSnapshot('s1'));
    useStreamUiStore.getState().clearActiveTurn('s1');

    expect(useStreamUiStore.getState().streams.s1?.activeTurnId).toBeNull();
  });
});
