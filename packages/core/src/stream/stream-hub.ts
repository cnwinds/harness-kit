import type { EventPublisher, PublishEvent } from '../adapters.js';

type Subscriber = (event: PublishEvent) => void;

/**
 * In-memory pub/sub for session SSE broadcast.
 * Does NOT buffer events — subscribers must reconcile via REST on reconnect.
 */
export class StreamHub implements EventPublisher {
  private readonly channels = new Map<string, Set<Subscriber>>();

  publish(sessionId: string, event: PublishEvent): void {
    const subs = this.channels.get(sessionId);
    if (!subs) return;
    for (const handler of subs) {
      handler(event);
    }
  }

  subscribe(sessionId: string, handler: Subscriber): () => void {
    let subs = this.channels.get(sessionId);
    if (!subs) {
      subs = new Set();
      this.channels.set(sessionId, subs);
    }
    subs.add(handler);
    return () => {
      subs!.delete(handler);
      if (subs!.size === 0) {
        this.channels.delete(sessionId);
      }
    };
  }

  /** @internal test helper */
  subscriberCount(sessionId: string): number {
    return this.channels.get(sessionId)?.size ?? 0;
  }
}

export const createStreamHub = (): StreamHub => new StreamHub();
