import type { HarnessConfig } from '@harnesskit/core';
import type { ImageProviderId } from './image-types.js';

export type ImageProviderKind = 'openai' | 'zhipu' | 'bailian';

export const getImageProviderLabel = (providerId: ImageProviderId) => {
  switch (providerId) {
    case 'openai_images':
      return 'OpenAI Images API';
    case 'zhipu':
      return '智谱生图';
    case 'bailian':
      return '百炼生图';
    default:
      return providerId;
  }
};

export const buildImageApiUrl = (apiBase: string, kind: ImageProviderKind): string => {
  const trimmedBase = apiBase.trim();

  if (kind === 'zhipu') {
    if (/\/images\/generations\/?$/i.test(trimmedBase)) {
      return trimmedBase;
    }
    return 'https://open.bigmodel.cn/api/paas/v4/images/generations';
  }

  if (kind === 'openai') {
    if (/\/images\/generations\/?$/i.test(trimmedBase)) {
      return trimmedBase;
    }
    const base = (trimmedBase || 'https://api.openai.com')
      .replace(/\/v1\/?$/i, '')
      .replace(/\/$/, '');
    return `${base}/v1/images/generations`;
  }

  const base = trimmedBase || 'https://dashscope.aliyuncs.com';
  if (base.includes('/api/v1/services/aigc/')) {
    return base;
  }

  try {
    const url = new URL(base);
    return `${url.protocol}//${url.host}/api/v1/services/aigc/multimodal-generation/generation`;
  } catch {
    return `${base.replace(/\/.*$/, '').replace(/\/$/, '')}/api/v1/services/aigc/multimodal-generation/generation`;
  }
};

export const resolveOpenAIImageModel = (config: HarnessConfig) => (
  config.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2'
);

export const resolveZhipuImageModel = (config: HarnessConfig) => (
  config.ZHIPU_IMAGE_MODEL?.trim() || 'glm-image'
);

export const resolveDashScopeImageApiKey = (config: HarnessConfig) => (
  config.DASHSCOPE_IMAGE_API_KEY?.trim() || undefined
);

export const resolveOpenAIImageBaseUrl = (config: HarnessConfig) => (
  config.OPENAI_IMAGE_BASE_URL?.trim() || 'https://api.openai.com/v1'
);

export const resolveZhipuImageBaseUrl = (config: HarnessConfig) => (
  config.ZHIPU_IMAGE_BASE_URL?.trim() || 'https://open.bigmodel.cn/api/paas/v4'
);

export const resolveBailianImageBaseUrl = (config: HarnessConfig) => (
  config.DASHSCOPE_IMAGE_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com'
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

export const parseOpenAIImageResponse = (payload: unknown) => {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('OpenAI 图片接口未返回 data 数组');
  }

  for (const item of payload.data) {
    if (!isRecord(item)) {
      continue;
    }
    if (typeof item.b64_json === 'string' && item.b64_json.trim()) {
      return {
        base64: item.b64_json.trim(),
        revisedPrompt: typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined,
      };
    }
    if (typeof item.url === 'string' && item.url.trim()) {
      return {
        imageUrl: item.url.trim(),
        revisedPrompt: typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined,
      };
    }
  }

  throw new Error('OpenAI 图片接口未返回可用图片');
};

export const parseZhipuImageResponse = (payload: unknown) => {
  if (!isRecord(payload) || !Array.isArray(payload.data) || !isRecord(payload.data[0])) {
    throw new Error('智谱图片接口响应格式无效');
  }
  const url = payload.data[0].url;
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('智谱图片接口未返回 url');
  }
  return { imageUrl: url.trim() };
};

export const parseBailianImageResponse = (payload: unknown) => {
  if (!isRecord(payload)) {
    throw new Error('百炼图片接口响应格式无效');
  }

  const output = payload.output;
  if (isRecord(output) && Array.isArray(output.choices) && isRecord(output.choices[0])) {
    const message = output.choices[0].message;
    if (isRecord(message) && Array.isArray(message.content)) {
      for (const item of message.content) {
        if (!isRecord(item)) {
          continue;
        }
        const imageUrl = typeof item.image_url === 'string'
          ? item.image_url
          : typeof item.image === 'string' && item.image.startsWith('http')
            ? item.image
            : undefined;
        const base64 = typeof item.image === 'string' && !item.image.startsWith('http')
          ? item.image
          : undefined;
        if (imageUrl || base64) {
          return { imageUrl, base64, revisedPrompt: undefined };
        }
      }
    }
  }

  if (isRecord(output) && Array.isArray(output.results) && isRecord(output.results[0])) {
    const result = output.results[0];
    return {
      imageUrl: typeof result.url === 'string'
        ? result.url
        : typeof result.image_url === 'string'
          ? result.image_url
          : undefined,
      base64: typeof result.image_base64 === 'string'
        ? result.image_base64
        : typeof result.image === 'string'
          ? result.image
          : undefined,
    };
  }

  if (isRecord(output) && typeof output.task_id === 'string') {
    throw new Error(`百炼图片接口返回异步任务，当前不支持轮询：${output.task_id}`);
  }

  throw new Error('百炼图片接口未返回可用图片');
};

import { safeFetch } from '../tools/safe-fetch.js';

export const fetchImageAsBase64 = async (imageUrl: string) => {
  const response = await safeFetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`下载图片失败：HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
};

export const resolveImageBytes = async (result: { base64?: string; imageUrl?: string }) => {
  if (result.base64?.trim()) {
    return result.base64.trim();
  }
  if (result.imageUrl?.trim()) {
    return await fetchImageAsBase64(result.imageUrl.trim());
  }
  throw new Error('图片 provider 未返回 base64 或 url');
};
