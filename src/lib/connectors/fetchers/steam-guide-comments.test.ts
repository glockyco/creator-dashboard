import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSteamGuideComments, parseSteamGuideComments } from './steam-guide-comments';

const firstCommentHtml = `
<div data-panel="{}" class="commentthread_comment responsive_body_text" id="comment_111">
  <div class="commentthread_comment_content">
    <div class="commentthread_comment_author">
      <a class="hoverunderline commentthread_author_link" href="https://steamcommunity.com/profiles/1"><bdi>Alice &amp; Bob</bdi></a>
      <span class="commentthread_comment_timestamp" title="1 January, 2026" data-timestamp="1770000001">1 Jan</span>
    </div>
    <div class="commentthread_comment_text" id="comment_content_111">
      Hello&nbsp;world<br>Second line
    </div>
  </div>
</div>`;

const secondCommentHtml = `
<div data-panel="{}" class="commentthread_comment responsive_body_text" id="comment_222">
  <div class="commentthread_comment_content">
    <div class="commentthread_comment_author">
      <a class="hoverunderline commentthread_author_link" href="https://steamcommunity.com/id/charlie"><bdi>Charlie</bdi></a>
      <span class="commentthread_comment_timestamp" title="2 January, 2026" data-timestamp="1770000002">2 Jan</span>
    </div>
    <div class="commentthread_comment_text" id="comment_content_222">Thanks &#x1F642;</div>
  </div>
</div>`;

beforeEach(() => vi.unstubAllGlobals());

describe('parseSteamGuideComments', () => {
  it('extracts ids, authors, timestamps, urls, and normalized plain text bodies', () => {
    expect(parseSteamGuideComments(`${firstCommentHtml}${secondCommentHtml}`, '3500398991')).toEqual([
      {
        source_id: '',
        external_id: '111',
        ts: 1770000001000,
        kind: 'steam_guide_comment',
        author: 'Alice & Bob',
        title: 'Steam guide comment',
        body: 'Hello world Second line',
        url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3500398991#comment_111',
        metadata: { author_url: 'https://steamcommunity.com/profiles/1', publishedfileid: '3500398991' }
      },
      {
        source_id: '',
        external_id: '222',
        ts: 1770000002000,
        kind: 'steam_guide_comment',
        author: 'Charlie',
        title: 'Steam guide comment',
        body: 'Thanks 🙂',
        url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3500398991#comment_222',
        metadata: { author_url: 'https://steamcommunity.com/id/charlie', publishedfileid: '3500398991' }
      }
    ]);
  });

  it('returns an empty list for empty comment html', () => {
    expect(parseSteamGuideComments('', '3500398991')).toEqual([]);
  });
});

describe('fetchSteamGuideComments', () => {
  it('pages until Steam reports all comments captured', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, start: 0, pagesize: '1', total_count: 2, comments_html: firstCommentHtml }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, start: 1, pagesize: '1', total_count: 2, comments_html: secondCommentHtml }),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetch);

    const result = await fetchSteamGuideComments({
      creator: '76561198107304856',
      publishedfileid: '3500398991',
      pageSize: 1
    });

    expect(result.totalCount).toBe(2);
    expect(result.comments.map((comment) => comment.external_id)).toEqual(['111', '222']);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1]?.[1]?.body)).toContain('start=1');
  });

  it('rejects a positive-count page with blank comment html', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, start: 0, pagesize: '50', total_count: 1, comments_html: '   ' }), {
        status: 200
      })
    );
    vi.stubGlobal('fetch', fetch);

    await expect(
      fetchSteamGuideComments({ creator: '76561198107304856', publishedfileid: '3500398991' })
    ).rejects.toBeInstanceOf(z.ZodError);
  });

  it('rejects partially malformed comment pages instead of dropping comments', async () => {
    const malformedCommentHtml = `
<div data-panel="{}" class="commentthread_comment responsive_body_text" id="comment_333">
  <div class="commentthread_comment_content">
    <div class="commentthread_comment_author">
      <a class="hoverunderline commentthread_author_link" href="https://steamcommunity.com/profiles/3"><bdi>Broken</bdi></a>
    </div>
  </div>
</div>`;
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          start: 0,
          pagesize: '50',
          total_count: 2,
          comments_html: `${firstCommentHtml}${malformedCommentHtml}`
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetch);

    await expect(
      fetchSteamGuideComments({ creator: '76561198107304856', publishedfileid: '3500398991' })
    ).rejects.toBeInstanceOf(z.ZodError);
  });

  it('rejects pages that parse fewer comments than Steam says the page contains', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          start: 0,
          pagesize: '50',
          total_count: 2,
          comments_html: firstCommentHtml
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetch);

    await expect(
      fetchSteamGuideComments({ creator: '76561198107304856', publishedfileid: '3500398991' })
    ).rejects.toBeInstanceOf(z.ZodError);
  });
});
