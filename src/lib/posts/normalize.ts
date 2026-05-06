import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { PostFrontmatter } from './schema';

export type NormalizedPost = {
  slug: string;
  posted_at_ms: number;
  author: 'glockyco' | 'WoW_Much';
  platform: string;
  url: string;
  title: string;
  tags: string[];
  related_sources: string[];
  body: string;
  body_excerpt: string;
  body_hash: string;
};

export type NormalizePostInput = {
  path: string;
  markdown: string;
  knownSourceIds: ReadonlySet<string>;
};

export function normalizePost(input: NormalizePostInput): NormalizedPost {
  const parsed = matter(input.markdown);
  const frontmatter = PostFrontmatter.parse(parsed.data);
  for (const sourceId of frontmatter.related_sources) {
    if (!input.knownSourceIds.has(sourceId)) throw new Error(`unknown related source: ${sourceId}`);
  }

  const body = parsed.content.trim();
  return {
    slug: slugFromPath(input.path),
    posted_at_ms: Date.parse(frontmatter.posted_at),
    author: frontmatter.author,
    platform: frontmatter.platform,
    url: frontmatter.url,
    title: frontmatter.title,
    tags: frontmatter.tags,
    related_sources: frontmatter.related_sources,
    body,
    body_excerpt: excerpt(body),
    body_hash: createHash('sha256').update(body).digest('hex')
  };
}

function slugFromPath(path: string): string {
  return path.split('/').at(-1)?.replace(/\.md$/, '') ?? path;
}

function excerpt(body: string): string {
  const firstParagraph = body.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  return firstParagraph.length > 240 ? `${firstParagraph.slice(0, 237)}...` : firstParagraph;
}
