import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultHarnessConfig } from '../config.js';
import { ensureSessionDirectories, ensureUserDirectories, ensureBaseDirectories } from './fs-utils.js';
import { MessageStore } from './message-store.js';

describe('MessageStore', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  const setupSession = async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-message-store-'));
    const config = defaultHarnessConfig({
      CWD: tempDir,
      DATA_ROOT: path.join(tempDir, 'data'),
      SKILLS_ROOT: path.join(tempDir, 'skills'),
      OPENAI_API_KEY: 'test-token',
    });
    await ensureBaseDirectories(config);
    await ensureUserDirectories(config, 'u1');
    await ensureSessionDirectories(config, 'u1', 's1', {
      sessionId: 's1',
      userId: 'u1',
      title: 'test',
      createdAt: '2026-04-13T10:00:00.000Z',
      updatedAt: '2026-04-13T10:00:00.000Z',
      activeSkills: [],
    });
    return new MessageStore(config);
  };

  it('appends and reads events in chronological order', async () => {
    const store = await setupSession();

    await store.appendEvent('u1', 's1', {
      id: 'evt_1',
      sessionId: 's1',
      kind: 'message',
      role: 'user',
      type: 'text',
      content: 'hello',
      createdAt: '2026-04-13T10:00:00.000Z',
    });
    await store.appendEvent('u1', 's1', {
      id: 'evt_2',
      sessionId: 's1',
      kind: 'message',
      role: 'assistant',
      type: 'text',
      content: 'hi',
      createdAt: '2026-04-13T10:00:01.000Z',
    });

    const events = await store.readEvents('u1', 's1');
    expect(events).toHaveLength(2);
    expect(events[0]?.content).toBe('hello');
    expect(events[1]?.content).toBe('hi');
  });

  it('supports after/before/limit query filters', async () => {
    const store = await setupSession();

    for (let index = 0; index < 5; index += 1) {
      await store.appendEvent('u1', 's1', {
        id: `evt_${index}`,
        sessionId: 's1',
        kind: 'message',
        role: 'user',
        type: 'text',
        content: `msg-${index}`,
        createdAt: `2026-04-13T10:00:0${index}.000Z`,
      });
    }

    const limited = await store.readEvents('u1', 's1', { limit: 2 });
    expect(limited.map((event) => event.content)).toEqual(['msg-3', 'msg-4']);

    const after = await store.readEvents('u1', 's1', { after: '2026-04-13T10:00:02.000Z' });
    expect(after.map((event) => event.content)).toEqual(['msg-3', 'msg-4']);
  });
});
