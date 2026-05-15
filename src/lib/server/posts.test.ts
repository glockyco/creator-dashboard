import { describe, expect, it, vi } from 'vitest';
import { getPost, getPostPerformance, listPosts } from './posts';

type Call = { sql: string; params: unknown[] };

function postsDb() {
  const calls: Call[] = [];
  const prepare = vi.fn((sql: string) => ({
    bind: (...params: unknown[]) => {
      calls.push({ sql, params });
      return {
        all: async () => ({ results: rowsFor(sql) }),
        first: async () => rowsFor(sql)[0] ?? null
      };
    }
  }));
  return { db: { prepare } as unknown as D1Database, calls };
}

function rowsFor(sql: string) {
  if (sql.includes('metric_points')) {
    return [
      { source_id: 'thunderstore-wowmuch', metric: 'total_downloads', before_value: 100, after_value: 140, delta: 40 }
    ];
  }
  return [
    {
      slug: '2026-04-12-wow-much-040-release',
      posted_at: 1775952000000,
      author: 'WoW_Much',
      platform: 'Steam',
      url: 'https://example.invalid/post',
      title: 'WoW_Much 0.4.0 release',
      tags: '["release"]',
      body_excerpt: 'Release notes excerpt.',
      body_hash: 'abc123',
      related_sources: 'thunderstore-wowmuch,steam-reviews-ak'
    }
  ];
}

describe('listPosts', () => {
  it('applies author, tag, and related source filters and parses JSON fields', async () => {
    const { db, calls } = postsDb();

    const posts = await listPosts(db, { author: 'WoW_Much', tag: 'release', related_source: 'thunderstore-wowmuch' });

    expect(posts).toEqual([
      {
        slug: '2026-04-12-wow-much-040-release',
        posted_at: 1775952000000,
        author: 'WoW_Much',
        platform: 'Steam',
        url: 'https://example.invalid/post',
        title: 'WoW_Much 0.4.0 release',
        tags: ['release'],
        body_excerpt: 'Release notes excerpt.',
        body_hash: 'abc123',
        related_sources: ['thunderstore-wowmuch', 'steam-reviews-ak']
      }
    ]);
    expect(calls[0].sql).toContain('JOIN posts_sources');
    expect(calls[0].sql).toContain('p.author = ?');
    expect(calls[0].sql).toContain('p.tags LIKE ?');
    expect(calls[0].sql).toContain('filter_ps.source_id = ?');
    expect(calls[0].params).toEqual(['WoW_Much', '%"release"%', 'thunderstore-wowmuch']);
  });
});

describe('getPost', () => {
  it('loads one indexed post by slug', async () => {
    const { db, calls } = postsDb();

    await expect(getPost(db, '2026-04-12-wow-much-040-release')).resolves.toMatchObject({
      slug: '2026-04-12-wow-much-040-release'
    });
    expect(calls[0].params).toEqual(['2026-04-12-wow-much-040-release']);
  });
});

describe('getPostPerformance', () => {
  it('returns before and after metric deltas for related sources', async () => {
    const { db, calls } = postsDb();

    await expect(getPostPerformance(db, '2026-04-12-wow-much-040-release')).resolves.toEqual([
      { source_id: 'thunderstore-wowmuch', metric: 'total_downloads', before_value: 100, after_value: 140, delta: 40 }
    ]);
    expect(calls[0].sql).toContain('metric_points');
    expect(calls[0].params).toEqual(['2026-04-12-wow-much-040-release']);
  });
});
