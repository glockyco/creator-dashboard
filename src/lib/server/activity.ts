import { sourceRecords } from '$lib/sources/registry-data';

export type ActivityKind = 'review' | 'wiki_edit';
export type ActivitySentiment = 'positive' | 'negative';

export type ActivityItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  kind: ActivityKind;
  ts: number;
  title: string;
  body: string | null;
  author: string | null;
  href: string | null;
  hrefLabel: string | null;
  sentiment: ActivitySentiment | null;
  playtimeHours: number | null;
  netSizeDelta: number | null;
};

export type ActivityOptions = {
  kind?: ActivityKind;
  sourceId?: string;
  sentiment?: ActivitySentiment;
  since?: number;
  cursor?: string;
  limit?: number;
};

export type ActivityPage = {
  items: ActivityItem[];
  nextCursor: string | null;
};

export const activitySubjects = sourceRecords
  .filter((source) => source.connector === 'steamReviews' || source.connector === 'mediaWikiRecentChanges')
  .map((source) => ({
    id: source.id,
    name: source.name.replace(/^Steam Reviews:\s*/, '').replace(/:\s*Recent Changes$/, '')
  }));

const sourceNames: Record<string, string> = Object.fromEntries(
  activitySubjects.map((subject) => [subject.id, subject.name])
);
const wikiHosts: Record<string, string> = Object.fromEntries(
  sourceRecords
    .filter((source) => source.connector === 'mediaWikiRecentChanges' && typeof source.config.wiki === 'string')
    .map((source) => [source.id, source.config.wiki as string])
);

type ActivityRow = {
  source_id: string;
  external_id: string;
  ts: number;
  kind: ActivityKind;
  author: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  metadata: string | null;
};

type Cursor = {
  ts: number;
  sourceId: string;
  externalId: string;
};

const defaultLimit = 20;
const maximumLimit = 100;

export async function getActivity(db: D1Database, options: ActivityOptions = {}): Promise<ActivityPage> {
  const where = ["kind IN ('review', 'wiki_edit')"];
  const bindings: unknown[] = [];

  if (options.kind) {
    where.push('kind = ?');
    bindings.push(options.kind);
  }
  if (options.sourceId) {
    where.push('source_id = ?');
    bindings.push(options.sourceId);
  }
  if (options.sentiment) {
    where.push("kind = 'review'");
    where.push("json_extract(metadata, '$.voted_up') = ?");
    bindings.push(options.sentiment === 'positive' ? 1 : 0);
  }
  if (options.since != null && Number.isFinite(options.since)) {
    where.push('ts >= ?');
    bindings.push(options.since);
  }

  if (options.cursor) {
    const cursor = decodeCursor(options.cursor);
    where.push('(ts < ? OR (ts = ? AND source_id < ?) OR (ts = ? AND source_id = ? AND external_id < ?))');
    bindings.push(cursor.ts, cursor.ts, cursor.sourceId, cursor.ts, cursor.sourceId, cursor.externalId);
  }

  const limit = normalizeLimit(options.limit);
  const result = await db
    .prepare(
      `SELECT source_id, external_id, ts, kind, author, title, body, url, metadata
       FROM events
       WHERE ${where.join(' AND ')}
       ORDER BY ts DESC, source_id DESC, external_id DESC
       LIMIT ?`
    )
    .bind(...bindings, limit + 1)
    .all<ActivityRow>();

  const rows = result.results ?? [];
  const hasNextPage = rows.length > limit;
  const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;
  const lastRow = visibleRows.at(-1);

  return {
    items: visibleRows.map(toActivityItem),
    nextCursor:
      hasNextPage && lastRow
        ? encodeCursor({ ts: lastRow.ts, sourceId: lastRow.source_id, externalId: lastRow.external_id })
        : null
  };
}

function toActivityItem(row: ActivityRow): ActivityItem {
  const metadata = parseMetadata(row.metadata);
  const sentiment = row.kind === 'review' ? reviewSentiment(metadata) : null;
  const nativeContext = toNativeContext(row, metadata);

  return {
    id: `${row.source_id}:${row.external_id}`,
    sourceId: row.source_id,
    sourceName: sourceNames[row.source_id] ?? row.source_id,
    kind: row.kind,
    ts: row.ts,
    title: row.title ?? (row.kind === 'review' ? 'Steam review' : 'Wiki edit'),
    body: row.body,
    author: row.author,
    href: nativeContext.href,
    hrefLabel: nativeContext.hrefLabel,
    sentiment,
    playtimeHours: row.kind === 'review' ? playtimeHours(metadata) : null,
    netSizeDelta: row.kind === 'wiki_edit' ? numberValue(metadata.size_delta) : null
  };
}

function reviewSentiment(metadata: Record<string, unknown>): ActivitySentiment | null {
  if (metadata.voted_up === true || metadata.voted_up === 1) return 'positive';
  if (metadata.voted_up === false || metadata.voted_up === 0) return 'negative';
  return null;
}

function playtimeHours(metadata: Record<string, unknown>): number | null {
  const minutes = numberValue(metadata.playtime_at_review) ?? numberValue(metadata.playtime_forever);
  return minutes == null ? null : minutes / 60;
}

function toNativeContext(
  row: ActivityRow,
  metadata: Record<string, unknown>
): Pick<ActivityItem, 'href' | 'hrefLabel'> {
  if (!row.url) return { href: null, hrefLabel: null };

  let storedUrl: URL;
  try {
    storedUrl = new URL(row.url);
  } catch {
    return { href: null, hrefLabel: null };
  }

  if (storedUrl.protocol !== 'https:') return { href: null, hrefLabel: null };
  if (row.kind === 'review') {
    if (storedUrl.hostname !== 'steamcommunity.com') return { href: null, hrefLabel: null };

    const precise = /\/profiles\/[^/]+\/recommended\/[^/]+\/?/.test(storedUrl.pathname);
    return {
      href: storedUrl.toString(),
      hrefLabel: precise ? 'View review on Steam' : 'View Steam review list'
    };
  }
  if (storedUrl.hostname !== wikiHosts[row.source_id]) return { href: null, hrefLabel: null };

  const oldRevision = integerValue(metadata.old_revid);
  const revision = integerValue(metadata.revid);
  if (oldRevision == null || revision == null) {
    return { href: storedUrl.toString(), hrefLabel: 'View page on the wiki' };
  }
  return {
    href: `${storedUrl.origin}/wiki/Special:Diff/${oldRevision}/${revision}`,
    hrefLabel: 'View difference on the wiki'
  };
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function integerValue(value: unknown): number | null {
  const number = numberValue(value);
  return number != null && Number.isInteger(number) ? number : null;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return defaultLimit;
  return Math.min(maximumLimit, Math.max(1, Math.trunc(limit)));
}

function encodeCursor(cursor: Cursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify([cursor.ts, cursor.sourceId, cursor.externalId]));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeCursor(value: string): Cursor {
  try {
    const base64 = value
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      typeof parsed[0] === 'number' &&
      Number.isFinite(parsed[0]) &&
      typeof parsed[1] === 'string' &&
      parsed[1].length > 0 &&
      typeof parsed[2] === 'string' &&
      parsed[2].length > 0
    ) {
      return { ts: parsed[0], sourceId: parsed[1], externalId: parsed[2] };
    }
  } catch {
    // The caller receives one consistent error for malformed and undecodable cursors.
  }
  throw new Error('Invalid activity cursor');
}
