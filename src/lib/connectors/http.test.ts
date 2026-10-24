import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidResponseError, fetchJson } from './http';

beforeEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('returns schema-parsed JSON for a 2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ count: 3 }), { status: 200 })));

    await expect(
      fetchJson('https://example.invalid/api', { schema: z.object({ count: z.number() }) })
    ).resolves.toEqual({ count: 3 });
  });

  it('throws FetchError for non-2xx responses with status and headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('bad token', { status: 401, headers: { 'Retry-After': '30' } }))
    );

    await expect(fetchJson('https://example.invalid/api')).rejects.toMatchObject({ status: 401, message: 'bad token' });
  });

  it('throws InvalidResponseError naming the redirect target for a non-JSON body', async () => {
    const response = new Response('<html>', { status: 200 });
    Object.defineProperty(response, 'redirected', { value: true });
    Object.defineProperty(response, 'url', { value: 'https://store.example/?key=secret' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const error = await fetchJson('https://example.invalid/api').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(InvalidResponseError);
    expect(error).toMatchObject({
      status: 200,
      message: 'invalid JSON response after redirect to https://store.example/'
    });
  });
});
