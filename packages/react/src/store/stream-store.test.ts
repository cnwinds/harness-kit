import { beforeEach, describe, expect, it } from 'vitest';
import { applySSEEvent, useStreamStore } from './stream-store.js';

describe('applySSEEvent', () => {
  beforeEach(() => {
    useStreamStore.getState().resetStream('s1');
  });

  it('appends text deltas and clears pending text on done', () => {
    applySSEEvent('s1', 'text_delta', { content: 'Hello' });
    applySSEEvent('s1', 'text_delta', { content: ' world' });
    expect(useStreamStore.getState().streams.s1?.pendingText).toBe('Hello world');

    applySSEEvent('s1', 'done', {});
    expect(useStreamStore.getState().streams.s1?.pendingText).toBe('');
  });

  it('resets pending text when a new turn starts', () => {
    applySSEEvent('s1', 'text_delta', { content: 'partial' });
    applySSEEvent('s1', 'turn_started', { turnId: 'turn_1' });
    expect(useStreamStore.getState().streams.s1?.pendingText).toBe('');
    expect(useStreamStore.getState().streams.s1?.activeTurnId).toBe('turn_1');
  });
});
