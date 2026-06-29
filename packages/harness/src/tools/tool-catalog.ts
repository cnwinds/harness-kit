export type AssistantToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  supportsParallelToolCalls: boolean;
  executionKind: 'service' | 'runner';
};

export type ToolRuntimeCallbacks = {
  onToolCall?: (event: {
    callId: string;
    tool: string;
    arguments: Record<string, unknown>;
    hidden?: boolean;
    meta?: Record<string, unknown>;
  }) => Promise<void> | void;
  onToolProgress?: (event: {
    callId: string;
    tool: string;
    message: string;
    percent?: number;
    status?: string;
    hidden?: boolean;
    meta?: Record<string, unknown>;
  }) => Promise<void> | void;
  onToolResult?: (event: {
    callId: string;
    tool: string;
    summary: string;
    content?: string;
    hidden?: boolean;
    meta?: Record<string, unknown>;
  }) => Promise<void> | void;
  onArtifact?: (file: import('@skillchat/harness-protocol').FileRecord) => Promise<void> | void;
};

const createServiceTool = (tool: Omit<AssistantToolDefinition, 'executionKind'>): AssistantToolDefinition => ({
  ...tool,
  executionKind: 'service',
});

const createRunnerTool = (tool: Omit<AssistantToolDefinition, 'executionKind'>): AssistantToolDefinition => ({
  ...tool,
  executionKind: 'runner',
});

