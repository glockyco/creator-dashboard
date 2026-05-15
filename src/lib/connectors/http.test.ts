import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError, fetchJson } from './http';

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

  it('throws FetchError status 200 for invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));

    const error = await fetchJson('https://example.invalid/api').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(FetchError);
    expect(error).toMatchObject({ status: 200 });
  });
});
