import { describe, expect, it, vi } from 'vitest';
import { getSourceDetail, getSourceEvents } from './source-detail';

const fetcher = vi.fn();

vi.mock('$lib/sources/registry', () => ({
  getSource: (sourceId: string) => {
    if (sourceId === 'github-glockyco')
      return {
        id: 'github-glockyco',
        identity: 'glockyco',
        name: 'GitHub @glockyco',
        category: 'platform',
        cadenceHours: 1,
        fetcher,
        config: {}
      };
    if (sourceId === 'steam-guide-erenshor')
      return {
        id: 'steam-guide-erenshor',
        identity: 'WoW_Much',
        name: 'Steam Guide: Erenshor Maps',
        category: 'platform',
        cadenceHours: 1,
        fetcher,
        config: { publishedfileid: '3500398991' }
      };
  }
}));

type Call = { sql: string; params: unknown[] };

function sourceDetailDb() {
  const calls: Call[] = [];
  const prepare = vi.fn((sql: string) => ({
    bind: (...params: unknown[]) => {
      calls.push({ sql, params });
      return {
        all: async () => ({ results: rowsFor(sql, params) })
      };
    }
  }));
  return { db: { prepare } as unknown as D1Database, calls };
}

function rowsFor(sql: string, params: unknown[]) {
  if (sql.includes('FROM metric_points')) {
    const metric = params[1];
    if (metric === 'followers')
      return [
        { ts: 86_400_000, value: 10 },
        { ts: 172_800_000, value: 12 }
      ];
    if (metric === 'contributions')
      return [
        { ts: 86_400_000, value: 3 },
        { ts: 172_800_000, value: 4 }
      ];
    return [];
  }
  if (sql.includes('FROM posts_sources')) {
    return [
      {
        slug: 'release-notes',
        posted_at: 1_500,
        author: 'glockyco',
        platform: 'site',
        url: 'https://example.test/post',
        title: 'Release notes',
        tags: '["release"]',
        body_excerpt: 'Shipped.'
      }
    ];
  }
  if (sql.includes('FROM events')) {
    return [
      {
        source_id: 'github-glockyco',
        external_id: 'evt-2',
        ts: 3_000,
        kind: 'release',
        author: 'glockyco',
        title: 'Second',
        body: 'Body 2',
        url: 'https://example.test/2',
        metadata: '{"tag":"v2"}'
      },
      {
        source_id: 'github-glockyco',
        external_id: 'evt-1',
        ts: 2_000,
        kind: 'release',
        author: 'glockyco',
        title: 'First',
        body: 'Body 1',
        url: 'https://example.test/1',
        metadata: null
      }
    ];
  }
  if (sql.includes('FROM steam_guide_awards')) {
    return [
      {
        source_id: 'steam-guide-erenshor',
        reaction_id: 27,
        count: 2,
        icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/27.png?v=5',
        captured_at: 1777852800000
      },
      {
        source_id: 'steam-guide-erenshor',
        reaction_id: 17,
        count: 5,
        icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/17.png?v=5',
        captured_at: 1777852800000
      }
    ];
  }
  return [];
}

describe('getSourceDetail', () => {
  it('returns null for unknown sources', async () => {
    const { db } = sourceDetailDb();
    await expect(getSourceDetail(db, 'missing', { since: 500 })).resolves.toBeNull();
  });

  it('returns source metadata, metric history, linked posts, and first events page', async () => {
    const { db, calls } = sourceDetailDb();

    const detail = await getSourceDetail(db, 'github-glockyco', { since: 500 });

    expect(detail).toEqual({
      source: {
        id: 'github-glockyco',
        identity: 'glockyco',
        name: 'GitHub @glockyco',
        category: 'platform',
        cadenceHours: 1,
        config: {}
      },
      metricHistory: {
        followers: [
          { ts: 86_400_000, value: 10 },
          { ts: 172_800_000, value: 12 }
        ],
        total_stars: [],
        public_repos: [],
        contributions: [
          { ts: 86_400_000, value: 3 },
          { ts: 172_800_000, value: 4 }
        ]
      },
      secondaryMetrics: [
        { metric: 'followers', value: 12, previousValue: 10, delta: 2 },
        { metric: 'total_stars', value: null, previousValue: null, delta: null },
        { metric: 'public_repos', value: null, previousValue: null, delta: null }
      ],
      linkedPosts: [
        {
          slug: 'release-notes',
          posted_at: 1_500,
          author: 'glockyco',
          platform: 'site',
          url: 'https://example.test/post',
          title: 'Release notes',
          tags: ['release'],
          body_excerpt: 'Shipped.'
        }
      ],
      events: {
        items: [
          {
            source_id: 'github-glockyco',
            external_id: 'evt-2',
            ts: 3_000,
            kind: 'release',
            author: 'glockyco',
            title: 'Second',
            body: 'Body 2',
            url: 'https://example.test/2',
            metadata: { tag: 'v2' }
          },
          {
            source_id: 'github-glockyco',
            external_id: 'evt-1',
            ts: 2_000,
            kind: 'release',
            author: 'glockyco',
            title: 'First',
            body: 'Body 1',
            url: 'https://example.test/1',
            metadata: null
          }
        ],
        nextCursor: null
      },
      steamGuideAwards: []
    });
    expect(calls.find((call) => call.sql.includes('FROM posts_sources'))?.params).toEqual(['github-glockyco']);
  });

  it('returns Steam guide awards sorted by count', async () => {
    const { db } = sourceDetailDb();

    const detail = await getSourceDetail(db, 'steam-guide-erenshor', { since: 500 });

    expect(detail?.steamGuideAwards).toEqual([
      {
        source_id: 'steam-guide-erenshor',
        reaction_id: 17,
        count: 5,
        icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/17.png?v=5',
        captured_at: 1777852800000
      },
      {
        source_id: 'steam-guide-erenshor',
        reaction_id: 27,
        count: 2,
        icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/27.png?v=5',
        captured_at: 1777852800000
      }
    ]);
  });
});

describe('getSourceEvents', () => {
  it('applies cursor and kind filters and returns a next cursor when another page exists', async () => {
    const prepare = vi.fn((_sql: string) => ({
      bind: (..._params: unknown[]) => ({
        all: async () => ({
          results: [
            {
              source_id: 'github-glockyco',
              external_id: 'evt-3',
              ts: 3_000,
              kind: 'release',
              author: null,
              title: 'Third',
              body: null,
              url: null,
              metadata: null
            },
            {
              source_id: 'github-glockyco',
              external_id: 'evt-2',
              ts: 2_000,
              kind: 'release',
              author: null,
              title: 'Second',
              body: null,
              url: null,
              metadata: null
            },
            {
              source_id: 'github-glockyco',
              external_id: 'evt-1',
              ts: 1_000,
              kind: 'release',
              author: null,
              title: 'First',
              body: null,
              url: null,
              metadata: null
            }
          ]
        })
      })
    }));
    const db = { prepare } as unknown as D1Database;

    const page = await getSourceEvents(db, 'github-glockyco', { cursor: 4_000, kind: 'release', pageSize: 2 });

    expect(page.items.map((event) => event.external_id)).toEqual(['evt-3', 'evt-2']);
    expect(page.nextCursor).toBe(2_000);
    expect(prepare.mock.calls[0][0]).toContain('ts < ?');
    expect(prepare.mock.results[0]).toBeDefined();
  });
});
