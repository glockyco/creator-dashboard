import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchError } from '../http';
import fixture from './steam-guide.fixture.json';
import { fetchSteamGuide } from './steam-guide';

const source = {
  id: 'steam-guide-erenshor',
  name: 'Steam Guide: Erenshor Maps',
  identity: 'WoW_Much',
  category: 'platform',
  cadenceHours: 1,
  fetcher: fetchSteamGuide,
  config: { publishedfileid: '3500398991' }
} as const;
const env = { STEAM_WEB_API_KEY: 'steam-test' } as Env;
const now = 1777852800000;
const commentsResponse = {
  success: true,
  start: 0,
  pagesize: '50',
  total_count: 1,
  comments_html:
    '<div class="commentthread_comment responsive_body_text" id="comment_111"><a class="hoverunderline commentthread_author_link" href="https://steamcommunity.com/profiles/1"><bdi>Alice</bdi></a><span data-timestamp="1770000001"></span><div class="commentthread_comment_text" id="comment_content_111">Great guide</div></div>'
};

beforeEach(() => vi.unstubAllGlobals());

describe('fetchSteamGuide', () => {
  it('emits guide metrics, comments, and award snapshots', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(commentsResponse), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    const out = await fetchSteamGuide({ source, env, now });

    expect(out.metric_points.map((point) => point.metric)).toEqual([
      'views',
      'rating',
      'ratings',
      'comment_count',
      'award_count'
    ]);
    expect(out.metric_points.find((point) => point.metric === 'views')?.value).toBe(2087);
    expect(out.metric_points.find((point) => point.metric === 'rating')?.value).toBe(0.82);
    expect(out.metric_points.find((point) => point.metric === 'ratings')?.value).toBe(50);
    expect(out.metric_points.find((point) => point.metric === 'comment_count')?.value).toBe(1);
    expect(out.metric_points.find((point) => point.metric === 'award_count')?.value).toBe(7);
    expect(out.events).toHaveLength(1);
    expect(out.events[0]).toMatchObject({
      source_id: 'steam-guide-erenshor',
      external_id: '111',
      kind: 'steam_guide_comment',
      body: 'Great guide'
    });
    expect(out.steam_guide_awards).toEqual([
      {
        source_id: 'steam-guide-erenshor',
        reaction_id: 17,
        count: 5,
        icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/17.png?v=5',
        captured_at: now
      },
      {
        source_id: 'steam-guide-erenshor',
        reaction_id: 27,
        count: 2,
        icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/27.png?v=5',
        captured_at: now
      }
    ]);
  });

  it('calls IPublishedFileService.GetDetails with the key and includevotes', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(commentsResponse), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await fetchSteamGuide({ source, env, now });

    const calledUrl = fetch.mock.calls[0]?.[0] as URL;
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://api.steampowered.com/IPublishedFileService/GetDetails/v1/'
    );
    expect(calledUrl.searchParams.get('key')).toBe('steam-test');
    expect(calledUrl.searchParams.get('publishedfileids[0]')).toBe('3500398991');
    expect(calledUrl.searchParams.get('includevotes')).toBe('true');
    expect(calledUrl.searchParams.get('includereactions')).toBe('true');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws ZodError when detail and thread comment counts diverge', async () => {
    const mismatchedFixture = {
      response: {
        publishedfiledetails: [{ ...fixture.response.publishedfiledetails[0], num_comments_public: 2 }]
      }
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(mismatchedFixture), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(commentsResponse), { status: 200 }));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchSteamGuide({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
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
