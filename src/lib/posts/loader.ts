import { sources } from '$lib/sources/registry';
import { normalizePost, type NormalizedPost } from './normalize';

const raw = import.meta.glob('/posts/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<
  string,
  string
>;

export function loadPostsFromRaw(
  rawPosts: Record<string, string>,
  knownSourceIds: ReadonlySet<string>
): NormalizedPost[] {
  return Object.entries(rawPosts)
    .map(([path, markdown]) => normalizePost({ path, markdown, knownSourceIds }))
    .sort((a, b) => b.posted_at_ms - a.posted_at_ms);
}

export function loadPosts(): NormalizedPost[] {
  return loadPostsFromRaw(raw, new Set(sources.map((source) => source.id)));
}
