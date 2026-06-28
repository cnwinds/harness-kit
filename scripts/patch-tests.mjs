import fs from 'node:fs';
import path from 'node:path';

const harnessRoot = path.resolve('D:/ai_projects/harness-kit');

const files = [
  {
    path: 'packages/harness/src/openai-harness.test.ts',
    replacements: [
      ["import type { FileRecord } from '@skillchat/shared';", "import type { FileRecord } from '@harnesskit/protocol';"],
      ["import type { AppConfig } from '../../config/env.js';", "import { defaultHarnessConfig, type HarnessConfig } from '@harnesskit/core';"],
      ['Partial<AppConfig>', 'Partial<HarnessConfig>'],
      [': AppConfig => ({', ': HarnessConfig => defaultHarnessConfig({'],
    ],
    createConfig: `const createConfig = (overrides: Partial<HarnessConfig> = {}): HarnessConfig => defaultHarnessConfig({
  CWD: '/workspace/qizhi',
  DATA_ROOT: '/tmp/harness-data',
  SKILLS_ROOT: '/tmp/harness-data/skills',
  OPENAI_API_KEY: 'test-token',
  OPENAI_BASE_URL: 'http://example.com/v1',
  NODE_ENV: 'test',
  LLM_REQUEST_TIMEOUT_MS: 1_000,
  TOOL_MAX_OUTPUT_TOKENS: 3072,
  ...overrides,
});`,
    skills: `const zhangXuefengSkill = {
  id: 'skill_zxf',
  name: 'zhangxuefeng-perspective',
  description: '以张雪峰风格给出专业和志愿建议。',
  directory: '/workspace/qizhi/skills/zhangxuefeng-perspective',
  source: 'legacy' as const,
};

const pdfSkill = {
  id: 'skill_pdf',
  name: 'pdf',
  description: '生成 PDF 文件。',
  directory: '/workspace/qizhi/skills/pdf',
  source: 'legacy' as const,
};`,
  },
  {
    path: 'packages/server/src/orchestrator/chat-orchestrator.test.ts',
    replacements: [
      ["import { ChatService } from './chat-service.js';", "import { ChatOrchestrator } from './chat-orchestrator.js';"],
      ["import type { AppConfig } from '../../config/env.js';", "import { defaultHarnessConfig, type HarnessConfig } from '@harnesskit/core';"],
      ['new ChatService(', 'new ChatOrchestrator('],
      ["describe('ChatService harness-only flow'", "describe('ChatOrchestrator harness-only flow'"],
      ['config?: AppConfig', 'config?: HarnessConfig'],
      ['(): AppConfig => ({', '(): HarnessConfig => defaultHarnessConfig({'],
    ],
    createConfig: `const testConfig = (): HarnessConfig => defaultHarnessConfig({
  CWD: '/workspace/qizhi',
  DATA_ROOT: 'D:/ai_projects/harness-kit/.tmp/test-data',
  SKILLS_ROOT: 'D:/ai_projects/harness-kit/.tmp/test-data/skills',
  OPENAI_API_KEY: 'test-token',
  OPENAI_BASE_URL: 'http://example.com/v1',
  NODE_ENV: 'test',
  INLINE_JOBS: true,
  LLM_REQUEST_TIMEOUT_MS: 1000,
  TOOL_MAX_OUTPUT_TOKENS: 3072,
  RUN_TIMEOUT_MS: 120000,
});`,
    createSkill: `const createSkill = (name: string) => ({
  id: \`skill_\${name}\`,
  name,
  description: \`\${name} desc\`,
  directory: \`/tmp/skills/\${name}\`,
  source: 'legacy' as const,
});`,
  },
];

for (const file of files) {
  let text = fs.readFileSync(path.join(harnessRoot, file.path), 'utf8');
  for (const [from, to] of file.replacements) {
    text = text.split(from).join(to);
  }

  if (file.createConfig) {
    text = text.replace(/const createConfig = [\s\S]*?\n\}\);/m, file.createConfig);
    text = text.replace(/const testConfig = [\s\S]*?\n\}\);/m, file.createConfig);
  }

  if (file.skills) {
    text = text.replace(/const zhangXuefengSkill = [\s\S]*?const pdfSkill = [\s\S]*?\}\);/m, file.skills);
  }

  if (file.createSkill) {
    text = text.replace(/const createSkill = \(name: string\) => \(\{[\s\S]*?\}\);/m, file.createSkill);
  }

  fs.writeFileSync(path.join(harnessRoot, file.path), text, 'utf8');
  console.log('patched', file.path);
}
