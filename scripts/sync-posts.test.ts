import { describe, expect, it } from 'vitest';
import validPost from '../src/lib/posts/__fixtures__/valid-post.md?raw';
import { buildSyncSql, syncPostsFromEntries } from './sync-posts';

const knownSourceIds = new Set(['thunderstore-wowmuch']);

describe('sync-posts', () => {
  it('builds deterministic D1 sync SQL for posts and source links', () => {
    const posts = syncPostsFromEntries([{ path: 'posts/2026-04-12-wow-much-040-release.md', markdown: validPost }], knownSourceIds);
    const sql = buildSyncSql(posts);

    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('DELETE FROM posts_sources;');
    expect(sql).toContain('DELETE FROM posts_index;');
    expect(sql).toContain("INSERT INTO posts_index (slug, posted_at, author, platform, url, title, tags, body_excerpt, body_hash)");
    expect(sql).toContain("'2026-04-12-wow-much-040-release', 1775952000000, 'WoW_Much', 'Steam'");
    expect(sql).toContain("INSERT INTO posts_sources (slug, source_id)");
    expect(sql).toContain("'2026-04-12-wow-much-040-release', 'thunderstore-wowmuch'");
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
  });

  it('escapes SQL strings without dropping content', () => {
    const posts = syncPostsFromEntries(
      [
        {
          path: 'posts/quote.md',
          markdown: validPost.replace('WoW_Much 0.4.0 release', "Johann's release").replace('Release notes excerpt.', "Johann's release notes.")
        }
      ],
      knownSourceIds
    );

    expect(buildSyncSql(posts)).toContain("Johann''s release");
  });
});
