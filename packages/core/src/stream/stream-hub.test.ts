import { describe, expect, it, vi } from 'vitest';
import { StreamHub } from './stream-hub.js';

describe('StreamHub', () => {
  it('delivers published events to subscribers and cleans up on unsubscribe', () => {
    const hub = new StreamHub();
    const received: string[] = [];
    const unsubscribe = hub.subscribe('s1', (event) => {
      received.push(event.event);
    });

    hub.publish('s1', { id: 'evt_1', event: 'text_delta', data: { content: 'hi' } });
    expect(received).toEqual(['text_delta']);

    unsubscribe();
    hub.publish('s1', { id: 'evt_2', event: 'turn_completed', data: {} });
    expect(received).toEqual(['text_delta']);
  });

  it('isolates subscribers by session id', () => {
    const hub = new StreamHub();
    const sessionOne = vi.fn();
    const sessionTwo = vi.fn();

    hub.subscribe('s1', sessionOne);
    hub.subscribe('s2', sessionTwo);

    hub.publish('s1', { id: 'evt_1', event: 'text_delta', data: {} });

    expect(sessionOne).toHaveBeenCalledTimes(1);
    expect(sessionTwo).not.toHaveBeenCalled();
  });
});
