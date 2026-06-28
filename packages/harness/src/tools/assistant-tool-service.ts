import fs from 'node:fs/promises';
import dns from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import { z } from 'zod';
import type { FileRecord, SessionFileContext } from '@harnesskit/protocol';
import type { HarnessConfig, FileServiceLike, ProviderPrefsStore } from '@harnesskit/core';
import { runWebSearchProviderChain } from './web/search-chain.js';
import { assertPathInside, sanitizeFilename } from '@harnesskit/core';
import { getUserRoot, resolveUserPath } from '@harnesskit/core';
import type { SkillDescriptor } from '@harnesskit/core';
import type { ImageGenerationOrchestrator } from '../image/image-orchestrator.js';
import { buildImageGenerationFailureResult } from '../image/image-orchestrator.js';
import { buildImageProviderChain } from '../provider-capabilities.js';
import {
  ensureArtifactPath,
  formatListedWorkspaceEntries,
  isTextLikePath,
  listWorkspaceEntries,
  readTextSlice,
  resolveUserVisiblePath,
  resolveWorkspaceRoot,
  resolveWorkspacePath,
  type WorkspaceRootName,
} from './resource-access.js';

type PlannedAssistantToolCall = {
  tool: string;
  arguments: Record<string, unknown>;
};

export interface ExecutedAssistantToolResult {
  tool: string;
  arguments: Record<string, unknown>;
  summary: string;
  content: string;
  context?: string;
  artifacts?: FileRecord[];
}

const TOOL_TIMEOUT_MS = 15_000;
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
const privateIpv4Pattern = /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/;

export const networkResolver = {
  lookup: dnsLookup,
  getDefaultResultOrder: () => dns.getDefaultResultOrder(),
  setDefaultResultOrder: (order: ReturnType<typeof dns.getDefaultResultOrder>) => dns.setDefaultResultOrder(order),
};

const webSearchSchema = z.object({
  query: z.string().trim().min(2, 'query 不能为空'),
  maxResults: z.coerce.number().int().min(1).max(8).optional().default(5),
});

const generateImageSchema = z.object({
  prompt: z.string().trim().min(2, 'prompt 不能为空'),
  size: z.string().trim().optional(),
});

const webFetchSchema = z.object({
  url: z.string().trim().url('url 不合法'),
  maxChars: z.coerce.number().int().min(400).max(12_000).optional().default(4_000),
});

const listFilesSchema = z.object({
  bucket: z.enum(['uploads', 'outputs', 'shared', 'all']).optional().default('all'),
});

const readFileSchema = z.object({
  fileId: z.string().trim().min(1).optional(),
  fileName: z.string().trim().min(1).optional(),
  startLine: z.coerce.number().int().positive().optional(),
  endLine: z.coerce.number().int().positive().optional(),
  maxChars: z.coerce.number().int().min(400).max(12_000).optional().default(6_000),
}).refine((value) => value.fileId || value.fileName, {
  message: 'fileId 或 fileName 至少提供一个',
});

const listWorkspacePathsSchema = z.object({
  root: z.enum(['workspace', 'session']).optional().default('workspace'),
  path: z.string().trim().optional().default(''),
  depth: z.coerce.number().int().min(0).max(4).optional().default(2),
  offset: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(120).optional().default(40),
});

const readWorkspacePathSliceSchema = z.object({
  root: z.enum(['workspace', 'session']).optional().default('workspace'),
  path: z.string().trim().min(1, 'path 不能为空'),
  startLine: z.coerce.number().int().positive().optional(),
  endLine: z.coerce.number().int().positive().optional(),
  maxChars: z.coerce.number().int().min(400).max(12_000).optional().default(6_000),
});

const writeArtifactFileSchema = z.object({
  fileName: z.string().trim().min(1, 'fileName 不能为空'),
  content: z.string().min(1, 'content 不能为空'),
  mimeType: z.string().trim().optional(),
  subdir: z.string().trim().optional(),
  visibility: z.enum(['visible', 'hidden']).optional(),
});

const decodeHtmlEntities = (input: string) =>
  input
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&apos;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

