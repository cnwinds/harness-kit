import { describe, expect, it, vi } from 'vitest';
import { defaultHarnessConfig } from '../config.js';

vi.mock('./session-runner.js', () => ({
  SessionRunner: class {
    run = vi.fn(async ({ callbacks }: { callbacks: { onProgress: (msg: string) => Promise<void> } }) => {
      await callbacks.onProgress('ok');
    });
  },
}));

import { RunnerManager } from './runner-manager.js';

describe('RunnerManager', () => {
  it('runs queued tasks sequentially for the same session', async () => {
    const order: string[] = [];
    const config = defaultHarnessConfig({
      CWD: '/tmp',
      DATA_ROOT: '/tmp/harness-runner',
      SKILLS_ROOT: '/tmp/harness-runner/skills',
      MAX_CONCURRENT_RUNS: 1,
      NODE_ENV: 'test',
    });

    const manager = new RunnerManager(config, {
      recordGeneratedFile: vi.fn(async () => ({ id: 'f1' })),
    } as never);

    const run = (label: string) => manager.execute({
      userId: 'u1',
      sessionId: 's1',
      scriptPath: 'noop.sh',
      onProgress: async () => {
        order.push(`${label}:progress`);
      },
      onArtifact: async () => undefined,
    }).then(() => {
      order.push(`${label}:done`);
    });

    await Promise.all([run('a'), run('b')]);
    expect(order.indexOf('a:done')).toBeLessThan(order.indexOf('b:progress'));
  });
});
