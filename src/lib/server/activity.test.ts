import { describe, expect, it } from 'vitest';
import { getActivity } from './activity';

type Row = {
  source_id: string;
  external_id: string;
  ts: number;
  kind: 'review' | 'wiki_edit';
  author: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  metadata: string | null;
};

type QueryCall = { sql: string; bindings: unknown[] };

function activityDb(rows: Row[]) {
  const calls: QueryCall[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...bindings: unknown[]) {
          calls.push({ sql, bindings });
          return {
            async all() {
              return { results: rows };
            }
          };
        }
      };
    }
  };
  return { db: db as unknown as D1Database, calls };
}

const review = (externalId: string, sourceId = 'steam-reviews-erenshor'): Row => ({
  source_id: sourceId,
  external_id: externalId,
  ts: 1_000,
  kind: 'review',
  author: null,
  title: 'Negative review',
  body: 'The complete review text remains in the read model.',
  url: 'https://steamcommunity.com/profiles/76561190000000000/recommended/2382520/',
  metadata: JSON.stringify({ voted_up: false, playtime_at_review: 90, native_link_kind: 'review' })
});

const wikiEdit = (externalId: string): Row => ({
  source_id: 'erenshor-wiki-recent',
  external_id: externalId,
  ts: 1_000,
  kind: 'wiki_edit',
  author: 'Editor',
  title: 'Erenshor Maps',
  body: 'Updated route details',
  url: 'https://erenshor.wiki.gg/wiki/Erenshor_Maps',
  metadata: JSON.stringify({ old_revid: 1001, revid: 1002, size_delta: 125 })
});

describe('getActivity', () => {
  it('maps review and wiki fields while preserving full stored text and precise native context', async () => {
    const { db, calls } = activityDb([review('review-1'), wikiEdit('wiki-1')]);

    const page = await getActivity(db, { limit: 10 });

    expect(page.items[0]).toMatchObject({
      id: 'steam-reviews-erenshor:review-1',
      sourceName: 'Erenshor',
      sentiment: 'negative',
      playtimeHours: 1.5,
      body: 'The complete review text remains in the read model.',
      hrefLabel: 'View review on Steam'
    });
    expect(page.items[1]).toMatchObject({
      sourceName: 'Erenshor Wiki',
      author: 'Editor',
      netSizeDelta: 125,
      href: 'https://erenshor.wiki.gg/wiki/Special:Diff/1001/1002',
      hrefLabel: 'View difference on the wiki'
    });
    expect(calls[0].sql).toContain("kind IN ('review', 'wiki_edit')");
    expect(calls[0].sql).toContain('ORDER BY ts DESC, source_id DESC, external_id DESC');
  });

  it('labels a generic Steam destination as the review list', async () => {
    const genericReview = {
      ...review('review-list'),
      url: 'https://steamcommunity.com/app/2382520/reviews/?browsefilter=mostrecent',
      metadata: JSON.stringify({ voted_up: true, native_link_kind: 'review_list' })
    };
    const { db } = activityDb([genericReview]);

    const page = await getActivity(db);

    expect(page.items[0]).toMatchObject({
      sentiment: 'positive',
      hrefLabel: 'View Steam review list'
    });
  });

  it('applies type, subject, sentiment, and range filters before the page limit', async () => {
    const { db, calls } = activityDb([]);

    await getActivity(db, {
      kind: 'review',
      sourceId: 'steam-reviews-erenshor',
      sentiment: 'positive',
      since: 500,
      limit: 25
    });

    expect(calls[0].sql).toContain('kind = ?');
    expect(calls[0].sql).toContain('source_id = ?');
    expect(calls[0].sql).toContain("json_extract(metadata, '$.voted_up') = ?");
    expect(calls[0].sql).toContain('ts >= ?');
    expect(calls[0].bindings).toEqual(['review', 'steam-reviews-erenshor', 1, 500, 26]);
  });

  it('uses all three ordering keys when same-time events cross a page boundary', async () => {
    const firstDb = activityDb([
      review('review-3', 'steam-reviews-erenshor'),
      review('review-2', 'steam-reviews-erenshor'),
      review('review-1', 'steam-reviews-erenshor')
    ]);
    const firstPage = await getActivity(firstDb.db, { limit: 2 });
    expect(firstPage.nextCursor).not.toBeNull();

    const secondDb = activityDb([review('review-1', 'steam-reviews-erenshor'), wikiEdit('wiki-9')]);
    const secondPage = await getActivity(secondDb.db, { limit: 2, cursor: firstPage.nextCursor! });

    expect(secondDb.calls[0].sql).toContain(
      '(ts < ? OR (ts = ? AND source_id < ?) OR (ts = ? AND source_id = ? AND external_id < ?))'
    );
    expect(secondDb.calls[0].bindings).toEqual([
      1_000,
      1_000,
      'steam-reviews-erenshor',
      1_000,
      'steam-reviews-erenshor',
      'review-2',
      3
    ]);
    expect([...firstPage.items, ...secondPage.items].map((item) => item.id)).toEqual([
      'steam-reviews-erenshor:review-3',
      'steam-reviews-erenshor:review-2',
      'steam-reviews-erenshor:review-1',
      'erenshor-wiki-recent:wiki-9'
    ]);
  });

  it('rejects malformed cursors instead of restarting from the first page', async () => {
    const { db } = activityDb([]);
    await expect(getActivity(db, { cursor: 'not-a-cursor' })).rejects.toThrow('Invalid activity cursor');
  });
});