const stripTags = (input: string) => decodeHtmlEntities(input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const normalizeWhitespace = (input: string) => input.replace(/\n{3,}/g, '\n\n').trim();
const stripScriptsAndStyles = (input: string) => input
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');
const truncate = (input: string, maxChars: number) => (input.length > maxChars ? `${input.slice(0, maxChars)}...` : input);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isBlockedHostname = (hostname: string) => {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    privateIpv4Pattern.test(lower)
  );
};

const assertPublicHttpUrl = (input: string) => {
  const url = new URL(input);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('只支持 http/https 网页地址');
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error('不允许访问本地或内网地址');
  }

  return url;
};

const toSessionToolPath = (relativePath: string) => {
  const normalized = relativePath.replace(/\\/g, '/');
  const sessionMatch = normalized.match(/^sessions\/[^/]+\/(.+)$/);
  return sessionMatch?.[1] ?? normalized;
};

const formatFileList = (files: SessionFileContext[]) =>
  files.map((file) => [
    `- ${file.name}`,
    `  id: ${file.id}`,
    `  bucket: ${file.bucket}`,
    `  mimeType: ${file.mimeType ?? 'application/octet-stream'}`,
    `  size: ${file.size}`,
    `  userPath: ${file.relativePath}`,
    `  sessionPath: ${toSessionToolPath(file.relativePath)}`,
  ].join('\n')).join('\n');

const findFilesByName = (files: SessionFileContext[], fileName: string) => {
  const lower = fileName.toLowerCase();
  const exact = files.filter((file) => file.name.toLowerCase() === lower);
  if (exact.length > 0) {
    return exact;
  }
  return files.filter((file) => file.name.toLowerCase().includes(lower));
};

const readCauseCode = (error: unknown) => {
  if (typeof error !== 'object' || !error || !('cause' in error)) {
    return null;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause !== 'object' || !cause || !('code' in cause)) {
    return null;
  }

  return String((cause as { code?: unknown }).code ?? '');
};

const shouldRetryWithIpv4 = (error: unknown) => readCauseCode(error) === 'UND_ERR_CONNECT_TIMEOUT';

const hostHasDualStackAddresses = async (hostname: string) => {
  try {
    const records = await networkResolver.lookup(hostname, { all: true });
    const families = new Set(records.map((record) => record.family));
    return families.has(4) && families.has(6);
  } catch {
    return false;
  }
};

const extractMetaContent = (html: string, key: string) => {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+name=["']${key}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+property=["']${key}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return stripTags(match[1]);
    }
  }

  return '';
};

