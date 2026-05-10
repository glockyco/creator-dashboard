import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceRecords } from '../src/lib/sources/registry-data.ts';
import { normalizePost, type NormalizedPost } from '../src/lib/posts/normalize.ts';
import { executeRemote } from './backfill/lib/run.ts';

export type PostEntry = { path: string; markdown: string };
export type SyncPost = NormalizedPost & { body_hash: string };

export function syncPostsFromEntries(entries: PostEntry[], knownSourceIds: ReadonlySet<string>): SyncPost[] {
  return entries.map((entry) => withBodyHash(normalizePost({ path: entry.path, markdown: entry.markdown, knownSourceIds }))).sort((a, b) => b.posted_at_ms - a.posted_at_ms);
}

export type SyncPostsArgs = { out: string; executeRemote: boolean };

export function parseSyncPostsArgs(args: string[]): SyncPostsArgs {
  const parsed: SyncPostsArgs = { out: '.tmp/sync-posts.sql', executeRemote: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--execute-remote') parsed.executeRemote = true;
    else if (arg === '--out') {
      const value = args[index + 1];
      if (!value) throw new Error('--out requires a value');
      parsed.out = value;
      index += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}

export function buildSyncSql(posts: SyncPost[]): string {
  const lines: string[] = [];
  const sourceLinks: Array<{ slug: string; sourceId: string }> = [];
  for (const post of posts) {
    lines.push(
      `INSERT OR REPLACE INTO posts_index (slug, posted_at, author, platform, url, title, tags, body_excerpt, body_hash)`,
      `VALUES (${sqlString(post.slug)}, ${post.posted_at_ms}, ${sqlString(post.author)}, ${sqlString(post.platform)}, ${sqlString(post.url)}, ${sqlString(post.title)}, ${sqlString(JSON.stringify(post.tags))}, ${sqlString(post.body_excerpt)}, ${sqlString(post.body_hash)});`
    );
    for (const sourceId of post.related_sources) {
      sourceLinks.push({ slug: post.slug, sourceId });
      lines.push('INSERT OR IGNORE INTO posts_sources (slug, source_id)', `VALUES (${sqlString(post.slug)}, ${sqlString(sourceId)});`);
    }
  }
  if (sourceLinks.length > 0) {
    const keepLinks = sourceLinks.map((link) => `(slug = ${sqlString(link.slug)} AND source_id = ${sqlString(link.sourceId)})`).join(' OR ');
    lines.push(`DELETE FROM posts_sources WHERE NOT (${keepLinks});`);
  } else {
    lines.push('DELETE FROM posts_sources;');
  }
  if (posts.length > 0) {
    lines.push(`DELETE FROM posts_index WHERE slug NOT IN (${posts.map((post) => sqlString(post.slug)).join(', ')});`);
  } else {
    lines.push('DELETE FROM posts_index;');
  }
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

function withBodyHash(post: NormalizedPost): SyncPost {
  return { ...post, body_hash: createHash('sha256').update(post.body).digest('hex') };
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const parsed = parseSyncPostsArgs(process.argv.slice(2));
    const posts = syncPostsFromEntries(await readPostEntries('posts'), new Set(sourceRecords.map((source) => source.id)));
    await mkdir(dirname(parsed.out), { recursive: true });
    await writeFile(parsed.out, buildSyncSql(posts));
    console.log(`wrote ${parsed.out}`);
    if (parsed.executeRemote) executeRemote(parsed.out);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
