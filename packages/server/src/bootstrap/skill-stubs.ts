import type { SkillDescriptor } from '@skillchat/harness-core';
import type { InstalledSkillStoreLike, SkillRegistryLike } from '../adapters.js';

export class EmptySkillRegistry implements SkillRegistryLike {
  get(name: string): SkillDescriptor {
    throw new Error(`Skill 未注册：${name}`);
  }
}

export class EmptyInstalledSkillStore implements InstalledSkillStoreLike {
  hasUserInstalled(_userId: string, _skillId: string, _version?: string): boolean {
    return false;
  }
}