const extractHtmlExcerpt = (html: string, maxChars: number) => {
  const sanitized = stripScriptsAndStyles(html);
  const title = stripTags(sanitized.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const description = extractMetaContent(sanitized, 'description') || extractMetaContent(sanitized, 'og:description');
  const body = stripTags(
    sanitized
      .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n'),
  );
  const excerpt = normalizeWhitespace(body).slice(0, maxChars);

  return [
    title ? `标题：${title}` : '',
    description ? `摘要：${description}` : '',
    excerpt ? `正文：\n${excerpt}` : '',
  ].filter(Boolean).join('\n\n');
};

const normalizeWorkspaceToolPath = (value?: string) => value
  ? value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  : '';

const matchSkillVirtualPath = (
  requestedPath: string | undefined,
  availableSkills: SkillDescriptor[],
) => {
  const normalizedPath = normalizeWorkspaceToolPath(requestedPath);
  if (normalizedPath === 'skills') {
    return {
      kind: 'skills-root' as const,
      normalizedPath,
    };
  }

  const skill = [...availableSkills]
    .sort((left, right) => right.name.length - left.name.length)
    .find((item) => {
      const prefix = `skills/${item.name}`;
      return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
    });

  if (!skill) {
    return null;
  }

  const prefix = `skills/${skill.name}`;
  return {
    kind: 'skill' as const,
    skill,
    normalizedPath,
    relativePath: normalizedPath === prefix ? '' : normalizedPath.slice(prefix.length + 1),
  };
};

const formatVirtualSkillEntries = (skills: SkillDescriptor[]) => skills
  .map((skill) => `- skills/${skill.name}/ (${skill.source ?? 'legacy'}${skill.version ? `@${skill.version}` : ''})`)
  .join('\n');

const isWebSearchDisabled = (config: HarnessConfig) => config.WEB_SEARCH_MODE === 'disabled';

export class AssistantToolService {
  constructor(
    private readonly config: HarnessConfig,
    private readonly fileService: FileServiceLike,
    private readonly prefsStore: ProviderPrefsStore,
    private readonly imageOrchestrator: ImageGenerationOrchestrator,
  ) {}

  async execute(args: {
    userId: string;
    sessionId: string;
    call: PlannedAssistantToolCall;
    availableSkills?: SkillDescriptor[];
  }): Promise<ExecutedAssistantToolResult> {
    switch (args.call.tool) {
      case 'web_search':
        return this.executeWebSearch(args.call.arguments);
      case 'generate_image':
        return this.executeGenerateImage(args.userId, args.sessionId, args.call.arguments);
      case 'web_fetch':
        return this.executeWebFetch(args.call.arguments);
      case 'list_files':
        return this.executeListFiles(args.userId, args.sessionId, args.call.arguments);
      case 'read_file':
        return this.executeReadFile(args.userId, args.sessionId, args.call.arguments);
      case 'list_workspace_paths':
        return this.executeListWorkspacePaths(
          args.userId,
          args.sessionId,
          args.call.arguments,
          args.availableSkills ?? [],
        );
      case 'read_workspace_path_slice':
        return this.executeReadWorkspacePathSlice(
          args.userId,
          args.sessionId,
          args.call.arguments,
          args.availableSkills ?? [],
        );
      case 'write_artifact_file':
        return this.executeWriteArtifactFile(args.userId, args.sessionId, args.call.arguments);
      default:
        throw new Error(`未知工具：${args.call.tool}`);
    }
  }

  private assertWorkspaceSkillPathAccess(
    root: WorkspaceRootName,
    requestedPath: string | undefined,
    availableSkills: SkillDescriptor[],
  ) {
    if (root !== 'workspace') {
      return;
    }

    const normalizedPath = normalizeWorkspaceToolPath(requestedPath);
    if (!normalizedPath) {
      return;
    }

    if (!normalizedPath.startsWith('skills')) {
      return;
    }

    if (normalizedPath === 'skills') {
      if (availableSkills.length === 0) {
        throw new Error('当前会话未启用任何 Skill，不能访问 skills 目录');
      }
      return;
    }

    if (!matchSkillVirtualPath(normalizedPath, availableSkills)) {
      const requestedSkillName = normalizedPath.split('/').filter(Boolean)[1] ?? normalizedPath;
      throw new Error(`当前会话未启用 Skill：${requestedSkillName}（路径：${normalizedPath}）`);
    }
  }

  private filterWorkspaceEntriesForSkillScope(
    requestedPath: string | undefined,
    entries: Awaited<ReturnType<typeof listWorkspaceEntries>>['entries'],
    availableSkills: SkillDescriptor[],
  ) {
    const normalizedBasePath = normalizeWorkspaceToolPath(requestedPath);
    const allowedSkillNames = new Set(availableSkills.map((skill) => skill.name));

    return entries.filter((entry) => {
      const fullPath = [normalizedBasePath, normalizeWorkspaceToolPath(entry.relativePath)]
        .filter(Boolean)
        .join('/');

      if (!fullPath.startsWith('skills')) {
        return true;
      }

      if (fullPath === 'skills') {
        return allowedSkillNames.size > 0;
      }

      const segments = fullPath.split('/');
      if (segments[0] !== 'skills') {
        return true;
      }

      const skillName = segments[1];
      return typeof skillName === 'string' && allowedSkillNames.has(skillName);
    });
  }

  private formatFetchError(url: string, error: unknown, action: string) {
    const hostname = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    })();

    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return `${action}超时：${hostname}`;
    }

    const causeCode = readCauseCode(error);
    if (causeCode === 'UND_ERR_CONNECT_TIMEOUT') {
      return `${action}超时：${hostname}`;
    }
    if (causeCode === 'ECONNREFUSED') {
      return `${action}被拒绝：${hostname}`;
    }
    if (causeCode === 'ENOTFOUND') {
      return `${action}失败：无法解析域名 ${hostname}`;
    }

    if (error instanceof Error && error.message && error.message !== 'fetch failed') {
      return `${action}失败：${error.message}`;
    }

    return `${action}失败：${hostname}`;
  }

  private async fetchText(url: string, action: string, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
    const requestInit = {
      signal: AbortSignal.timeout(TOOL_TIMEOUT_MS),
      headers: {
        'user-agent': BROWSER_USER_AGENT,
        accept,
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    } satisfies RequestInit;

    let response: Response;
    try {
      response = await fetch(url, requestInit);
    } catch (error) {
      const hostname = new URL(url).hostname;
      if (shouldRetryWithIpv4(error) && await hostHasDualStackAddresses(hostname)) {
        const previousOrder = networkResolver.getDefaultResultOrder();
        try {
          networkResolver.setDefaultResultOrder('ipv4first');
          response = await fetch(url, requestInit);
        } catch (retryError) {
          throw new Error(this.formatFetchError(url, retryError, action));
        } finally {
          networkResolver.setDefaultResultOrder(previousOrder);
        }
      } else {
        throw new Error(this.formatFetchError(url, error, action));
      }
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${action}失败：HTTP ${response.status} ${body.slice(0, 160)}`.trim());
    }

    return {
      body: await response.text(),
      contentType: response.headers.get('content-type') ?? '',
      finalUrl: response.url,
    };
  }

  private async executeWebSearch(rawArguments: Record<string, unknown>): Promise<ExecutedAssistantToolResult> {
    if (isWebSearchDisabled(this.config)) {
      throw new Error('当前配置已禁用 web_search');
    }
    const input = webSearchSchema.parse(rawArguments);

    return runWebSearchProviderChain({
      config: this.config,
      prefsStore: this.prefsStore,
      input,
      fetchPageText: (url, action) => this.fetchText(url, action),
    });
  }

  private async executeGenerateImage(
    userId: string,
    sessionId: string,
    rawArguments: Record<string, unknown>,
  ): Promise<ExecutedAssistantToolResult> {
    const input = generateImageSchema.parse(rawArguments);
    const chain = buildImageProviderChain(this.config, await this.prefsStore.getPreferredImageProvider());

    try {
      const saved = await this.imageOrchestrator.generate({
        userId,
        sessionId,
        request: {
          prompt: input.prompt,
          size: input.size,
        },
      });

      return {
        tool: 'generate_image',
        arguments: input,
        summary: `已通过 ${saved.model} 生成图片`,
        content: [
          `提示词：${input.prompt}`,
          `模型：${saved.model}`,
          `文件：${saved.file.displayName}`,
          saved.revisedPrompt ? `优化后提示词：${saved.revisedPrompt}` : '',
        ].filter(Boolean).join('\n\n'),
        artifacts: [saved.file],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failure = buildImageGenerationFailureResult({
        prompt: input.prompt,
        chain,
        errors: [message],
      });

      return {
        tool: 'generate_image',
        arguments: input,
        summary: failure.summary,
        content: failure.content,
        context: failure.content,
      };
    }
  }

  private async executeWebFetch(rawArguments: Record<string, unknown>): Promise<ExecutedAssistantToolResult> {
    const input = webFetchSchema.parse(rawArguments);
    const url = assertPublicHttpUrl(input.url);
    const response = await this.fetchText(url.toString(), '访问网页');
    const excerpt = response.contentType.includes('text/html')
      ? extractHtmlExcerpt(response.body, input.maxChars)
      : normalizeWhitespace(response.body).slice(0, input.maxChars);

    return {
      tool: 'web_fetch',
      arguments: input,
      summary: `已抓取网页 ${url.hostname}`,
      content: [
        `网页地址：${response.finalUrl || url.toString()}`,
        `网页正文预览：\n${excerpt}`,
      ].join('\n\n'),
    };
  }

  private async executeListFiles(
    userId: string,
    sessionId: string,
    rawArguments: Record<string, unknown>,
  ): Promise<ExecutedAssistantToolResult> {
    const input = listFilesSchema.parse(rawArguments);
    const files = this.fileService.getFileContext(userId, sessionId)
      .filter((file) => input.bucket === 'all' || file.bucket === input.bucket);

    return {
      tool: 'list_files',
      arguments: input,
      summary: `当前可用文件 ${files.length} 个`,
      content: files.length > 0
        ? `当前会话可用文件如下：\n${formatFileList(files)}`
        : '当前会话没有可读取的文件。',
      context: files.length > 0 ? formatFileList(files) : '当前会话没有可读取的文件。',
    };
  }

  private async executeReadFile(
    userId: string,
    sessionId: string,
    rawArguments: Record<string, unknown>,
  ): Promise<ExecutedAssistantToolResult> {
    const input = readFileSchema.parse(rawArguments);
    const files = this.fileService.getFileContext(userId, sessionId);

    let target = input.fileId
      ? files.find((file) => file.id === input.fileId)
      : undefined;

    if (!target && input.fileName) {
      const matches = findFilesByName(files, input.fileName);
      if (matches.length > 1) {
        return {
          tool: 'read_file',
          arguments: input,
          summary: `匹配到 ${matches.length} 个候选文件`,
          content: `文件名不够明确，请改用 fileId。候选文件如下：\n${formatFileList(matches)}`,
        };
      }
      target = matches[0];
    }

    if (!target) {
      return {
        tool: 'read_file',
        arguments: input,
        summary: '未找到目标文件',
        content: '没有找到符合条件的文件，请先调用 list_files 查看当前会话里的文件。',
      };
    }

    const userRoot = getUserRoot(this.config, userId);
    const absolutePath = resolveUserPath(this.config, userId, target.relativePath);
    assertPathInside(userRoot, absolutePath);
    const fileStat = await fs.stat(absolutePath);

    if (!isTextLikePath(target.name, target.mimeType)) {
      return {
        tool: 'read_file',
        arguments: input,
        summary: `文件 ${target.name} 不支持直接文本读取`,
        content: [
          `文件名：${target.name}`,
          `文件 id：${target.id}`,
          `mimeType：${target.mimeType ?? 'application/octet-stream'}`,
          `大小：${fileStat.size}`,
          '当前只支持直接读取文本类文件；二进制文件可先转换为文本或让系统基于文件元数据继续处理。',
        ].join('\n'),
      };
    }

    const slice = await readTextSlice({
      filePath: absolutePath,
      startLine: input.startLine,
      endLine: input.endLine,
      maxChars: input.maxChars,
    });

    return {
      tool: 'read_file',
      arguments: input,
      summary: `已读取文件 ${target.name}${slice.range ? `（${slice.range.startLine}-${slice.range.endLine} 行）` : ''}`,
      content: [
        `文件名：${target.name}`,
        `文件 id：${target.id}`,
        `相对路径：${target.relativePath}`,
        slice.range ? `行范围：${slice.range.startLine}-${slice.range.endLine}` : '',
        slice.truncated ? '说明：内容过长，已截断显示' : '',
        '文件内容：',
        slice.excerpt,
      ].filter(Boolean).join('\n\n'),
      context: slice.excerpt,
    };
  }

  private async executeListWorkspacePaths(
    userId: string,
    sessionId: string,
    rawArguments: Record<string, unknown>,
    availableSkills: SkillDescriptor[],
  ): Promise<ExecutedAssistantToolResult> {
    const input = listWorkspacePathsSchema.parse(rawArguments);
    const virtualSkillPath = input.root === 'workspace'
      ? matchSkillVirtualPath(input.path, availableSkills)
      : null;

    if (virtualSkillPath?.kind === 'skills-root') {
      return {
        tool: 'list_workspace_paths',
        arguments: input,
        summary: `当前会话启用 ${availableSkills.length} 个 Skill`,
        content: availableSkills.length > 0
          ? `当前会话可用 Skill：\n${formatVirtualSkillEntries(availableSkills)}`
          : '当前会话未启用任何 Skill。',
        context: availableSkills.map((skill) => `skill:${skill.name}`).join('\n'),
      };
    }

    if (virtualSkillPath?.kind === 'skill') {
      const descriptor = {
        root: 'workspace' as const,
        absoluteRoot: virtualSkillPath.skill.directory,
        label: `Skill ${virtualSkillPath.skill.name}`,
      };
      const listed = await listWorkspaceEntries({
        descriptor,
        requestedPath: virtualSkillPath.relativePath,
        depth: input.depth,
        offset: input.offset,
        limit: input.limit,
      });

      return {
        tool: 'list_workspace_paths',
        arguments: input,
        summary: `${descriptor.label} 命中 ${listed.entries.length} 项${listed.hasMore ? '（已分页）' : ''}`,
        content: [
          `Skill：${virtualSkillPath.skill.name}`,
          virtualSkillPath.skill.version ? `版本：${virtualSkillPath.skill.version}` : '',
          `虚拟路径：${virtualSkillPath.normalizedPath}`,
          listed.hasMore ? `分页：offset=${input.offset}, limit=${input.limit}` : '',
          listed.entries.length > 0 ? `目录内容：\n${formatListedWorkspaceEntries(listed.entries)}` : '目录为空。',
        ].filter(Boolean).join('\n\n'),
        context: listed.entries.map((entry) => `${entry.kind}:${entry.relativePath}`).join('\n'),
      };
    }

    this.assertWorkspaceSkillPathAccess(input.root as WorkspaceRootName, input.path, availableSkills);
    const descriptor = resolveWorkspaceRoot({
      config: this.config,
      userId,
      sessionId,
      root: input.root as WorkspaceRootName,
    });
    const listed = await listWorkspaceEntries({
      descriptor,
      requestedPath: input.path,
      depth: input.depth,
      offset: input.offset,
      limit: input.limit,
    });
    const visibleEntries = input.root === 'workspace'
      ? this.filterWorkspaceEntriesForSkillScope(input.path, listed.entries, availableSkills)
      : listed.entries;

    return {
      tool: 'list_workspace_paths',
      arguments: input,
      summary: `${descriptor.label} 命中 ${visibleEntries.length} 项${listed.hasMore ? '（已分页）' : ''}`,
      content: [
        `根目录：${descriptor.label}`,
        `根路径：${descriptor.absoluteRoot}`,
        input.path ? `子路径：${input.path}` : '',
        `总条目：${input.root === 'workspace' ? visibleEntries.length : listed.total}`,
        listed.hasMore ? `分页：offset=${input.offset}, limit=${input.limit}` : '',
        visibleEntries.length > 0 ? `目录内容：\n${formatListedWorkspaceEntries(visibleEntries)}` : '目录为空。',
      ].filter(Boolean).join('\n\n'),
      context: visibleEntries.map((entry) => `${entry.kind}:${entry.relativePath}`).join('\n'),
    };
  }

  private async executeReadWorkspacePathSlice(
    userId: string,
    sessionId: string,
    rawArguments: Record<string, unknown>,
    availableSkills: SkillDescriptor[],
  ): Promise<ExecutedAssistantToolResult> {
    const input = readWorkspacePathSliceSchema.parse(rawArguments);
    const virtualSkillPath = input.root === 'workspace'
      ? matchSkillVirtualPath(input.path, availableSkills)
      : null;

    if (virtualSkillPath?.kind === 'skills-root') {
      throw new Error('目标路径是 Skill 根目录，请指定具体 Skill 文件路径');
    }

    if (virtualSkillPath?.kind === 'skill') {
      const descriptor = {
        root: 'workspace' as const,
        absoluteRoot: virtualSkillPath.skill.directory,
        label: `Skill ${virtualSkillPath.skill.name}`,
      };
      const absolutePath = resolveWorkspacePath(descriptor, virtualSkillPath.relativePath);
      const stat = await fs.stat(absolutePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          throw new Error(`路径不存在：${input.path}`);
        }
        throw error;
      });

      if (stat.isDirectory()) {
        return {
          tool: 'read_workspace_path_slice',
          arguments: input,
          summary: '目标路径是目录，无法直接读取',
          content: `目标 ${input.path} 是目录，请先用 list_workspace_paths 查看其下内容。`,
        };
      }

      if (!isTextLikePath(absolutePath)) {
        return {
          tool: 'read_workspace_path_slice',
          arguments: input,
          summary: `文件 ${input.path} 不支持直接文本读取`,
          content: `路径 ${input.path} 不是可直接读取的文本文件，请改为读取文本类文件或通过 Skill 处理。`,
        };
      }

      const slice = await readTextSlice({
        filePath: absolutePath,
        startLine: input.startLine,
        endLine: input.endLine,
        maxChars: input.maxChars,
      });

      return {
        tool: 'read_workspace_path_slice',
        arguments: input,
        summary: `已读取 ${descriptor.label} / ${virtualSkillPath.relativePath || '.'}${slice.range ? `（${slice.range.startLine}-${slice.range.endLine} 行）` : ''}`,
        content: [
          `Skill：${virtualSkillPath.skill.name}`,
          virtualSkillPath.skill.version ? `版本：${virtualSkillPath.skill.version}` : '',
          `虚拟路径：${virtualSkillPath.normalizedPath}`,
          slice.range ? `行范围：${slice.range.startLine}-${slice.range.endLine}` : '',
          slice.truncated ? '说明：内容过长，已截断显示' : '',
          '文件内容：',
          slice.excerpt,
        ].filter(Boolean).join('\n\n'),
        context: slice.excerpt,
      };
    }

    this.assertWorkspaceSkillPathAccess(input.root as WorkspaceRootName, input.path, availableSkills);
    const descriptor = resolveWorkspaceRoot({
      config: this.config,
      userId,
      sessionId,
      root: input.root as WorkspaceRootName,
    });
    const absolutePath = resolveWorkspacePath(descriptor, input.path);
    const stat = await fs.stat(absolutePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        throw new Error(`路径不存在：${input.path}`);
      }
      throw error;
    });

    if (stat.isDirectory()) {
      return {
        tool: 'read_workspace_path_slice',
        arguments: input,
        summary: '目标路径是目录，无法直接读取',
        content: `目标 ${input.path} 是目录，请先用 list_workspace_paths 查看其下内容。`,
      };
    }

    if (!isTextLikePath(absolutePath)) {
      return {
        tool: 'read_workspace_path_slice',
        arguments: input,
        summary: `文件 ${input.path} 不支持直接文本读取`,
        content: `路径 ${input.path} 不是可直接读取的文本文件，请改为读取文本类文件或通过 Skill 处理。`,
      };
    }

    const slice = await readTextSlice({
      filePath: absolutePath,
      startLine: input.startLine,
      endLine: input.endLine,
      maxChars: input.maxChars,
    });

    return {
      tool: 'read_workspace_path_slice',
      arguments: input,
      summary: `已读取 ${descriptor.label} / ${input.path}${slice.range ? `（${slice.range.startLine}-${slice.range.endLine} 行）` : ''}`,
      content: [
        `根目录：${descriptor.label}`,
        `路径：${input.path}`,
        `可见路径：${resolveUserVisiblePath(this.config, userId, absolutePath)}`,
        slice.range ? `行范围：${slice.range.startLine}-${slice.range.endLine}` : '',
        slice.truncated ? '说明：内容过长，已截断显示' : '',
        '文件内容：',
        slice.excerpt,
      ].filter(Boolean).join('\n\n'),
      context: slice.excerpt,
    };
  }

  private async executeWriteArtifactFile(
    userId: string,
    sessionId: string,
    rawArguments: Record<string, unknown>,
  ): Promise<ExecutedAssistantToolResult> {
    const input = writeArtifactFileSchema.parse(rawArguments);
    const fileName = sanitizeFilename(input.fileName);
    const absolutePath = await ensureArtifactPath(this.config, userId, sessionId, fileName, input.subdir);
    await fs.writeFile(absolutePath, input.content, 'utf8');

    const fileRecord = await this.fileService.recordGeneratedFile({
      userId,
      sessionId,
      absolutePath,
      displayName: fileName,
      visibility: input.visibility,
    });

    return {
      tool: 'write_artifact_file',
      arguments: {
        ...input,
        fileName,
      },
      summary: fileRecord.visibility === 'hidden'
        ? `Wrote intermediate file ${fileRecord.displayName}`
        : `已写入产物 ${fileRecord.displayName}`,
      content: [
        `文件名：${fileRecord.displayName}`,
        `相对路径：${fileRecord.relativePath}`,
        fileRecord.visibility === 'hidden'
          ? 'Visibility: hidden intermediate file'
          : `下载地址：${fileRecord.downloadUrl}`,
        '写入内容预览：',
        truncate(input.content, 2_000),
      ].join('\n\n'),
      context: `artifact:${fileRecord.displayName}\npath:${fileRecord.relativePath}`,
      artifacts: [fileRecord],
    };
  }
}
