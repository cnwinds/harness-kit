export type ImageProviderId = 'openai_images' | 'zhipu' | 'bailian';

export type ImageGenerationRequest = {
  prompt: string;
  size?: string;
};

export type ImageGenerationRawResult = {
  providerId: ImageProviderId;
  model: string;
  base64?: string;
  imageUrl?: string;
  revisedPrompt?: string;
};

export type ImageProvider = {
  id: ImageProviderId;
  displayName: string;
  model: string;
  generate: (request: ImageGenerationRequest) => Promise<ImageGenerationRawResult>;
};
