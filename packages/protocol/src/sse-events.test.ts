import { describe, expect, it } from 'vitest';
import { SSE_EVENT_NAMES } from './constants.js';
import type { SSEEventName } from './types.js';

const isSSEEventName = (value: string): value is SSEEventName => (
  (SSE_EVENT_NAMES as readonly string[]).includes(value)
);

describe('SSE event contract', () => {
  it('includes core streaming lifecycle events', () => {
    for (const name of ['text_delta', 'reasoning_delta', 'turn_started', 'turn_completed', 'done'] as const) {
      expect(SSE_EVENT_NAMES).toContain(name);
      expect(isSSEEventName(name)).toBe(true);
    }
  });

  it('rejects unknown event names and keeps names unique', () => {
    expect(isSSEEventName('not_an_event')).toBe(false);
    expect(new Set(SSE_EVENT_NAMES).size).toBe(SSE_EVENT_NAMES.length);
  });
});
