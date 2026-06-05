import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migrations = readdirSync('migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(`migrations/${file}`, 'utf8'));

function migratedDb() {
  const db = new DatabaseSync(':memory:');
  for (const sql of migrations) db.exec(sql);
  return db;
}

describe('initial D1 schema migration', () => {
  it('creates every required table', () => {
    const db = migratedDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);

    expect(tables).toEqual([
      'alerts_sent',
      'digest_sent',
      'events',
      'fetcher_failures',
      'fetcher_runs',
      'metric_points',
      'posts_index',
      'posts_sources',
      'steam_guide_awards'
    ]);
  });

  it('creates the query indexes used by dashboard and operations routes', () => {
    const db = migratedDb();
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);

    expect(indexes).toEqual([
      'idx_ev_kind_ts',
      'idx_ev_source_ts',
      'idx_ev_ts',
      'idx_ff_source_ts',
      'idx_ff_ts',
      'idx_mp_logical',
      'idx_mp_source_metric_ts',
      'idx_mp_ts',
      'idx_posts_author_ts',
      'idx_posts_posted_at',
      'idx_ps_source'
    ]);
  });

  it('keeps idempotency keys on metric points, events, alerts, digest, posts, and posts_sources', () => {
    const db = migratedDb();
    const metricPk = db
      .prepare('PRAGMA table_info(metric_points)')
      .all()
      .filter((row) => Number(row.pk) > 0)
      .map((row) => row.name);
    const eventPk = db
      .prepare('PRAGMA table_info(events)')
      .all()
      .filter((row) => Number(row.pk) > 0)
      .map((row) => row.name);
    const alertPk = db
      .prepare('PRAGMA table_info(alerts_sent)')
      .all()
      .filter((row) => Number(row.pk) > 0)
      .map((row) => row.name);
    const digestPk = db
      .prepare('PRAGMA table_info(digest_sent)')
      .all()
      .filter((row) => Number(row.pk) > 0)
      .map((row) => row.name);
    const postPk = db
      .prepare('PRAGMA table_info(posts_index)')
      .all()
      .filter((row) => Number(row.pk) > 0)
      .map((row) => row.name);
    const postSourcePk = db
      .prepare('PRAGMA table_info(posts_sources)')
      .all()
      .filter((row) => Number(row.pk) > 0)
      .map((row) => row.name);

    expect(metricPk).toEqual(['source_id', 'metric', 'ts', 'dimensions']);
    expect(eventPk).toEqual(['source_id', 'external_id']);
    expect(alertPk).toEqual(['alert_key']);
    expect(digestPk).toEqual(['digest_date']);
    expect(postPk).toEqual(['slug']);
    expect(postSourcePk).toEqual(['slug', 'source_id']);
  });

  it('dedupes NULL-dimension metric writes to the latest value via the logical unique index', () => {
    const db = migratedDb();
    const upsert = db.prepare(
      "INSERT INTO metric_points (source_id, metric, ts, value, dimensions) VALUES (?, ?, ?, ?, ?) ON CONFLICT(source_id, metric, ts, COALESCE(dimensions, '')) DO UPDATE SET value = excluded.value"
    );
    // Same NULL-dimension day written twice -> collapses to one row, latest value wins.
    upsert.run('github-glockyco', 'contributions', 1000, 3, null);
    upsert.run('github-glockyco', 'contributions', 1000, 6, null);
    // Distinct non-null dimensions on the same ts still coexist.
    upsert.run('github-glockyco', 'repo_stars', 1000, 10, '{"repo":"a"}');
    upsert.run('github-glockyco', 'repo_stars', 1000, 5, '{"repo":"b"}');

    const rows = db
      .prepare('SELECT metric, ts, value, dimensions FROM metric_points ORDER BY metric, dimensions')
      .all();
    expect(rows).toEqual([
      { metric: 'contributions', ts: 1000, value: 6, dimensions: null },
      { metric: 'repo_stars', ts: 1000, value: 10, dimensions: '{"repo":"a"}' },
      { metric: 'repo_stars', ts: 1000, value: 5, dimensions: '{"repo":"b"}' }
    ]);
  });
});
