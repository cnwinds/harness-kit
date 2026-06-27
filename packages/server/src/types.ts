import type {
  AuthResolver,
  FileContextProvider,
  PersistenceBundle,
  ScriptExecutor,
  SkillCatalogProvider,
} from '@harnesskit/core';
import type { LLMConfig } from '@harnesskit/harness';
import type { FastifyInstance } from 'fastify';

export type HarnessChatOptions = {
  /** LLM configuration — required */
  llm: LLMConfig;

  /** Data directory for default file-based persistence */
  dataRoot?: string;

  /** Plugin adapters — all optional with sensible defaults */
  auth?: AuthResolver;
  files?: FileContextProvider;
  skills?: SkillCatalogProvider;
  scripts?: ScriptExecutor;
  persistence?: PersistenceBundle;

  /** POST /messages awaits turn completion when true */
  inlineJobs?: boolean;

  /** Enable built-in assistant tools (web search, file read, etc.) */
  enableAssistantTools?: boolean;
};

export type MountOptions = {
  /** Route prefix, e.g. '/api/chat' or '/api' */
  prefix?: string;
};

export type HarnessChatInstance = {
  /** Mount chat routes onto an existing Fastify app */
  mount(app: FastifyInstance, options?: MountOptions): Promise<void>;

  /** Create a standalone Fastify app with chat routes */
  createApp(options?: MountOptions & { logger?: boolean }): Promise<FastifyInstance>;

  /** Access internal stream hub for testing */
  readonly streamHub: import('@harnesskit/core').StreamHub;
};

export type { AuthResolver } from '@harnesskit/core';
export type { ChatUser } from '@harnesskit/protocol';
export type { LLMConfig } from '@harnesskit/harness';
