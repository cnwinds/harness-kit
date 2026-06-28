import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ChatUser } from '@harnesskit/protocol';
import { MessageStore, StreamHub } from '@harnesskit/core';
import { createHarnessChat } from '../create-harness-chat.js';
import type { MountOptions } from '../types.js';
import { anonymousAuth, type AuthResolver } from '../auth.js';
import { LocalFileService } from './local-file-service.js';
import { LocalSessionStore } from './local-session-store.js';
import { resolveBootstrapConfig } from './resolve-config.js';
import { registerFileRoutes } from './register-file-routes.js';
import { EmptyInstalledSkillStore, EmptySkillRegistry } from './skill-stubs.js';
import type { HarnessChatBootstrapOptions } from './types.js';

export type HarnessChatBootstrapInstance = ReturnType<typeof createHarnessChatBootstrap>;

export const createHarnessChatBootstrap = (options: HarnessChatBootstrapOptions) => {
  const config = resolveBootstrapConfig(options);
  const auth: AuthResolver = options.auth ?? anonymousAuth;
  const messageStore = new MessageStore(config);
  const streamHub = new StreamHub();
  const sessionStore = new LocalSessionStore(config);
  const fileService = new LocalFileService(config);
  const skillRegistry = new EmptySkillRegistry();
  const installedSkillStore = new EmptyInstalledSkillStore();

  const chat = createHarnessChat({
    config,
    messageStore,
    streamHub,
    skillRegistry,
    installedSkillStore,
    fileService,
    sessionService: sessionStore,
    auth,
  });

  const resolveUser = async (request: FastifyRequest): Promise<ChatUser | null> => auth.resolve(request.raw);

  const mount = async (app: FastifyInstance, mountOpts: MountOptions = {}) => {
    const prefix = mountOpts.prefix ?? '/api/chat';
    await chat.mount(app, mountOpts);

    registerFileRoutes({
      app,
      prefix,
      config,
      fileService,
      resolveUser,
    });

    app.get(`${prefix}/sessions`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const sessions = await sessionStore.list(user.id);
      return { sessions };
    });

    app.post(`${prefix}/sessions`, async (request, reply) => {
      const user = await resolveUser(request);
      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      const session = await sessionStore.create(user.id, request.body);
      return reply.code(201).send({ session });
    });
  };

  return {
    ...chat,
    mount,
    config,
    sessionStore,
    fileService,
  };
};

/** @deprecated Use createHarnessChatBootstrap — kept for README one-liner compatibility */
export const createHarnessChatApp = createHarnessChatBootstrap;
