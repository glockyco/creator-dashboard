import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migrationFiles = readdirSync('migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort();
const migrations = migrationFiles.map((file) => readFileSync(`migrations/${file}`, 'utf8'));
const cleanupMigrationIndex = migrationFiles.indexOf('0006_cleanup.sql');
if (cleanupMigrationIndex < 0) throw new Error('0006_cleanup.sql is missing');
const cleanupMigration = migrations[cleanupMigrationIndex]!;

function migratedDb() {
  const db = new DatabaseSync(':memory:');
  for (const sql of migrations) db.exec(sql);
  return db;
}

function beforeCleanupDb() {
  const db = new DatabaseSync(':memory:');
  for (const sql of migrations.slice(0, cleanupMigrationIndex)) db.exec(sql);
  return db;
}

describe('D1 schema migrations', () => {
  it('keeps only retained runtime tables and indexes', () => {
    const db = migratedDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);

    expect(tables).toEqual(['collection_incidents', 'events', 'fetcher_failures', 'fetcher_runs', 'metric_points']);
    expect(indexes).toEqual([
      'idx_ci_active_source',
      'idx_ci_resolved_last_failure',
      'idx_ci_source_last_failure',
      'idx_ev_kind_ts',
      'idx_ev_source_ts',
      'idx_ev_ts',
      'idx_ff_incident_ts',
      'idx_ff_source_ts',
      'idx_ff_ts',
      'idx_mp_logical',
      'idx_mp_source_metric_ts',
      'idx_mp_ts'
    ]);
  });

  it('preserves retained collection and issue history while removing retired data', () => {
    const db = beforeCleanupDb();
    db.exec(`
      INSERT INTO metric_points VALUES ('steam-guide-afallon', 'views', 1, 100, NULL);
      INSERT INTO metric_points VALUES ('steam-guide-afallon', 'favorite_count', 1, 10, NULL);
      INSERT INTO metric_points VALUES ('steam-guide-afallon', 'rating', 1, 0.8, NULL);
      INSERT INTO metric_points VALUES ('steam-guide-afallon', 'ratings', 1, 20, NULL);
      INSERT INTO metric_points VALUES ('steam-guide-afallon', 'comment_count', 1, 2, NULL);
      INSERT INTO metric_points VALUES ('steam-guide-afallon', 'award_count', 1, 3, NULL);
      INSERT INTO metric_points VALUES ('thunderstore-wowmuch', 'package_downloads', 1, 50, '{"package":"AdventureGuide"}');
      INSERT INTO metric_points VALUES ('github-glockyco', 'followers', 1, 10, NULL);
      INSERT INTO metric_points VALUES ('gsc-glockyco-com', 'clicks', 1, 4, NULL);
      INSERT INTO metric_points VALUES ('cf-analytics-glockyco-com', 'visits', 1, 6, NULL);
      INSERT INTO metric_points VALUES ('ga4', 'views', 1, 8, NULL);

      INSERT INTO events VALUES ('steam-reviews-erenshor', 'review-1', 1, 'review', NULL, 'Review', NULL, NULL, NULL);
      INSERT INTO events VALUES ('erenshor-wiki-recent', 'wiki-1', 2, 'wiki_edit', NULL, 'Page', NULL, NULL, NULL);
      INSERT INTO events VALUES ('steam-guide-afallon', 'comment-1', 3, 'steam_guide_comment', NULL, NULL, NULL, NULL, NULL);
      INSERT INTO events VALUES ('github-glockyco', 'release-1', 4, 'release', NULL, NULL, NULL, NULL, NULL);

      INSERT INTO fetcher_runs VALUES ('steam-reviews-erenshor', 1, 1, 'success', NULL, 0);
      INSERT INTO fetcher_runs VALUES ('github-glockyco', 1, NULL, 'permanent_failure', 'retired', 1);

      INSERT INTO collection_incidents
        (source_id, first_failure_at, last_failure_at, latest_tier, latest_error, attempt_count)
      VALUES ('erenshor-wiki-recent', 1, 2, 'permanent', 'retained failure', 2);
      INSERT INTO collection_incidents
        (source_id, first_failure_at, last_failure_at, latest_tier, latest_error, attempt_count)
      VALUES ('github-glockyco', 1, 2, 'permanent', 'retired failure', 2);
    `);

    const retainedIncident = db
      .prepare("SELECT id FROM collection_incidents WHERE source_id = 'erenshor-wiki-recent'")
      .get() as { id: number };
    const retiredIncident = db
      .prepare("SELECT id FROM collection_incidents WHERE source_id = 'github-glockyco'")
      .get() as { id: number };

    db.prepare(
      `INSERT INTO fetcher_failures
       (source_id, ts, tier, status_code, error_message, incident_id, retry_scheduled_at)
       VALUES (?, 2, 'permanent', 403, 'retained failure', ?, NULL)`
    ).run('erenshor-wiki-recent', retainedIncident.id);
    db.prepare(
      `INSERT INTO fetcher_failures
       (source_id, ts, tier, status_code, error_message, incident_id, retry_scheduled_at)
       VALUES (?, 2, 'permanent', 403, 'retired failure', ?, NULL)`
    ).run('github-glockyco', retiredIncident.id);

    db.exec(`
      INSERT INTO digest_sent VALUES ('2026-09-23', 1);
      INSERT INTO posts_index VALUES ('post', 1, 'author', 'site', 'https://example.test', 'Post', '[]', NULL, 'hash');
      INSERT INTO posts_sources VALUES ('post', 'steam-guide-afallon');
      INSERT INTO steam_guide_awards VALUES ('steam-guide-afallon', 17, 2, 'https://example.test/icon.png', 1);
    `);

    db.exec(cleanupMigration);

    const metrics = db.prepare('SELECT source_id, metric FROM metric_points ORDER BY source_id, metric').all();
    const events = db.prepare('SELECT source_id, kind FROM events ORDER BY source_id').all();
    const incidents = db.prepare('SELECT source_id FROM collection_incidents ORDER BY source_id').all();
    const failures = db.prepare('SELECT source_id, incident_id FROM fetcher_failures ORDER BY source_id').all();

    expect(metrics).toEqual([
      { source_id: 'steam-guide-afallon', metric: 'award_count' },
      { source_id: 'steam-guide-afallon', metric: 'favorite_count' },
      { source_id: 'steam-guide-afallon', metric: 'rating' },
      { source_id: 'steam-guide-afallon', metric: 'ratings' },
      { source_id: 'steam-guide-afallon', metric: 'views' },
      { source_id: 'thunderstore-wowmuch', metric: 'package_downloads' }
    ]);
    expect(events).toEqual([
      { source_id: 'erenshor-wiki-recent', kind: 'wiki_edit' },
      { source_id: 'steam-reviews-erenshor', kind: 'review' }
    ]);
    expect(incidents).toEqual([{ source_id: 'erenshor-wiki-recent' }]);
    expect(failures).toEqual([{ source_id: 'erenshor-wiki-recent', incident_id: retainedIncident.id }]);

    for (const table of ['alerts_sent', 'digest_sent', 'posts_index', 'posts_sources', 'steam_guide_awards']) {
      expect(
        db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
      ).toEqual({
        count: 0
      });
    }
  });

  it('deduplicates metric writes with NULL dimensions', () => {
    const db = migratedDb();
    const upsert = db.prepare(
      "INSERT INTO metric_points (source_id, metric, ts, value, dimensions) VALUES (?, ?, ?, ?, ?) ON CONFLICT(source_id, metric, ts, COALESCE(dimensions, '')) DO UPDATE SET value = excluded.value"
    );

    upsert.run('steam-guide-afallon', 'views', 1000, 3, null);
    upsert.run('steam-guide-afallon', 'views', 1000, 6, null);
    upsert.run('thunderstore-wowmuch', 'package_downloads', 1000, 10, '{"package":"AdventureGuide"}');
    upsert.run('thunderstore-wowmuch', 'package_downloads', 1000, 5, '{"package":"Sprint"}');

    expect(
      db.prepare('SELECT metric, ts, value, dimensions FROM metric_points ORDER BY metric, dimensions').all()
    ).toEqual([
      { metric: 'package_downloads', ts: 1000, value: 10, dimensions: '{"package":"AdventureGuide"}' },
      { metric: 'package_downloads', ts: 1000, value: 5, dimensions: '{"package":"Sprint"}' },
      { metric: 'views', ts: 1000, value: 6, dimensions: null }
    ]);
  });
});
