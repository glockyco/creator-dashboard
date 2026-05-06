import type { Identity } from '$lib/identities';

export type IndexedPost = {
  slug: string;
  posted_at: number;
  author: Identity;
  platform: string;
  url: string;
  title: string;
  tags: string[];
  body_excerpt: string | null;
  body_hash: string;
  related_sources: string[];
};

export type PostsFilters = {
  author?: string;
  tag?: string;
  related_source?: string;
};

export type PostPerformance = {
  source_id: string;
  metric: string;
  before_value: number | null;
  after_value: number | null;
  delta: number | null;
};

type PostRow = Omit<IndexedPost, 'tags' | 'related_sources'> & { tags: string; related_sources: string | null };

export async function listPosts(db: D1Database, filters: PostsFilters = {}): Promise<IndexedPost[]> {
  const { where, params } = filterClause(filters);
  const result = await db
    .prepare(
      `SELECT p.slug, p.posted_at, p.author, p.platform, p.url, p.title, p.tags, p.body_excerpt, p.body_hash,
              GROUP_CONCAT(ps.source_id) AS related_sources
       FROM posts_index p
       LEFT JOIN posts_sources ps ON ps.slug = p.slug
       ${filters.related_source ? 'JOIN posts_sources filter_ps ON filter_ps.slug = p.slug' : ''}
       ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
       GROUP BY p.slug
       ORDER BY p.posted_at DESC`
    )
    .bind(...params)
    .all<PostRow>();
  return (result.results ?? []).map(parsePostRow);
}

export async function getPost(db: D1Database, slug: string): Promise<IndexedPost | null> {
  const result = await db
    .prepare(
      `SELECT p.slug, p.posted_at, p.author, p.platform, p.url, p.title, p.tags, p.body_excerpt, p.body_hash,
              GROUP_CONCAT(ps.source_id) AS related_sources
       FROM posts_index p
       LEFT JOIN posts_sources ps ON ps.slug = p.slug
       WHERE p.slug = ?
       GROUP BY p.slug`
    )
    .bind(slug)
    .first<PostRow>();
  return result ? parsePostRow(result) : null;
}

export async function getPostPerformance(db: D1Database, slug: string): Promise<PostPerformance[]> {
  const result = await db
    .prepare(
      `WITH post AS (
         SELECT slug, posted_at FROM posts_index WHERE slug = ?
       ), related AS (
         SELECT source_id FROM posts_sources WHERE slug = (SELECT slug FROM post)
       ), metrics AS (
         SELECT DISTINCT source_id, metric FROM metric_points WHERE source_id IN (SELECT source_id FROM related)
       )
       SELECT m.source_id, m.metric,
              (SELECT value FROM metric_points mp, post WHERE mp.source_id = m.source_id AND mp.metric = m.metric AND mp.ts < post.posted_at ORDER BY mp.ts DESC LIMIT 1) AS before_value,
              (SELECT value FROM metric_points mp, post WHERE mp.source_id = m.source_id AND mp.metric = m.metric AND mp.ts >= post.posted_at ORDER BY mp.ts ASC LIMIT 1) AS after_value,
              ((SELECT value FROM metric_points mp, post WHERE mp.source_id = m.source_id AND mp.metric = m.metric AND mp.ts >= post.posted_at ORDER BY mp.ts ASC LIMIT 1) -
               (SELECT value FROM metric_points mp, post WHERE mp.source_id = m.source_id AND mp.metric = m.metric AND mp.ts < post.posted_at ORDER BY mp.ts DESC LIMIT 1)) AS delta
       FROM metrics m
       ORDER BY m.source_id, m.metric`
    )
    .bind(slug)
    .all<PostPerformance>();
  return result.results ?? [];
}

function filterClause(filters: PostsFilters): { where: string[]; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.author) {
    where.push('p.author = ?');
    params.push(filters.author);
  }
  if (filters.tag) {
    where.push('p.tags LIKE ?');
    params.push(`%"${filters.tag}"%`);
  }
  if (filters.related_source) {
    where.push('filter_ps.source_id = ?');
    params.push(filters.related_source);
  }
  return { where, params };
}

function parsePostRow(row: PostRow): IndexedPost {
  return {
    ...row,
    tags: parseStringArray(row.tags),
    related_sources: row.related_sources ? row.related_sources.split(',').filter(Boolean) : []
  };
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}
