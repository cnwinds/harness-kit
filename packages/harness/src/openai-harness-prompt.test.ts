import { describe, expect, it } from 'vitest';
import { defaultHarnessConfig } from '@skillchat/harness-core';
import { buildOpenAIHarnessInstructions } from './openai-harness-prompt.js';

const createConfig = () => defaultHarnessConfig({
  CWD: '/workspace/qizhi',
  DATA_ROOT: '/tmp/harness-data',
  SKILLS_ROOT: '/tmp/harness-data/skills',
  OPENAI_API_KEY: 'test-token',
  OPENAI_BASE_URL: 'http://example.com/v1',
  NODE_ENV: 'test',
  LLM_REQUEST_TIMEOUT_MS: 1_000,
});

describe('buildOpenAIHarnessInstructions', () => {
  it('aligns skill guidance to the codex-style progressive disclosure rules', () => {
    const instructions = buildOpenAIHarnessInstructions({
      config: createConfig(),
      files: [],
      availableSkills: [{
        id: 'skill_1',
        name: 'zhangxuefeng-perspective',
        description: '以张雪峰风格给出专业和志愿建议。',
        directory: '/workspace/qizhi/skills/zhangxuefeng-perspective',
        source: 'legacy',
      }],
    });

    expect(instructions).toContain('以下列表是当前会话唯一可用的 skill');
    expect(instructions).toContain('Discovery: 上面的列表就是当前会话已启用的全部 skills');
    expect(instructions).toContain('Scope: 只有上面列出的 skill 可以被读取、参考或使用其目录中的脚本');
    expect(instructions).toContain('Trigger rules: 如果用户点名某个已启用 skill');
    expect(instructions).toContain('How to use a skill (progressive disclosure):');
    expect(instructions).toContain('只读取当前请求需要的具体文件，不要整包加载');
    expect(instructions).toContain('run_workspace_script');
    expect(instructions).toContain('按原生命令行运行');
    expect(instructions).toContain('不要假设存在默认 `run.py` 入口');
    expect(instructions).toContain('Context hygiene: 保持上下文精简');
    expect(instructions).toContain('Skill 是本地说明书，不是特殊流程节点');
    expect(instructions).toContain('是否调用、调用顺序和调用次数由你自行判断');
    expect(instructions).toContain('需要最新事实、新闻、政策、排名、招生、就业、薪资、分数线或官网信息时，必须先调用 `web_search`');
    expect(instructions).toContain('禁止凭空构造或猜测域名');
    expect(instructions).toContain('只有在你已经从 `web_search` 结果、用户输入或可靠来源中拿到明确 URL 时，才使用 `web_fetch`');
  });

  it('omits web tool routing when web search is disabled', () => {
    const instructions = buildOpenAIHarnessInstructions({
      config: createConfig(),
      files: [],
      availableSkills: [],
      webSearchEnabled: false,
    });

    expect(instructions).not.toContain('## Web Tools');
    expect(instructions).not.toContain('必须先调用 `web_search`');
  });
});
