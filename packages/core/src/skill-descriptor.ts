/** Skill descriptor — host app resolves from registry/market */
export type SkillDescriptor = {
  id: string;
  name: string;
  description: string;
  directory: string;
  source: 'legacy' | 'installed';
  kind?: 'instruction' | 'runtime' | 'hybrid';
  version?: string;
  manifest?: Record<string, unknown>;
};
