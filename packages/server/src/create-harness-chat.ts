import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createMessageSchema, steerMessageSchema } from '@harnesskit/protocol';
import { ChatOrchestrator } from './orchestrator/chat-orchestrator.js';
import type { HarnessChatInstance, HarnessChatOptions, MountOptions } from './types.js';
import type { StreamHub } from '@harnesskit/core';
import { createOpenAIHarnessStack } from '@harnesskit/harness';
import { OpenAIHarness, SessionContextStore } from '@harnesskit/harness';
import type { AuthResolver } from './auth.js';
import { anonymousAuth } from './auth.js';
import type { ChatUser } from '@harnesskit/protocol';

export const createHarnessChat = (options: HarnessChatOptions & { auth?: AuthResolver }): HarnessChatInstance => {
  const auth = options.auth ?? anonymousAuth;
  const sessionContextStore = options.sessionContextStore ?? new SessionContextStore(options.config);
  const openAIHarness =
    options.openAIHarness ??
    createOpenAIHarnessStack(options.config, options.fileService).openAIHarness;

  const orchestrator = new ChatOrchestrator(
    options.messageStore,
    options.streamHub,
    options.skillRegistry,
    options.installedSkillStore,
    options.fileService,
    options.sessionService,
    options.config,
    openAIHarness,
    sessionContextStore,
  );

  const resolveUser = async (request: FastifyRequest): Promise<ChatUser | null> => auth.resolve(request.raw);

  const registerRoutes = async (app: FastifyInstance, mountOpts: MountOptions = {}) => {
    const prefix = mountOpts.prefix ?? '/api/chat';

    app.get(`${prefix}/sessions/:sessionId/messages`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId } = request.params as { sessionId: string };
      const query = z
        .object({
          after: z.string().optional(),
          before: z.string().optional(),
          limit: z.coerce.number().int().positive().max(500).optional(),
        })
        .parse(request.query ?? {});
      options.sessionService.requireOwned(user.id, sessionId);
      const events = await options.messageStore.readEvents(user.id, sessionId, query);
      return events;
    });

    app.post(`${prefix}/sessions/:sessionId/messages`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId } = request.params as { sessionId: string };
      const input = createMessageSchema.parse(request.body);
      const result = await orchestrator.dispatchMessage(
        { id: user.id, username: user.username, role: user.role ?? 'member' },
        sessionId,
        input,
      );
      if (options.config.INLINE_JOBS && result.task) {
        await result.task;
      }
      return reply.code(202).send(result.response);
    });

    app.get(`${prefix}/sessions/:sessionId/runtime`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId } = request.params as { sessionId: string };
      return orchestrator.getRuntime(user.id, sessionId);
    });

    app.post(`${prefix}/sessions/:sessionId/turns/:turnId/steer`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId, turnId } = request.params as { sessionId: string; turnId: string };
      const body = steerMessageSchema.parse(request.body);
      const result = await orchestrator.steerTurn(
        { id: user.id, username: user.username, role: user.role ?? 'member' },
        sessionId,
        turnId,
        body.content,
      );
      return result.response;
    });

    app.post(`${prefix}/sessions/:sessionId/turns/:turnId/interrupt`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId, turnId } = request.params as { sessionId: string; turnId: string };
      return orchestrator.interruptTurn(
        { id: user.id, username: user.username, role: user.role ?? 'member' },
        sessionId,
        turnId,
      );
    });

    app.delete(`${prefix}/sessions/:sessionId/runtime/queue/:inputId`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId, inputId } = request.params as { sessionId: string; inputId: string };
      return orchestrator.removeFollowUpInput(
        { id: user.id, username: user.username, role: user.role ?? 'member' },
        sessionId,
        inputId,
      );
    });

    app.get(`${prefix}/sessions/:sessionId/stream`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      const { sessionId } = request.params as { sessionId: string };
      options.sessionService.requireOwned(user.id, sessionId);
      await openSSE(reply, sessionId, options.streamHub, request);
    });
  };

  return {
    orchestrator,
    streamHub: options.streamHub,
    mount: registerRoutes,
  };
};

const openSSE = async (
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
  request.raw.on('close', () => unsubscribe());
  await new Promise<void>((resolve) => request.raw.on('close', resolve));
};
