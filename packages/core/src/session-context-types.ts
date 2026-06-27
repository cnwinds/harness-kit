import type { SessionTokenUsage } from './llm/token-tracker.js';

export type SessionCompactionTrigger = 'manual' | 'auto';

export type SessionCompactionState = {
  summary: string;
  createdAt: string;
  baselineCreatedAt: string | null;
  trigger: SessionCompactionTrigger;
};

export type SessionContextState = {
  version: 1;
  latestCompaction: SessionCompactionState | null;
  tokenUsage?: SessionTokenUsage | null;
};
