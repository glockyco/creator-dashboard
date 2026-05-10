import { describe, expect, it } from 'vitest';
import { formatDigest } from './format';
import type { DigestData } from './query';

const digest: DigestData = {
  window: { start: Date.parse('2026-05-09T06:00:00.000Z'), end: Date.parse('2026-05-10T06:00:00.000Z') },
  metrics: [
    { source_id: 'github-glockyco', metric: 'followers', ts: 1, value: 12 },
    { source_id: 'github-glockyco', metric: 'followers', ts: 2, value: 13 },
    { source_id: 'github-glockyco', metric: 'total_stars', ts: 2, value: 2 },
    { source_id: 'github-glockyco', metric: 'public_repos', ts: 2, value: 32 },
    { source_id: 'gsc-glockyco-com', metric: 'clicks', ts: 2, value: 3 },
    { source_id: 'gsc-glockyco-com', metric: 'impressions', ts: 2, value: 30 },
    { source_id: 'bing-glockyco-com', metric: 'clicks', ts: 2, value: 1 },
    { source_id: 'bing-glockyco-com', metric: 'impressions', ts: 2, value: 10 },
    { source_id: 'cf-analytics-glockyco-com', metric: 'visits', ts: 2, value: 6 },
    { source_id: 'cf-analytics-glockyco-com', metric: 'pageviews', ts: 2, value: 9 },
    { source_id: 'steam-guide-erenshor', metric: 'views', ts: 1, value: 100 },
    { source_id: 'steam-guide-erenshor', metric: 'views', ts: 2, value: 105 },
    { source_id: 'steam-guide-ak', metric: 'views', ts: 1, value: 50 },
    { source_id: 'steam-guide-ak', metric: 'views', ts: 2, value: 61 },
    { source_id: 'thunderstore-wowmuch', metric: 'total_downloads', ts: 1, value: 1000 },
    { source_id: 'thunderstore-wowmuch', metric: 'total_downloads', ts: 2, value: 1015 },
    { source_id: 'cf-analytics-ak-compendium', metric: 'visits', ts: 2, value: 588 },
    { source_id: 'cf-analytics-erenshor-maps', metric: 'visits', ts: 2, value: 274 },
    { source_id: 'gsc-ak-compendium-org', metric: 'clicks', ts: 2, value: 0 },
    { source_id: 'bing-ak-compendium-org', metric: 'clicks', ts: 2, value: 0 }
  ],
  events: [
    { source_id: 'steam-reviews-ak', external_id: 'review-1', ts: 2, kind: 'review', author: null, title: 'Good review', url: 'https://example.test/review' },
    { source_id: 'erenshor-wiki-recent', external_id: 'wiki-1', ts: 2, kind: 'wiki_edit', author: 'Editor', title: 'Map page', url: 'https://example.test/wiki' }
  ],
  posts: [{ slug: 'post-1', posted_at: 2, author: 'glockyco', platform: 'site', url: 'https://example.test/post', title: 'Post title', tags: ['dev'], body_excerpt: null }],
  runs: [
    { source_id: 'github-glockyco', last_run_at: 2, last_success_at: 2, last_status: 'success', last_error: null, consecutive_failures: 0 },
    { source_id: 'gsc-ak-compendium', last_run_at: 2, last_success_at: null, last_status: 'failed', last_error: 'forbidden', consecutive_failures: 2 }
  ],
  failures: [{ source_id: 'gsc-ak-compendium', ts: 2, tier: 'permanent', status_code: 403, error_message: 'forbidden' }]
};

describe('formatDigest', () => {
  it('builds four Discord embeds in dashboard order with useful first-draft metrics', () => {
    const message = formatDigest(digest, '2026-05-10');

    expect(message.content).toBe('Creator Dashboard daily digest — 2026-05-10 — last 24h');
    expect(message.embeds.map((embed) => embed.title)).toEqual(['glockyco', 'WoW_Much', 'Posts', 'Health']);
    expect(message.embeds[0]).toMatchObject({ color: 0x6366f1 });
    expect(message.embeds[1]).toMatchObject({ color: 0xf59e0b });
    expect(message.embeds[0].fields.map((field) => field.name)).toEqual(['GitHub', 'Search', 'Site']);
    expect(message.embeds[0].fields[0].value).toContain('Followers: 13 (+1)');
    expect(message.embeds[0].fields[1].value).toContain('glockyco.com: 4 clicks / 40 impressions');
    expect(message.embeds[1].fields[0].value).toContain('Steam guide views: +16');
    expect(message.embeds[1].fields[1].value).toContain('Steam review events: 1');
    expect(message.embeds[2].fields[0].value).toContain('[Post title](https://example.test/post)');
    expect(message.embeds[3].fields[0].value).toContain('failed: 1');
    expect(message.embeds[3].fields[1].value).toContain('permanent: 1');
  });
});
