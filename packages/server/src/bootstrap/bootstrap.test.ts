import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { createHarnessChatBootstrap } from './create-harness-chat-bootstrap.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('createHarnessChatBootstrap', () => {
  it('mounts session routes and returns messages/runtime envelopes', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hk-bootstrap-'));
    tempDirs.push(dataRoot);

    const app = Fastify();
    const chat = createHarnessChatBootstrap({
      llm: { apiKey: 'test-token' },
      dataRoot,
      nodeEnv: 'test',
      inlineJobs: true,
    });
    await chat.mount(app, { prefix: '/api/chat' });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      payload: { title: 'demo session' },
    });
    expect(createRes.statusCode).toBe(201);
    const { session } = createRes.json() as { session: { id: string } };
    expect(session.id).toBeTruthy();

    const listRes = await app.inject({ method: 'GET', url: '/api/chat/sessions' });
    expect(listRes.statusCode).toBe(200);
    const { sessions } = listRes.json() as { sessions: Array<{ id: string }> };
    expect(sessions.some((item) => item.id === session.id)).toBe(true);

    const messagesRes = await app.inject({
      method: 'GET',
      url: `/api/chat/sessions/${session.id}/messages`,
    });
    expect(messagesRes.statusCode).toBe(200);
    expect(messagesRes.json()).toEqual({ events: [] });

    const runtimeRes = await app.inject({
      method: 'GET',
      url: `/api/chat/sessions/${session.id}/runtime`,
    });
    expect(runtimeRes.statusCode).toBe(200);
    expect(runtimeRes.json()).toHaveProperty('runtime');

    await app.close();
  });

  it('serves file preview and download routes', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hk-bootstrap-files-'));
    tempDirs.push(dataRoot);

    const app = Fastify();
    const chat = createHarnessChatBootstrap({
      llm: { apiKey: 'test-token' },
      dataRoot,
      nodeEnv: 'test',
      inlineJobs: true,
    });
    await chat.mount(app, { prefix: '/api/chat' });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/chat/sessions',
      payload: { title: 'files' },
    });
    const { session } = createRes.json() as { session: { id: string } };

    const file = await chat.fileService.saveGeneratedBinary({
      userId: 'anonymous',
      sessionId: session.id,
      displayName: 'demo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-png'),
    });

    const previewRes = await app.inject({
      method: 'GET',
      url: `/api/chat/files/${file.id}/preview`,
    });
    expect(previewRes.statusCode).toBe(200);
    expect(previewRes.headers['content-type']).toBe('image/png');
    expect(previewRes.body).toBe('fake-png');

    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/chat/files/${file.id}/download`,
    });
    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.headers['content-disposition']).toContain('attachment');
    expect(downloadRes.body).toBe('fake-png');

    await app.close();
  });
});
