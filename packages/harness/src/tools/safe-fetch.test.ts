import { lookup as dnsLookup } from 'node:dns/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertPublicHttpUrl, safeFetch } from './safe-fetch.js';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

const mockedLookup = vi.mocked(dnsLookup);

describe('safe-fetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects localhost hostnames', async () => {
    await expect(assertPublicHttpUrl('http://localhost/admin')).rejects.toThrow('不允许访问本地或内网地址');
  });

  it('rejects private resolved addresses', async () => {
    mockedLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);

    await expect(assertPublicHttpUrl('http://example.com/admin')).rejects.toThrow('不允许访问本地或内网地址');
  });

  it('allows public resolved addresses', async () => {
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);

    const url = await assertPublicHttpUrl('https://example.com/path');
    expect(url.hostname).toBe('example.com');
  });

  it('rejects redirect hops to private addresses', async () => {
    mockedLookup.mockImplementation(async (hostname) => {
      if (hostname === 'public.example') {
        return [{ address: '93.184.216.34', family: 4 }] as never;
      }
      return [{ address: '127.0.0.1', family: 4 }] as never;
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://private.example/internal' },
      }),
    ));

    await expect(safeFetch('https://public.example/start')).rejects.toThrow('不允许访问本地或内网地址');
  });
});
