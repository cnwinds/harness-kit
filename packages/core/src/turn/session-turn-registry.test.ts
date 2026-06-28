import { describe, expect, it, vi } from 'vitest';
import { SessionTurnRegistry } from './session-turn-registry.js';
import { SessionTurnRuntime } from './session-turn-runtime.js';

describe('SessionTurnRegistry', () => {
  it('reuses the same runtime instance for a session key', async () => {
    const load = vi.fn(async () => null);
    const createRuntime = vi.fn((_userId, sessionId, _initial, onIdle) => new SessionTurnRuntime(
      sessionId,
      {
        onInputCommitted: async () => undefined,
        onExecuteTurn: async () => undefined,
        onTurnFailure: async () => undefined,
        publish: () => undefined,
      },
      {
        load: async () => null,
        save: async () => undefined,
        clear: async () => undefined,
      },
      null,
      onIdle,
    ));

    const registry = new SessionTurnRegistry(load, createRuntime);
    const first = await registry.getOrCreate('u1', 's1');
    const second = await registry.getOrCreate('u1', 's1');

    expect(first).toBe(second);
    expect(createRuntime).toHaveBeenCalledTimes(1);
  });
});
