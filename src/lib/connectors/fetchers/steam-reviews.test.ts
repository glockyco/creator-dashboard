import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './steam-reviews.fixture.json';
import { fetchSteamReviews } from './steam-reviews';

const source = { id: 'steam-reviews-erenshor', name: 'Steam Reviews: Erenshor', identity: 'WoW_Much', category: 'event_feed', cadenceHours: 1, fetcher: fetchSteamReviews, config: { appid: '2382520' } } as const;
const env = {} as Env;
const now = 1777852800000;

beforeEach(() => vi.unstubAllGlobals());

describe('fetchSteamReviews', () => {
  it('emits summary metrics and review events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchSteamReviews({ source, env, now });

    expect(out.metric_points.map((point) => point.metric)).toEqual(['review_total', 'review_positive', 'review_negative', 'review_score']);
    expect(out.events).toHaveLength(2);
    expect(out.events[0]).toMatchObject({ source_id: 'steam-reviews-erenshor', external_id: '12345', kind: 'review', title: 'Positive review', body: 'Great map support.' });
    expect(out.events[0].metadata).toMatchObject({ voted_up: true, votes_up: 3, playtime_forever: 500 });
  });

  it('accepts live Steam weighted vote scores as either numbers or strings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: 1,
            query_summary: { num_reviews: 1, review_score: 8, total_positive: 1, total_negative: 0 },
            reviews: [{ recommendationid: 'live-1', author: {}, review: 'Mixed live shape.', timestamp_created: 1778002566, voted_up: true, weighted_vote_score: 0.5 }]
          }),
          { status: 200 }
        )
      )
    );

    const out = await fetchSteamReviews({ source, env, now });

    expect(out.events[0].metadata?.weighted_vote_score).toBe(0.5);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: 1, reviews: [null] }), { status: 200 })));
    await expect(fetchSteamReviews({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchSteamReviews({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
