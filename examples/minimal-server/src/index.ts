/**
 * Minimal server example — 5 lines to harness chat.
 *
 *   npm run dev:minimal-server
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHarnessChat } from '@harnesskit/server';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });

const chat = createHarnessChat({
  llm: { apiKey: process.env.OPENAI_API_KEY ?? 'demo-key' },
});

await chat.mount(app, { prefix: '/api/chat' });

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
console.log(`HarnessKit minimal server → http://localhost:${port}/api/chat`);
