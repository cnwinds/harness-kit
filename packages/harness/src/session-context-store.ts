import fs from 'node:fs/promises';
import path from 'node:path';
import type { HarnessConfig } from '@skillchat/harness-core';
import { getSessionContextStatePath } from '@skillchat/harness-core';
import type { SessionTokenUsage } from '@skillchat/harness-core';

import type { SessionContextState, SessionCompactionState, SessionCompactionTrigger } from '@skillchat/harness-core';

export type { SessionContextState, SessionCompactionState, SessionCompactionTrigger };

const emptyState = (): SessionContextState => ({
  version: 1,
  latestCompaction: null,
  tokenUsage: null,
});

export class SessionContextStore {
  constructor(private readonly config: HarnessConfig) {}

  async load(userId: string, sessionId: string): Promise<SessionContextState> {
    const filePath = getSessionContextStatePath(this.config, userId, sessionId);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<SessionContextState> | null;
      if (!parsed || parsed.version !== 1) {
        return emptyState();
      }

      return {
        version: 1,
        latestCompaction: parsed.latestCompaction
          ? {
              summary: typeof parsed.latestCompaction.summary === 'string' ? parsed.latestCompaction.summary : '',
              createdAt: typeof parsed.latestCompaction.createdAt === 'string' ? parsed.latestCompaction.createdAt : new Date().toISOString(),
              baselineCreatedAt: typeof parsed.latestCompaction.baselineCreatedAt === 'string'
                ? parsed.latestCompaction.baselineCreatedAt
                : null,
              trigger: parsed.latestCompaction.trigger === 'manual' ? 'manual' : 'auto',
            }
          : null,
        tokenUsage: parsed.tokenUsage && typeof parsed.tokenUsage === 'object'
          ? {
              totalInputTokens: Number(parsed.tokenUsage.totalInputTokens ?? 0),
              totalOutputTokens: Number(parsed.tokenUsage.totalOutputTokens ?? 0),
              turnCount: Number(parsed.tokenUsage.turnCount ?? 0),
              lastUpdatedAt: typeof parsed.tokenUsage.lastUpdatedAt === 'string'
                ? parsed.tokenUsage.lastUpdatedAt
                : new Date().toISOString(),
            }
          : null,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyState();
      }
      throw error;
    }
  }

  async save(userId: string, sessionId: string, state: SessionContextState) {
    const filePath = getSessionContextStatePath(this.config, userId, sessionId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  async clear(userId: string, sessionId: string) {
    const filePath = getSessionContextStatePath(this.config, userId, sessionId);
    await fs.rm(filePath, { force: true });
  }
}
