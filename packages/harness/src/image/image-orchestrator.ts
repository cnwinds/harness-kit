import type { HarnessConfig, ProviderPrefsStore } from '@harnesskit/core';
import type { OpenAIImageService } from '../openai-image-service.js';
import { buildImageProviderChain } from '../provider-capabilities.js';
import { createConfiguredImageProvider } from './image-provider-registry.js';
import { getImageProviderLabel, resolveImageBytes } from './image-provider-utils.js';
import type { ImageGenerationRequest, ImageProviderId } from './image-types.js';

export type ImageOrchestratorResult = Awaited<ReturnType<OpenAIImageService['saveResponsesImageToolResult']>>;

const formatProviderError = (providerId: ImageProviderId, error: unknown) => {
  const label = getImageProviderLabel(providerId);
  const message = error instanceof Error ? error.message : String(error);
  return `[${label}] ${message}`;
};

export class ImageGenerationOrchestrator {
  constructor(
    private readonly config: HarnessConfig,
    private readonly prefsStore: ProviderPrefsStore,
    private readonly imageService: OpenAIImageService,
  ) {}

  async generate(args: {
    userId: string;
    sessionId: string;
    request: ImageGenerationRequest;
  }): Promise<ImageOrchestratorResult> {
    const preferredId = await this.prefsStore.getPreferredImageProvider();
    const chain = buildImageProviderChain(this.config, preferredId);

    if (chain.length === 0) {
      throw new Error('当前未配置任何可用的生图 provider');
    }

    const errors: string[] = [];

    for (const providerId of chain) {
      try {
        const provider = createConfiguredImageProvider(providerId, this.config);
        const raw = await provider.generate(args.request);
        const base64Image = await resolveImageBytes(raw);

        const saved = await this.imageService.saveResponsesImageToolResult({
          userId: args.userId,
          sessionId: args.sessionId,
          prompt: args.request.prompt,
          base64Image,
          revisedPrompt: raw.revisedPrompt,
          source: 'images_generate_api',
          model: raw.model,
        });

        await this.prefsStore.setPreferredImageProvider(providerId);
        return saved;
      } catch (error) {
        errors.push(formatProviderError(providerId, error));
      }
    }

    throw new Error([
      '所有生图服务均失败：',
      ...errors.map((error, index) => `${index + 1}. ${error}`),
    ].join('\n'));
  }
}

export const buildImageGenerationFailureResult = (args: {
  prompt: string;
  chain: ImageProviderId[];
  errors: string[];
}) => ({
  summary: '生图失败：所有已配置的生图服务均不可用',
  content: [
    `原始提示词：${args.prompt}`,
    `已尝试：${args.chain.map((id) => getImageProviderLabel(id)).join(' → ')}`,
    `失败详情：\n${args.errors.map((error, index) => `${index + 1}. ${error}`).join('\n')}`,
    '请向用户说明图片暂时无法生成，并建议稍后重试或调整描述。',
  ].join('\n\n'),
});
