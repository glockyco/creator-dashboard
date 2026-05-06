import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './steam-guide.fixture.json';
import { fetchSteamGuide } from './steam-guide';

const source = { id: 'steam-guide-erenshor', name: 'Steam Guide: Erenshor Maps', identity: 'WoW_Much', category: 'platform', cadenceHours: 1, fetcher: fetchSteamGuide, config: { publishedfileid: '3500398991' } } as const;
const env = { STEAM_WEB_API_KEY: 'steam-test' } as Env;
const now = 1777852800000;

beforeEach(() => vi.unstubAllGlobals());

describe('fetchSteamGuide', () => {
  it('emits views, rating, and ratings metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchSteamGuide({ source, env, now });

    expect(out.metric_points.map((point) => point.metric)).toEqual(['views', 'rating', 'ratings']);
    expect(out.metric_points.find((point) => point.metric === 'views')?.value).toBe(2087);
    expect(out.metric_points.find((point) => point.metric === 'rating')?.value).toBe(0.82);
    expect(out.metric_points.find((point) => point.metric === 'ratings')?.value).toBe(50);
    expect(out.events).toEqual([]);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: {} }), { status: 200 })));
    await expect(fetchSteamGuide({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchSteamGuide({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
