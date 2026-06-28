export type NativeToolsPolicy = 'auto' | 'on' | 'off';

export type WebSearchProviderId = 'openai_native' | 'tavily' | 'serper' | 'brave';

export type ImageProviderId = 'openai_images' | 'zhipu' | 'bailian';

export const WEB_SEARCH_PROVIDER_IDS = [
  'openai_native',
  'tavily',
  'serper',
  'brave',
] as const satisfies readonly WebSearchProviderId[];

export const IMAGE_PROVIDER_IDS = [
  'openai_images',
  'zhipu',
  'bailian',
] as const satisfies readonly ImageProviderId[];

export type ProviderPrefsFile = {
  webSearch?: {
    preferredProviderId?: WebSearchProviderId;
    lastSuccessAt?: string;
  };
  imageGeneration?: {
    preferredProviderId?: ImageProviderId;
    lastSuccessAt?: string;
  };
};