export const buildAssistantToolCatalog = (args: {
  assistantToolsEnabled: boolean;
  webSearchAvailable: boolean;
  imageGenerationAvailable: boolean;
  enabledSkillNames: string[];
}): AssistantToolDefinition[] => {
  const definitions: AssistantToolDefinition[] = args.assistantToolsEnabled
    ? [
        ...(args.webSearchAvailable
          ? [createServiceTool({
              name: 'web_search',
              description: '联网搜索公开网页并返回候选结果与页面摘要。不知道确切 URL 时必须先用此工具；适用于最新事实、新闻、政策、排名、招生分数线、就业薪资、学校官网等问题。',
              supportsParallelToolCalls: true,
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: '搜索问题或检索意图' },
                  maxResults: { type: 'number', description: '最多返回多少条结果，默认 5，最大 8' },
                },
                required: ['query'],
              },
            })]
          : []),
        ...(args.imageGenerationAvailable
          ? [createServiceTool({
              name: 'generate_image',
              description: '根据文字描述生成图片。用户明确要求画图、配图、海报、插画、封面或视觉稿时使用。',
              supportsParallelToolCalls: false,
              inputSchema: {
                type: 'object',
                properties: {
                  prompt: { type: 'string', description: '图片描述，尽量具体说明主体、风格、构图与用途' },
                  size: { type: 'string', description: '图片尺寸，如 1024x1024、1280x1280' },
                },
                required: ['prompt'],
              },
            })]
          : []),
        createServiceTool({
          name: 'web_fetch',
          description: '抓取已确认的网页 URL 并提取正文摘要。仅在你已有明确 URL（来自 web_search 结果或用户提供）时使用；禁止猜测域名。',
          supportsParallelToolCalls: true,
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: '需要访问的 http/https 地址' },
              maxChars: { type: 'number', description: '正文最大字符数，默认 4000' },
            },
            required: ['url'],
          },
        }),
        createServiceTool({
          name: 'list_files',
          description: '列出当前会话和共享空间中的文件。',
          supportsParallelToolCalls: true,
          inputSchema: {
            type: 'object',
            properties: {
              bucket: { type: 'string', enum: ['uploads', 'outputs', 'shared', 'all'] },
            },
          },
        }),
        createServiceTool({
          name: 'read_file',
          description: '读取当前会话或共享区中的文本文件片段。',
          supportsParallelToolCalls: true,
          inputSchema: {
            type: 'object',
            properties: {
              fileId: { type: 'string', description: '文件 id，优先级高于 fileName' },
              fileName: { type: 'string', description: '文件名或部分文件名' },
              startLine: { type: 'number', description: '起始行号，可选' },
              endLine: { type: 'number', description: '结束行号，可选' },
              maxChars: { type: 'number', description: '最多读取多少字符，默认 6000' },
            },
          },
        }),
        createServiceTool({
          name: 'list_workspace_paths',
          description: '列出当前工作区或当前会话目录中的文件与子目录。读取 skill 文件时，使用 root=workspace 并访问 skills/... 路径。',
          supportsParallelToolCalls: true,
          inputSchema: {
            type: 'object',
            properties: {
              root: { type: 'string', enum: ['workspace', 'session'] },
              path: { type: 'string', description: '相对于根目录的子路径' },
              depth: { type: 'number', description: '目录展开深度，默认 2，最大 4' },
              offset: { type: 'number', description: '分页起始位置' },
              limit: { type: 'number', description: '分页数量，默认 40，最大 120' },
            },
          },
        }),
        createServiceTool({
          name: 'read_workspace_path_slice',
          description: '读取当前工作区或当前会话目录中的文本文件片段。读取 skill 文件时，使用 root=workspace 并传入 skills/... 相对路径。',
          supportsParallelToolCalls: true,
          inputSchema: {
            type: 'object',
            properties: {
              root: { type: 'string', enum: ['workspace', 'session'] },
              path: { type: 'string', description: '相对于根目录的文件路径' },
              startLine: { type: 'number', description: '起始行号，可选' },
              endLine: { type: 'number', description: '结束行号，可选' },
              maxChars: { type: 'number', description: '最多返回多少字符，默认 6000' },
            },
            required: ['path'],
          },
        }),
        createServiceTool({
          name: 'write_artifact_file',
          description: '将文本内容写入当前会话 outputs 目录，生成可下载产物。',
          supportsParallelToolCalls: false,
          inputSchema: {
            type: 'object',
            properties: {
              fileName: { type: 'string', description: '要生成的文件名' },
              content: { type: 'string', description: '要写入的文本内容' },
              mimeType: { type: 'string', description: '文件 MIME 类型，可选' },
              subdir: { type: 'string', description: 'outputs 下的子目录，可选' },
              visibility: {
                type: 'string',
                enum: ['visible', 'hidden'],
                description: 'Use visible only for final user-downloadable deliverables. Use hidden for intermediate, scratch, package-part, or validation files.',
              },
            },
            required: ['fileName', 'content'],
          },
        }),
      ]
    : [];

  if (args.enabledSkillNames.length > 0) {
    definitions.push(createRunnerTool({
      name: 'run_workspace_script',
      description: '执行工作区内某个已启用 skill 脚本。脚本按原生命令行方式运行，先读取 `SKILL.md`，再按说明传入显式 `args`。',
      supportsParallelToolCalls: false,
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: `工作区相对脚本路径。若来自 skill，必须位于已启用 skill 的 scripts 目录下，例如 skills/${args.enabledSkillNames[0] ?? '<skill>'}/scripts/recalc.py。`,
          },
          args: {
            type: 'array',
            description: '按脚本原生命令行约定传入的位置参数与 flag，例如 ["uploads/form.pdf", "uploads/fields.json", "outputs/filled.pdf"]。',
            items: {
              type: 'string',
            },
          },
          cwdRoot: {
            type: 'string',
            enum: ['session', 'workspace'],
            description: '脚本工作目录根。默认 session；session 根目录下通常包含 uploads/、outputs/、tmp/。',
          },
          cwdPath: {
            type: 'string',
            description: '相对于 cwdRoot 的子目录，可选。',
          },
        },
        required: ['path'],
      },
    }));
  }

  return definitions;
};

export const findAssistantToolDefinition = (
  definitions: AssistantToolDefinition[],
  toolName: string,
) => definitions.find((definition) => definition.name === toolName);

export const toResponsesFunctionTool = (tool: AssistantToolDefinition) => ({
  type: 'function',
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema,
  strict: false,
});
