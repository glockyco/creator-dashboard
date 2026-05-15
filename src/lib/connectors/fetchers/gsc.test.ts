import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './gsc.fixture.json';
import { fetchGsc } from './gsc';

vi.mock('../auth/google', () => ({ getGoogleOAuthAccessToken: vi.fn(async () => 'google-token') }));

const source = {
  id: 'gsc-erenshor-maps',
  name: 'GSC: Erenshor Maps',
  identity: 'WoW_Much',
  category: 'analytics',
  cadenceHours: 24,
  fetcher: fetchGsc,
  config: { siteUrl: 'https://erenshor-maps.wowmuch1.workers.dev/' }
} as const;
const env = {
  GOOGLE_OAUTH_CLIENT_ID: 'cid',
  GOOGLE_OAUTH_CLIENT_SECRET: 'cs',
  GOOGLE_OAUTH_REFRESH_TOKEN: 'rt'
} as Env;
const now = Date.UTC(2026, 4, 2);

beforeEach(() => vi.unstubAllGlobals());

describe('fetchGsc', () => {
  it('emits aggregate and query/page breakdown metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchGsc({ source, env, now });

    expect(out.events).toEqual([]);
    expect(
      out.metric_points.filter((point) => point.dimensions === null).map((point) => [point.metric, point.value])
    ).toEqual([
      ['clicks', 20],
      ['impressions', 200],
      ['ctr', 0.1],
      ['position', 5.08]
    ]);
    expect(
      out.metric_points.find((point) => point.dimensions?.query === 'erenshor map' && point.metric === 'clicks')?.value
    ).toBe(12);
  });

  it('uses searchconsole.googleapis.com and requests dataState=all for fresh data', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await fetchGsc({ source, env, now });

    const [url, init] = fetch.mock.calls[0] as [string, { body: string }];
    expect(url.startsWith('https://searchconsole.googleapis.com/webmasters/v3/sites/')).toBe(true);
    expect(JSON.parse(init.body)).toMatchObject({ dataState: 'all' });
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ rows: [{ keys: [] }] }), { status: 200 }))
    );
    await expect(fetchGsc({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchGsc({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
