import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './bing-webmaster.fixture.json';
import { fetchBingWebmaster } from './bing-webmaster';

const source = { id: 'bing-erenshor-maps', name: 'Bing: Erenshor Maps', identity: 'WoW_Much', category: 'analytics', cadenceHours: 24, fetcher: fetchBingWebmaster, config: { siteUrl: 'https://erenshor-maps.wowmuch1.workers.dev/' } } as const;
const env = { BING_WEBMASTER_API_KEY: 'bing-test' } as Env;
const now = Date.UTC(2026, 4, 2);

beforeEach(() => vi.unstubAllGlobals());

describe('fetchBingWebmaster', () => {
  it('emits aggregate and query/page breakdown metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchBingWebmaster({ source, env, now });

    expect(out.events).toEqual([]);
    expect(out.metric_points.filter((point) => point.dimensions === null).map((point) => [point.metric, point.value])).toEqual([
      ['clicks', 12],
      ['impressions', 120],
      ['ctr', 0.1],
      ['position', 4.666666666666667]
    ]);
    expect(out.metric_points.find((point) => point.dimensions?.query === 'ancient kingdoms' && point.metric === 'impressions')?.value).toBe(70);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ QueryStats: [{ Query: 'x' }] }), { status: 200 })));
    await expect(fetchBingWebmaster({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchBingWebmaster({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
