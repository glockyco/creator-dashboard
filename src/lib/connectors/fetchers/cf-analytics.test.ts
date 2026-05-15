import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './cf-analytics.fixture.json';
import { fetchCfAnalytics } from './cf-analytics';

const source = {
  id: 'cf-analytics-erenshor-maps',
  name: 'Cloudflare Analytics: Erenshor Maps',
  identity: 'WoW_Much',
  category: 'analytics',
  cadenceHours: 24,
  fetcher: fetchCfAnalytics,
  config: {}
} as const;
const env = {
  CF_API_TOKEN: 'cf-test',
  CF_ACCOUNT_ID: 'acct-test',
  CF_ANALYTICS_SITE_TAGS: '{"cf-analytics-erenshor-maps":"site-tag-test"}'
} as Env;
const now = Date.UTC(2026, 4, 2);

beforeEach(() => vi.unstubAllGlobals());

describe('fetchCfAnalytics', () => {
  it('emits visits and pageviews metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchCfAnalytics({ source, env, now });

    expect(out.events).toEqual([]);
    expect(out.metric_points.map((point) => [point.metric, point.value])).toEqual([
      ['visits', 42],
      ['pageviews', 64]
    ]);
  });

  it('filters the GraphQL query by accountTag using CF_ACCOUNT_ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchCfAnalytics({ source, env, now });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const payload = JSON.parse(init.body) as { query: string; variables: Record<string, unknown> };
    expect(payload.query).toMatch(/accounts\(filter:\s*\{\s*accountTag:\s*\$accountTag\s*\}\)/);
    expect(payload.variables).toMatchObject({ accountTag: 'acct-test', siteTag: 'site-tag-test' });
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { viewer: {} } }), { status: 200 }))
    );
    await expect(fetchCfAnalytics({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchCfAnalytics({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
