import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './ga4.fixture.json';
import { fetchGa4 } from './ga4';

vi.mock('../auth/google', () => ({ getGoogleAccessToken: vi.fn(async () => 'google-token') }));

const source = { id: 'ga4', name: 'GA4', identity: 'glockyco', category: 'analytics', cadenceHours: 24, fetcher: fetchGa4, config: {} } as const;
const env = { GOOGLE_SERVICE_ACCOUNT: '{}', GA4_PROPERTY_ID: '123456' } as Env;
const now = Date.UTC(2026, 4, 2);

beforeEach(() => vi.unstubAllGlobals());

describe('fetchGa4', () => {
  it('emits active users, sessions, views, and event count metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchGa4({ source, env, now });

    expect(out.events).toEqual([]);
    expect(out.metric_points.map((point) => [point.metric, point.value])).toEqual([
      ['active_users', 10],
      ['sessions', 7],
      ['views', 25],
      ['event_count', 40]
    ]);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ rows: [{ metricValues: [] }] }), { status: 200 })));
    await expect(fetchGa4({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchGa4({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
