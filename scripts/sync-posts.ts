import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sources } from '../src/lib/sources/registry';
import { normalizePost, type NormalizedPost } from '../src/lib/posts/normalize';

export type PostEntry = { path: string; markdown: string };

export function syncPostsFromEntries(entries: PostEntry[], knownSourceIds: ReadonlySet<string>): NormalizedPost[] {
  return entries.map((entry) => normalizePost({ path: entry.path, markdown: entry.markdown, knownSourceIds })).sort((a, b) => b.posted_at_ms - a.posted_at_ms);
}

export function buildSyncSql(posts: NormalizedPost[]): string {
  const lines = ['BEGIN;', 'DELETE FROM posts_sources;', 'DELETE FROM posts_index;'];
  for (const post of posts) {
    lines.push(
      `INSERT INTO posts_index (slug, posted_at, author, platform, url, title, tags, body_excerpt, body_hash)`,
      `VALUES (${sqlString(post.slug)}, ${post.posted_at_ms}, ${sqlString(post.author)}, ${sqlString(post.platform)}, ${sqlString(post.url)}, ${sqlString(post.title)}, ${sqlString(JSON.stringify(post.tags))}, ${sqlString(post.body_excerpt)}, ${sqlString(post.body_hash)});`
    );
    for (const sourceId of post.related_sources) {
      lines.push('INSERT INTO posts_sources (slug, source_id)', `VALUES (${sqlString(post.slug)}, ${sqlString(sourceId)});`);
    }
  }
  lines.push('COMMIT;');
  return `${lines.join('\n')}\n`;
}

async function readPostEntries(postsDir: string): Promise<PostEntry[]> {
  const names = await readdir(postsDir);
  const entries: PostEntry[] = [];
  for (const name of names.filter((entry) => entry.endsWith('.md')).sort()) {
    const path = join(postsDir, name);
    entries.push({ path, markdown: await readFile(path, 'utf8') });
  }
  return entries;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outPath = process.argv[2] ?? '.tmp/sync-posts.sql';
  const postsDir = 'posts';
  try {
    const posts = syncPostsFromEntries(await readPostEntries(postsDir), new Set(sources.map((source) => source.id)));
    await mkdir('.tmp', { recursive: true });
    await writeFile(outPath, buildSyncSql(posts));
    console.log(`wrote ${outPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
