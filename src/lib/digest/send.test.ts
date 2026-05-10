import { describe, expect, it, vi } from 'vitest';
import { maybeDailyDigest } from './send';

type DbCall = { sql: string; params: unknown[]; op: 'all' | 'first' | 'run' };

function digestEnv(options: { alreadySent?: boolean } = {}) {
  const calls: DbCall[] = [];
  const prepare = vi.fn((sql: string) => ({
    bind: (...params: unknown[]) => ({
      all: async () => {
        calls.push({ sql, params, op: 'all' });
        return { results: rowsFor(sql) };
      },
      first: async () => {
        calls.push({ sql, params, op: 'first' });
        return options.alreadySent ? { digest_date: params[0], sent_at: 1 } : null;
      },
      run: async () => {
        calls.push({ sql, params, op: 'run' });
        return { success: true };
      }
    }),
    all: async () => {
      calls.push({ sql, params: [], op: 'all' });
      return { results: rowsFor(sql) };
    }
  }));
  const env = { DB: { prepare } as unknown as D1Database, DISCORD_DIGEST_WEBHOOK: 'https://discord.test/webhook' } as Env;
  return { env, calls };
}

function rowsFor(sql: string) {
  if (sql.includes('FROM metric_points')) return [{ source_id: 'github-glockyco', metric: 'followers', ts: 1, value: 13, dimensions: null }];
  if (sql.includes('FROM events')) return [];
  if (sql.includes('FROM posts_index')) return [];
  if (sql.includes('FROM fetcher_runs')) return [{ source_id: 'github-glockyco', last_run_at: 1, last_success_at: 1, last_status: 'success', last_error: null, consecutive_failures: 0 }];
  if (sql.includes('FROM fetcher_failures')) return [];
  return [];
}

describe('maybeDailyDigest', () => {
  it('skips outside the Vienna digest hour before touching D1 or Discord', async () => {
    const { env, calls } = digestEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(maybeDailyDigest(env, new Date('2026-01-15T04:00:00.000Z'))).resolves.toEqual({ sent: false, reason: 'outside_digest_hour' });
    expect(calls).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the digest once per Vienna date and records it only after Discord succeeds', async () => {
    const { env, calls } = digestEnv();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(maybeDailyDigest(env, new Date('2026-01-15T05:00:00.000Z'))).resolves.toEqual({ sent: true, reason: 'sent' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ content: 'Creator Dashboard daily digest — 2026-01-15 — last 24h' });
    const digestQueries = calls.filter((call) => call.sql.includes('digest_sent'));
    expect(digestQueries.map((call) => call.op)).toEqual(['first', 'run']);
    expect(digestQueries.at(-1)?.params).toEqual(['2026-01-15', Date.parse('2026-01-15T05:00:00.000Z')]);
  });

  it('does not send again when the Vienna date was already recorded', async () => {
    const { env, calls } = digestEnv({ alreadySent: true });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(maybeDailyDigest(env, new Date('2026-01-15T05:00:00.000Z'))).resolves.toEqual({ sent: false, reason: 'already_sent' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.sql.includes('digest_sent')).map((call) => call.op)).toEqual(['first']);
  });
});
