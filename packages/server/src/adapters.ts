import type { SessionSummary } from '@skillchat/harness-protocol';
import type { SkillDescriptor } from '@skillchat/harness-core';
import type { FileServiceLike } from '@skillchat/harness-core';

export type ChatUserContext = {
  id: string;
  username: string;
  role: 'admin' | 'member';
};

export interface SessionServiceLike {
  requireOwned(userId: string, sessionId: string): SessionSummary;
  touch(userId: string, sessionId: string): Promise<void>;
  renameFromMessage(userId: string, sessionId: string, currentTitle: string, message: string): Promise<void>;
}

export interface SkillRegistryLike {
  get(name: string): SkillDescriptor;
}

export interface InstalledSkillStoreLike {
  hasUserInstalled(userId: string, skillId: string, version?: string): boolean;
}

export type { FileServiceLike, SkillDescriptor };
