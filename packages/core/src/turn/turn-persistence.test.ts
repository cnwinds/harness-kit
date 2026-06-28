import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileRuntimePersistence } from './turn-persistence.js';

describe('FileRuntimePersistence', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('persists and reloads runtime state', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-turn-persistence-'));
    const filePath = path.join(tempDir, 'runtime.json');
    const persistence = new FileRuntimePersistence(filePath);

    await persistence.save({
      sessionId: 's1',
      activeTurn: null,
      queuedInputs: [{
        inputId: 'input_1',
        content: 'follow up',
        createdAt: '2026-04-13T10:00:01.000Z',
        source: 'queued',
        requestedKind: 'regular',
      }],
      recovery: null,
    });

    const loaded = await persistence.load();
    expect(loaded?.queuedInputs).toHaveLength(1);
    expect(loaded?.queuedInputs[0]?.content).toBe('follow up');
  });
});
