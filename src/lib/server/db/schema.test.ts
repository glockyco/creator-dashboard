import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('migrations/0001_initial_schema.sql', 'utf8');

function migratedDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
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
      'posts_sources'
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
});
