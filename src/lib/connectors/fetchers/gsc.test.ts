import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './gsc.fixture.json';
import { fetchGsc } from './gsc';

vi.mock('../auth/google', () => ({ getGoogleAccessToken: vi.fn(async () => 'google-token') }));

const source = { id: 'gsc-erenshor-maps', name: 'GSC: Erenshor Maps', identity: 'WoW_Much', category: 'analytics', cadenceHours: 24, fetcher: fetchGsc, config: { siteUrl: 'https://erenshor-maps.wowmuch1.workers.dev/' } } as const;
const env = { GOOGLE_SERVICE_ACCOUNT: '{}' } as Env;
const now = Date.UTC(2026, 4, 2);

beforeEach(() => vi.unstubAllGlobals());

describe('fetchGsc', () => {
  it('emits aggregate and query/page breakdown metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchGsc({ source, env, now });

    expect(out.events).toEqual([]);
    expect(out.metric_points.filter((point) => point.dimensions === null).map((point) => [point.metric, point.value])).toEqual([
      ['clicks', 20],
      ['impressions', 200],
      ['ctr', 0.1],
      ['position', 5.08]
    ]);
    expect(out.metric_points.find((point) => point.dimensions?.query === 'erenshor map' && point.metric === 'clicks')?.value).toBe(12);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ rows: [{ keys: [] }] }), { status: 200 })));
    await expect(fetchGsc({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchGsc({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
