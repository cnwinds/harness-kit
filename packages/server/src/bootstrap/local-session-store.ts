import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { SessionSummary } from '@skillchat/harness-protocol';
import { createSessionSchema } from '@skillchat/harness-protocol';
import type { HarnessConfig } from '@skillchat/harness-core';
import { ensureBaseDirectories, ensureSessionDirectories, ensureUserDirectories } from '@skillchat/harness-core';
import type { SessionServiceLike } from '../adapters.js';

const DEFAULT_TITLE = '新会话';

type SessionIndex = Record<string, SessionSummary[]>;

export class LocalSessionStore implements SessionServiceLike {
  private index: SessionIndex = {};
  private loaded = false;

  constructor(private readonly config: HarnessConfig) {}

  private indexPath() {
    return path.join(this.config.DATA_ROOT, 'session-index.json');
  }

  private async ensureLoaded() {
    if (this.loaded) {
      return;
    }

    await ensureBaseDirectories(this.config);

    try {
      const raw = await fs.readFile(this.indexPath(), 'utf8');
      this.index = JSON.parse(raw) as SessionIndex;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      this.index = {};
    }

    this.loaded = true;
  }

  private async persist() {
    await fs.writeFile(this.indexPath(), JSON.stringify(this.index, null, 2), 'utf8');
  }

  private sessionsFor(userId: string) {
    if (!this.index[userId]) {
      this.index[userId] = [];
    }
    return this.index[userId]!;
  }

  requireOwned(userId: string, sessionId: string): SessionSummary {
    const session = this.sessionsFor(userId).find((item) => item.id === sessionId);
    if (!session) {
      throw new Error('会话不存在或无权访问');
    }
    return session;
  }

  async touch(userId: string, sessionId: string): Promise<void> {
    await this.ensureLoaded();
    const session = this.requireOwned(userId, sessionId);
    session.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async renameFromMessage(userId: string, sessionId: string, currentTitle: string, message: string): Promise<void> {
    await this.ensureLoaded();
    const session = this.requireOwned(userId, sessionId);
    if (currentTitle !== DEFAULT_TITLE) {
      return;
    }

    session.title = message.trim().slice(0, 40) || DEFAULT_TITLE;
    session.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async list(userId: string): Promise<SessionSummary[]> {
    await this.ensureLoaded();
    return [...this.sessionsFor(userId)].sort((a, b) => (
      (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
    ));
  }

  async create(userId: string, input: unknown): Promise<SessionSummary> {
    await this.ensureLoaded();
    const parsed = createSessionSchema.parse(input ?? {});
    const id = nanoid();
    const now = new Date().toISOString();
    const title = parsed.title?.trim() || DEFAULT_TITLE;
    const activeSkills = parsed.activeSkills ?? [];

    await ensureUserDirectories(this.config, userId);
    await ensureSessionDirectories(this.config, userId, id, {
      sessionId: id,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      activeSkills,
    });

    const session: SessionSummary = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null,
      activeSkills,
    };

    this.sessionsFor(userId).unshift(session);
    await this.persist();
    return session;
  }
}
