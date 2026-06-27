import type { FastifyInstance } from 'fastify';
import type { HarnessConfig } from '@harnesskit/core';
import type {
  FileServiceLike,
  InstalledSkillStoreLike,
  SessionServiceLike,
  SkillRegistryLike,
} from './adapters.js';
import type { StreamHub, MessageStore } from '@harnesskit/core';
import { OpenAIHarness, SessionContextStore } from '@harnesskit/harness';
import { ChatOrchestrator } from './orchestrator/chat-orchestrator.js';

export type HarnessChatOptions = {
  config: HarnessConfig;
  messageStore: MessageStore;
  streamHub: StreamHub;
  skillRegistry: SkillRegistryLike;
  installedSkillStore: InstalledSkillStoreLike;
  fileService: FileServiceLike;
  sessionService: SessionServiceLike;
  openAIHarness?: OpenAIHarness;
  sessionContextStore?: SessionContextStore;
};

export type MountOptions = {
  prefix?: string;
};

export type HarnessChatInstance = {
  mount(app: FastifyInstance, options?: MountOptions): Promise<void>;
  orchestrator: ChatOrchestrator;
  streamHub: StreamHub;
};

export type { AuthResolver } from './auth.js';
export type { HarnessConfig } from '@harnesskit/core';
