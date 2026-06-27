import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createMessageSchema,
  createSessionSchema,
  listMessagesQuerySchema,
  type ChatUser,
  type SessionSummary,
  type StoredEvent,
} from '@harnesskit/protocol';
import {
  createStreamHub,
  createTurnRuntime,
  type AuthResolver,
  type StreamHub,
  type TurnRuntime,
} from '@harnesskit/core';
import { createHarnessEngine } from '@harnesskit/harness';
import type { HarnessChatInstance, HarnessChatOptions, MountOptions } from './types.js';

const DEFAULT_USER: ChatUser = { id: 'anonymous', username: 'anonymous', role: 'member' };

const anonymousAuth: AuthResolver = {
  resolve: async () => DEFAULT_USER,
};

type SessionRecord = SessionSummary & { userId: string; events: StoredEvent[] };

/**
 * One-line harness chat factory.
 *
 * ```ts
 * const chat = createHarnessChat({ llm: { apiKey: process.env.OPENAI_API_KEY! } });
 * await chat.mount(fastify, { prefix: '/api/chat' });
 * ```
 */
export const createHarnessChat = (options: HarnessChatOptions): HarnessChatInstance => {
  const streamHub = createStreamHub();
  const auth = options.auth ?? anonymousAuth;
  const sessions = new Map<string, SessionRecord>();
  const runtimes = new Map<string, TurnRuntime>();

  const harness = createHarnessEngine({ llm: options.llm });

  const getRuntime = (sessionId: string, user: ChatUser): TurnRuntime => {
    const key = `${user.id}:${sessionId}`;
    let runtime = runtimes.get(key);
    if (!runtime) {
      runtime = createTurnRuntime({
        sessionId,
        userId: user.id,
        callbacks: {
          publish: (event) => streamHub.publish(sessionId, event),
          onInputCommitted: async ({ input, turnId }) => {
            const session = sessions.get(sessionId);
            if (!session) return;
            const event: StoredEvent = {
              id: randomUUID(),
              sessionId,
              kind: 'message',
              role: 'user',
              type: 'text',
              content: input.content,
              createdAt: input.createdAt,
              meta: { turnId },
            };
            session.events.push(event);
            streamHub.publish(sessionId, {
              id: randomUUID(),
              event: 'user_message_committed',
              data: { turnId, inputId: input.inputId, content: input.content, createdAt: input.createdAt },
            });
          },
          onExecuteTurn: async (ctx) => {
            streamHub.publish(sessionId, {
              id: randomUUID(),
              event: 'turn_started',
              data: {
                turnId: ctx.turnId,
                kind: ctx.kind,
                status: 'running',
                phase: 'sampling',
                phaseStartedAt: new Date().toISOString(),
                canSteer: false,
                startedAt: new Date().toISOString(),
                round: 0,
                followUpQueueCount: 0,
              },
            });

            const session = sessions.get(sessionId);
            const history = session?.events ?? [];

            await harness.runTurn({
              user: ctx.user,
              sessionId,
              turnCtx: ctx,
              history,
              instructions: 'You are a helpful assistant.',
              activeSkillIds: session?.activeSkills ?? [],
              callbacks: {
                onTextDelta: (content) => {
                  streamHub.publish(sessionId, {
                    id: randomUUID(),
                    event: 'text_delta',
                    data: { content },
                  });
                },
                onReasoningDelta: (content) => {
                  streamHub.publish(sessionId, {
                    id: randomUUID(),
                    event: 'reasoning_delta',
                    data: { content },
                  });
                },
                onThinking: (content) => {
                  streamHub.publish(sessionId, {
                    id: randomUUID(),
                    event: 'thinking',
                    data: { content },
                  });
                },
                onToolStart: ({ callId, name, arguments: args }) => {
                  streamHub.publish(sessionId, {
                    id: randomUUID(),
                    event: 'tool_start',
                    data: { callId, skill: name, arguments: args },
                  });
                },
                onToolProgress: ({ callId, message, percent }) => {
                  streamHub.publish(sessionId, {
                    id: randomUUID(),
                    event: 'tool_progress',
                    data: { callId, skill: '', message, percent },
                  });
                },
                onToolResult: ({ callId, name, content }) => {
                  streamHub.publish(sessionId, {
                    id: randomUUID(),
                    event: 'tool_result',
                    data: { callId, skill: name, message: content },
                  });
                },
                onTokenCount: (usage) => {
                  streamHub.publish(sessionId, {
                    id: randomUUID(),
                    event: 'token_count',
                    data: usage,
                  });
                },
              },
            });

            const assistantEvent: StoredEvent = {
              id: randomUUID(),
              sessionId,
              kind: 'message',
              role: 'assistant',
              type: 'text',
              content: `[stub response for turn ${ctx.turnId}]`,
              createdAt: new Date().toISOString(),
              meta: { turnId: ctx.turnId },
            };
            session?.events.push(assistantEvent);

            streamHub.publish(sessionId, {
              id: randomUUID(),
              event: 'turn_completed',
              data: { turnId: ctx.turnId, kind: ctx.kind, status: 'completed' },
            });
            streamHub.publish(sessionId, {
              id: randomUUID(),
              event: 'done',
              data: {},
            });
          },
          onTurnFailure: async ({ turnId, error }) => {
            streamHub.publish(sessionId, {
              id: randomUUID(),
              event: 'error',
              data: { message: error instanceof Error ? error.message : String(error), turnId },
            });
          },
        },
      });
      runtimes.set(key, runtime);
    }
    return runtimes.get(key)!;
  };

  const resolveUser = async (request: FastifyRequest): Promise<ChatUser | null> =>
    auth.resolve(request);

  const registerRoutes = async (app: FastifyInstance, mountOpts: MountOptions = {}) => {
    const prefix = mountOpts.prefix ?? '/api/chat';

    app.get(`${prefix}/sessions`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const list = [...sessions.values()].filter((s) => s.userId === user.id);
      return { sessions: list.map(({ userId: _, events: __, ...s }) => s) };
    });

    app.post(`${prefix}/sessions`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const body = createSessionSchema.parse(request.body);
      const now = new Date().toISOString();
      const session: SessionRecord = {
        id: randomUUID(),
        userId: user.id,
        title: body.title ?? '新会话',
        createdAt: now,
        updatedAt: now,
        lastMessageAt: null,
        activeSkills: body.activeSkills ?? [],
        metadata: body.metadata,
        events: [],
      };
      sessions.set(session.id, session);
      return reply.code(201).send({ session });
    });

    app.get(`${prefix}/sessions/:sessionId/messages`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId } = request.params as { sessionId: string };
      const session = sessions.get(sessionId);
      if (!session || session.userId !== user.id) return reply.code(404).send({ error: 'Not found' });
      const query = listMessagesQuerySchema.parse(request.query);
      let events = session.events;
      if (query.after) {
        const idx = events.findIndex((e) => e.id === query.after);
        events = idx >= 0 ? events.slice(idx + 1) : events;
      }
      if (query.limit) events = events.slice(-query.limit);
      return { events };
    });

    app.post(`${prefix}/sessions/:sessionId/messages`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId } = request.params as { sessionId: string };
      const session = sessions.get(sessionId);
      if (!session || session.userId !== user.id) return reply.code(404).send({ error: 'Not found' });
      const body = createMessageSchema.parse(request.body);
      const runtime = getRuntime(sessionId, user);
      const result = await runtime.dispatchMessage({
        user,
        sessionId,
        content: body.content,
        attachmentIds: body.attachmentIds,
        mode: body.dispatch,
        turnId: body.turnId,
        kind: body.kind,
        turnConfig: body.turnConfig,
      });
      session.updatedAt = new Date().toISOString();
      session.lastMessageAt = new Date().toISOString();
      if (options.inlineJobs && result.task) {
        await result.task;
      }
      return reply.code(202).send(result.response);
    });

    app.get(`${prefix}/sessions/:sessionId/runtime`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId } = request.params as { sessionId: string };
      const session = sessions.get(sessionId);
      if (!session || session.userId !== user.id) return reply.code(404).send({ error: 'Not found' });
      const runtime = getRuntime(sessionId, user);
      return { runtime: runtime.getSnapshot() };
    });

    app.get(`${prefix}/sessions/:sessionId/stream`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId } = request.params as { sessionId: string };
      const session = sessions.get(sessionId);
      if (!session || session.userId !== user.id) return reply.code(404).send({ error: 'Not found' });
      await openSSEStream(reply, sessionId, streamHub, request);
    });

    app.post(`${prefix}/sessions/:sessionId/turns/:turnId/interrupt`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId, turnId } = request.params as { sessionId: string; turnId: string };
      const runtime = getRuntime(sessionId, user);
      const runtimeSnapshot = await runtime.interrupt({ user, turnId });
      return { accepted: true, turnId, runtime: runtimeSnapshot };
    });
  };

  return {
    streamHub,
    mount: registerRoutes,
    createApp: async (mountOpts) => {
      const Fastify = (await import('fastify')).default;
      const app = Fastify({ logger: mountOpts?.logger ?? true });
      await registerRoutes(app, mountOpts);
      return app;
    },
  };
};

const openSSEStream = async (
  reply: FastifyReply,
  sessionId: string,
  hub: StreamHub,
  request: FastifyRequest,
): Promise<void> => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const writeEvent = (event: { id: string; event: string; data: unknown }) => {
    reply.raw.write(`id: ${event.id}\n`);
    reply.raw.write(`event: ${event.event}\n`);
    reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);
  };

  const unsubscribe = hub.subscribe(sessionId, writeEvent);

  request.raw.on('close', () => {
    unsubscribe();
  });

  // Keep connection open — Fastify won't auto-close when handler returns void after headers
  await new Promise<void>((resolve) => {
    request.raw.on('close', resolve);
  });
};
