import { lookup as dnsLookup } from 'node:dns/promises';

const privateIpv4Pattern = /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/;
const ipv4LiteralPattern = /^\d{1,3}(?:\.\d{1,3}){3}$/;

const isBlockedHostname = (hostname: string) => {
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost'
    || lower === '0.0.0.0'
    || lower === '::1'
    || lower.endsWith('.local')
    || lower.endsWith('.internal')
    || privateIpv4Pattern.test(lower)
  );
};

const isBlockedIpAddress = (address: string) => {
  const lower = address.toLowerCase();

  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') {
    return true;
  }

  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }

  if (ipv4LiteralPattern.test(lower) || lower.includes('.')) {
    return isBlockedHostname(lower) || privateIpv4Pattern.test(lower);
  }

  return false;
};

const assertAllowedResolvedAddresses = (addresses: string[]) => {
  if (addresses.length === 0) {
    throw new Error('不允许访问本地或内网地址');
  }

  for (const address of addresses) {
    if (isBlockedIpAddress(address)) {
      throw new Error('不允许访问本地或内网地址');
    }
  }
};

const resolveHostAddresses = async (hostname: string) => {
  if (ipv4LiteralPattern.test(hostname) || hostname.includes(':')) {
    return [hostname];
  }

  const records = await dnsLookup(hostname, { all: true });
  return records.map((record) => record.address);
};

export const assertPublicHttpUrl = async (input: string) => {
  const url = new URL(input);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('只支持 http/https 网页地址');
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error('不允许访问本地或内网地址');
  }

  if (url.username || url.password) {
    throw new Error('不允许在 URL 中携带凭据');
  }

  const addresses = await resolveHostAddresses(url.hostname);
  assertAllowedResolvedAddresses(addresses);
  return url;
};

export const safeFetch = async (
  input: string,
  init: RequestInit = {},
  options: { maxRedirects?: number } = {},
) => {
  const maxRedirects = options.maxRedirects ?? 5;
  let currentUrl = input;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicHttpUrl(currentUrl);

    const response = await fetch(currentUrl, {
      ...init,
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('重定向响应缺少 Location');
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new Error('重定向次数过多');
};
