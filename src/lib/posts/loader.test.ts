import { describe, expect, it } from 'vitest';
import validPost from './__fixtures__/valid-post.md?raw';
import unknownSource from './__fixtures__/unknown-source.md?raw';
import { loadPostsFromRaw } from './loader';
import { normalizePost } from './normalize';

const knownSourceIds = new Set(['thunderstore-wowmuch']);

describe('normalizePost', () => {
  it('normalizes markdown into Worker-safe runtime metadata', () => {
    const post = normalizePost({ path: '/posts/2026-04-12-wow-much-040-release.md', markdown: validPost, knownSourceIds });

    expect(post).toMatchObject({
      slug: '2026-04-12-wow-much-040-release',
      posted_at_ms: 1775952000000,
      author: 'WoW_Much',
      platform: 'Steam',
      url: 'https://example.invalid/post',
      title: 'WoW_Much 0.4.0 release',
      tags: ['release'],
      related_sources: ['thunderstore-wowmuch'],
      body_excerpt: 'Release notes excerpt.'
    });
    expect(post.body).toContain('More detail');
    expect(post).not.toHaveProperty('body_hash');
  });

  it('rejects related source IDs outside the registry', () => {
    expect(() => normalizePost({ path: '/posts/bad.md', markdown: unknownSource, knownSourceIds })).toThrow('unknown related source');
  });
});

describe('loadPostsFromRaw', () => {
  it('normalizes and sorts raw markdown modules newest first', () => {
    const posts = loadPostsFromRaw(
      {
        '/posts/old.md': validPost.replace('2026-04-12T00:00:00.000Z', '2026-04-01T00:00:00.000Z'),
        '/posts/new.md': validPost.replace('2026-04-12T00:00:00.000Z', '2026-04-14T00:00:00.000Z')
      },
      knownSourceIds
    );

    expect(posts.map((post) => post.slug)).toEqual(['new', 'old']);
  });
});
