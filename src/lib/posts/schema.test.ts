import { describe, expect, it } from 'vitest';
import { PostFrontmatter } from './schema';

describe('PostFrontmatter', () => {
  it('accepts valid frontmatter and defaults optional arrays', () => {
    expect(
      PostFrontmatter.parse({
        posted_at: '2026-04-12T00:00:00.000Z',
        author: 'WoW_Much',
        platform: 'Steam',
        url: 'https://example.invalid/post',
        title: 'WoW_Much 0.4.0 release'
      })
    ).toEqual({
      posted_at: '2026-04-12T00:00:00.000Z',
      author: 'WoW_Much',
      platform: 'Steam',
      url: 'https://example.invalid/post',
      title: 'WoW_Much 0.4.0 release',
      tags: [],
      related_sources: []
    });
  });

  it('rejects malformed identity, date, and URL fields', () => {
    expect(() =>
      PostFrontmatter.parse({
        posted_at: '2026-04-12',
        author: 'unknown',
        platform: 'Steam',
        url: 'not-a-url',
        title: 'Bad post'
      })
    ).toThrow();
  });
});
