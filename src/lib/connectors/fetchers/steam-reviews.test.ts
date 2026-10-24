import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError, InvalidResponseError } from '../http';
import fixture from './steam-reviews.fixture.json';
import { fetchSteamReviews } from './steam-reviews';

const source = {
  id: 'steam-reviews-erenshor',
  name: 'Steam Reviews: Erenshor',
  identity: 'WoW_Much',
  category: 'event_feed',
  cadenceHours: 1,
  fetcher: fetchSteamReviews,
  config: { appid: '2382520' }
} as const;
const env = {} as Env;
const now = 1777852800000;

beforeEach(() => vi.unstubAllGlobals());

describe('fetchSteamReviews', () => {
  it('emits summary metrics and review events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const out = await fetchSteamReviews({ source, env, now });

    expect(out.metric_points.map((point) => point.metric)).toEqual([
      'review_total',
      'review_positive',
      'review_negative',
      'review_score'
    ]);
    expect(out.events).toHaveLength(2);
    expect(out.events[0]).toMatchObject({
      source_id: 'steam-reviews-erenshor',
      external_id: '12345',
      kind: 'review',
      title: 'Positive review',
      body: 'Great map support.',
      url: 'https://steamcommunity.com/profiles/redacted-steam-id/recommended/2382520/'
    });
    expect(out.events[0].metadata).toMatchObject({
      native_link_kind: 'review',
      voted_up: true,
      votes_up: 3,
      playtime_forever: 500
    });
  });

  it('identifies itself with a contact-URL User-Agent so Akamai-fronted Steam endpoints do not 403', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await fetchSteamReviews({ source, env, now });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = new Headers(init?.headers ?? {});
    expect(headers.get('user-agent')).toMatch(/creator-dashboard\/[0-9]+\.[0-9]+ \(\+https?:\/\/[^)]+\)/);
  });

  it('pages back until reviews are older than the lookback window', async () => {
    const summary = { num_reviews: 100, review_score: 8, total_positive: 150, total_negative: 0, total_reviews: 150 };
    const reviewAt = (id: number, updatedSeconds: number) => ({
      recommendationid: String(id),
      author: {},
      review: 'Text',
      timestamp_created: updatedSeconds,
      timestamp_updated: updatedSeconds,
      voted_up: true
    });
    const recent = now / 1000 - 3_600;
    const stale = now / 1000 - 8 * 86_400;
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              query_summary: summary,
              reviews: Array.from({ length: 100 }, (_, index) => reviewAt(index, recent)),
              cursor: 'page-2'
            }
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: {
              query_summary: { num_reviews: 100 },
              reviews: Array.from({ length: 100 }, (_, index) => reviewAt(100 + index, stale)),
              cursor: 'page-3'
            }
          })
        )
      );
    vi.stubGlobal('fetch', fetchSpy);

    const out = await fetchSteamReviews({ source, env, now });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const secondInput = JSON.parse(new URL(fetchSpy.mock.calls[1]?.[0] as URL).searchParams.get('input_json')!);
    expect(secondInput).toMatchObject({ cursor: 'page-2', filter: 2 });
    expect(out.events).toHaveLength(200);
    expect(out.metric_points.find((point) => point.metric === 'review_total')?.value).toBe(150);
  });

  it('fails permanently when Steam returns no summary for the app', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: {} }))));
    await expect(fetchSteamReviews({ source, env, now })).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('records summary metrics when a page has no reviews', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            response: {
              query_summary: {
                num_reviews: 0,
                review_score: 0,
                review_score_desc: 'No user reviews',
                total_positive: 0,
                total_negative: 0,
                total_reviews: 0
              },
              cursor: '*',
              total_matching: 0
            }
          }),
          { status: 200 }
        )
      )
    );

    const out = await fetchSteamReviews({ source, env, now });

    expect(out.events).toEqual([]);
    expect(out.metric_points.find((point) => point.metric === 'review_total')?.value).toBe(0);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: { reviews: [null] } }), { status: 200 }))
    );
    await expect(fetchSteamReviews({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('throws FetchError on auth errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(fetchSteamReviews({ source, env, now })).rejects.toBeInstanceOf(FetchError);
  });
});
