import path from 'node:path';
import type { HarnessConfig } from '../config.js';

export const getUsersRoot = (config: HarnessConfig) => path.join(config.DATA_ROOT, 'users');

export const getUserRoot = (config: HarnessConfig, userId: string) =>
  path.join(getUsersRoot(config), userId);

export const getSharedRoot = (config: HarnessConfig, userId: string) =>
  path.join(getUserRoot(config, userId), 'shared');

export const getTrashRoot = (config: HarnessConfig, userId: string) =>
  path.join(getUserRoot(config, userId), 'trash');

export const getSessionsRoot = (config: HarnessConfig, userId: string) =>
  path.join(getUserRoot(config, userId), 'sessions');

export const getSessionRoot = (config: HarnessConfig, userId: string, sessionId: string) =>
  path.join(getSessionsRoot(config, userId), sessionId);

export const getSessionMetaPath = (config: HarnessConfig, userId: string, sessionId: string) =>
  path.join(getSessionRoot(config, userId, sessionId), 'meta.json');

export const getSessionMessagesPath = (config: HarnessConfig, userId: string, sessionId: string) =>
  path.join(getSessionRoot(config, userId, sessionId), 'messages.jsonl');

export const getSessionTurnRuntimePath = (config: HarnessConfig, userId: string, sessionId: string) =>
  path.join(getSessionRoot(config, userId, sessionId), 'turn-runtime.json');

export const getSessionContextStatePath = (config: HarnessConfig, userId: string, sessionId: string) =>
  path.join(getSessionRoot(config, userId, sessionId), 'session-context.json');

export const getSessionUploadsRoot = (config: HarnessConfig, userId: string, sessionId: string) =>
  path.join(getSessionRoot(config, userId, sessionId), 'uploads');

export const getSessionOutputsRoot = (config: HarnessConfig, userId: string, sessionId: string) =>
  path.join(getSessionRoot(config, userId, sessionId), 'outputs');

export const getSessionTmpRoot = (config: HarnessConfig, userId: string, sessionId: string) =>
  path.join(getSessionRoot(config, userId, sessionId), 'tmp');

export const resolveUserPath = (config: HarnessConfig, userId: string, relativePath: string) =>
  path.join(getUserRoot(config, userId), relativePath);
