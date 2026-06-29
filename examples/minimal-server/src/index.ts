/**
 * HarnessKit minimal server — bootstrap one-liner.
 *
 *   npm run dev:demo   (from repo root)
 *   npm run dev        (from this package)
 *
 * LLM 配置见 examples/minimal-server/.env（复制 .env.example）
 */
import './load-env.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHarnessChatBootstrap } from '@skillchat/harness-server';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });

const parseWebSearchMode = (): 'disabled' | 'cached' | 'live' | undefined => {
  const value = process.env.WEB_SEARCH_MODE;
  if (value === 'disabled' || value === 'cached' || value === 'live') {
    return value;
  }
  return undefined;
};

const parseReasoningEffort = ():
  | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  | undefined => {
  const value = process.env.OPENAI_REASONING_EFFORT?.trim();
  if (
    value === 'minimal'
    || value === 'low'
    || value === 'medium'
    || value === 'high'
    || value === 'xhigh'
  ) {
    return value;
  }
  return undefined;
};

const chat = createHarnessChatBootstrap({
  llm: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL,
    baseUrl: process.env.OPENAI_BASE_URL,
    reasoningEffort: parseReasoningEffort(),
  },
  dataRoot: process.env.HARNESSKIT_DATA_ROOT ?? './data',
  inlineJobs: process.env.HARNESSKIT_INLINE_JOBS !== 'false',
  webSearchMode: parseWebSearchMode(),
});

await chat.mount(app, { prefix: '/api/chat' });

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
console.log(`HarnessKit demo server → http://localhost:${port}/api/chat`);
console.log(`LLM endpoint → ${process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}`);
console.log(`LLM model    → ${process.env.OPENAI_MODEL ?? 'gpt-5.4'}`);
console.log(`Web search   → ${process.env.WEB_SEARCH_PROVIDER ?? 'html'} (${process.env.WEB_SEARCH_MODE ?? 'live'})`);
