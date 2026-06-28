import type { NativeToolsPolicy } from './provider-types.js';

export const supportsOpenAINativeEndpoint = (baseUrl: string) => {
  const normalized = baseUrl.replace(/\/+$/, '');
  return /^https:\/\/api\.openai\.com(?:\/|$)/i.test(normalized);
};

export const parseNativeToolsPolicy = (value: string | undefined): NativeToolsPolicy | undefined => {
  if (value === 'auto' || value === 'on' || value === 'off') {
    return value;
  }
  return undefined;
};

export const resolveNativeToolsPolicy = (
  policy: NativeToolsPolicy,
  baseUrl: string,
) => {
  if (policy === 'on') {
    return true;
  }
  if (policy === 'off') {
    return false;
  }
  return supportsOpenAINativeEndpoint(baseUrl);
};

export const parseProviderListFromEnv = (value: string | undefined): string[] | undefined => {
  if (!value?.trim()) {
    return undefined;
  }
  const items = value.split(',').map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
};
