import type { HarnessConfig } from '@skillchat/harness-core';
import type { ImageProvider, ImageProviderId } from './image-types.js';
import {
  buildImageApiUrl,
  parseBailianImageResponse,
  parseOpenAIImageResponse,
  parseZhipuImageResponse,
  resolveBailianImageBaseUrl,
  resolveDashScopeImageApiKey,
  resolveOpenAIImageBaseUrl,
  resolveOpenAIImageModel,
  resolveZhipuImageBaseUrl,
  resolveZhipuImageModel,
} from './image-provider-utils.js';

const readJsonResponse = async (response: Response, label: string) => {
  const text = await response.text();
  if (!response.ok) {
    let message = `${label}失败：HTTP ${response.status}`;
    try {
      const errorData = JSON.parse(text) as { message?: string; error?: { message?: string } };
      message = errorData.message || errorData.error?.message || message;
    } catch {
      message += ` ${text.slice(0, 200)}`;
    }
    throw new Error(message);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label}失败：响应不是合法 JSON`);
  }
};

const normalizeOpenAISize = (size?: string) => size?.trim() || '1024x1024';
const normalizeZhipuSize = (size?: string) => size?.trim() || '1280x1280';
const normalizeBailianSize = (size?: string) => size?.trim()?.replace(/x/gi, '*') || '1024*1024';

export const createOpenAIImagesProvider = (config: HarnessConfig): ImageProvider => {
  const apiKey = config.OPENAI_IMAGE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OpenAI 生图未配置 OPENAI_IMAGE_API_KEY');
  }
  const model = resolveOpenAIImageModel(config);
  const apiUrl = buildImageApiUrl(resolveOpenAIImageBaseUrl(config), 'openai');

  return {
    id: 'openai_images',
    displayName: 'OpenAI Images API',
    model,
    async generate(request) {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          size: normalizeOpenAISize(request.size),
          n: 1,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      const parsed = parseOpenAIImageResponse(await readJsonResponse(response, 'OpenAI 生图'));
      return {
        providerId: 'openai_images',
        model,
        ...parsed,
      };
    },
  };
};

export const createZhipuImageProvider = (config: HarnessConfig): ImageProvider => {
  const apiKey = config.ZHIPU_IMAGE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('智谱生图未配置 ZHIPU_IMAGE_API_KEY');
  }
  const model = resolveZhipuImageModel(config);
  const apiUrl = buildImageApiUrl(resolveZhipuImageBaseUrl(config), 'zhipu');

  return {
    id: 'zhipu',
    displayName: '智谱生图',
    model,
    async generate(request) {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          size: normalizeZhipuSize(request.size),
          quality: 'hd',
          watermark_enabled: true,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      const parsed = parseZhipuImageResponse(await readJsonResponse(response, '智谱生图'));
      return {
        providerId: 'zhipu',
        model,
        ...parsed,
      };
    },
  };
};

export const createBailianImageProvider = (config: HarnessConfig): ImageProvider => {
  const apiKey = resolveDashScopeImageApiKey(config);
  if (!apiKey) {
    throw new Error('百炼生图未配置 DASHSCOPE_IMAGE_API_KEY');
  }
  const model = config.DASHSCOPE_IMAGE_MODEL?.trim();
  if (!model) {
    throw new Error('百炼生图未配置 DASHSCOPE_IMAGE_MODEL');
  }
  const apiUrl = buildImageApiUrl(resolveBailianImageBaseUrl(config), 'bailian');

  return {
    id: 'bailian',
    displayName: '百炼生图',
    model,
    async generate(request) {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: {
            messages: [{
              role: 'user',
              content: [{ text: request.prompt }],
            }],
          },
          parameters: {
            size: normalizeBailianSize(request.size),
            prompt_extend: false,
          },
        }),
        signal: AbortSignal.timeout(60_000),
      });

      const parsed = parseBailianImageResponse(await readJsonResponse(response, '百炼生图'));
      return {
        providerId: 'bailian',
        model,
        ...parsed,
      };
    },
  };
};

export const createConfiguredImageProvider = (
  providerId: ImageProviderId,
  config: HarnessConfig,
): ImageProvider => {
  switch (providerId) {
    case 'openai_images':
      return createOpenAIImagesProvider(config);
    case 'zhipu':
      return createZhipuImageProvider(config);
    case 'bailian':
      return createBailianImageProvider(config);
    default:
      throw new Error(`未支持的生图 provider：${String(providerId)}`);
  }
};
