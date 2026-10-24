import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { d1Fixture, migrationsThrough } from '$lib/server/db/test-d1';
import { getIssue } from './queries';
import {
  claimManualRetry,
  getActiveIncident,
  prepareIncidentResolution,
  recordCollectionFailure,
  releaseManualRetry
} from './model';

describe('collection incident persistence', () => {
  it('backfills failed runs, their open-era attempts, and prior notification delivery', () => {
    const sqlite = new DatabaseSync(':memory:');
    for (const migration of migrationsThrough('0004_remove_bing_sources.sql')) sqlite.exec(migration);
    sqlite.exec(`
      INSERT INTO fetcher_runs VALUES (
        'steam-guide-afallon', 300, 100, 'permanent_failure', 'latest full error', 2
      );
      INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message)
      VALUES
        ('steam-guide-afallon', 50, 'transient', 500, 'old resolved error'),
        ('steam-guide-afallon', 200, 'transient', 503, 'first open error'),
        ('steam-guide-afallon', 300, 'permanent', 401, 'latest full error');
      INSERT INTO alerts_sent VALUES ('permanent:steam-guide-afallon:auth_dead', 350);
    `);
    sqlite.exec(readFileSync('migrations/0005_incidents.sql', 'utf8'));

    expect(
      sqlite
        .prepare(
          `SELECT source_id, first_failure_at, last_failure_at, latest_tier, latest_status_code,
                  latest_error, attempt_count, last_success_at, next_retry_at,
                  failure_notification_state, failure_notified_at
           FROM collection_incidents`
        )
        .get()
    ).toEqual({
      source_id: 'steam-guide-afallon',
      first_failure_at: 200,
      last_failure_at: 300,
      latest_tier: 'permanent',
      latest_status_code: 401,
      latest_error: 'latest full error',
      attempt_count: 2,
      last_success_at: 100,
      next_retry_at: null,
      failure_notification_state: 'sent',
      failure_notified_at: 350
    });
    expect(
      sqlite
        .prepare('SELECT ts, incident_id FROM fetcher_failures ORDER BY ts')
        .all()
        .map((row) => ({ ts: row.ts, linked: row.incident_id !== null }))
    ).toEqual([
      { ts: 50, linked: false },
      { ts: 200, linked: true },
      { ts: 300, linked: true }
    ]);
  });

  it('keeps one incident through failures and recovery, then opens a new incident', async () => {
    const { sqlite, d1 } = d1Fixture();
    sqlite.exec(`
      INSERT INTO fetcher_runs
      VALUES ('steam-guide-afallon', 50, 50, 'success', NULL, 0);
    `);

    const first = await recordCollectionFailure(d1, {
      sourceId: 'steam-guide-afallon',
      ts: 100,
      tier: 'transient',
      statusCode: 503,
      error: 'temporary outage',
      nextRetryAt: 400
    });
    const second = await recordCollectionFailure(d1, {
      sourceId: 'steam-guide-afallon',
      ts: 200,
      tier: 'permanent',
      statusCode: 401,
      error: 'complete authentication failure',
      nextRetryAt: null
    });

    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({
      attemptCount: 2,
      firstFailureAt: 100,
      lastFailureAt: 200,
      latestStatusCode: 401,
      latestError: 'complete authentication failure',
      nextRetryAt: null
    });

    sqlite.prepare("UPDATE collection_incidents SET failure_notification_state = 'sent' WHERE id = ?").run(first.id);
    await d1.batch([
      d1
        .prepare(
          `UPDATE fetcher_runs
           SET last_run_at = ?, last_success_at = ?, last_status = 'success',
               last_error = NULL, consecutive_failures = 0
           WHERE source_id = ?`
        )
        .bind(250, 250, 'steam-guide-afallon'),
      prepareIncidentResolution(d1, first.id, 250)
    ]);

    expect(await getActiveIncident(d1, 'steam-guide-afallon')).toBeNull();
    await expect(getIssue(d1, first.id, 250)).resolves.toMatchObject({
      incident: {
        id: first.id,
        state: 'recovered',
        resolvedAt: 250,
        recoveryNotificationState: 'pending'
      },
      attempts: [
        { ts: 200, error: 'complete authentication failure', retryScheduledAt: null },
        { ts: 100, error: 'temporary outage', retryScheduledAt: 400 }
      ]
    });

    const later = await recordCollectionFailure(d1, {
      sourceId: 'steam-guide-afallon',
      ts: 300,
      tier: 'transient',
      statusCode: 502,
      error: 'new outage',
      nextRetryAt: 600
    });
    expect(later.id).not.toBe(first.id);
    expect(later).toMatchObject({ attemptCount: 1, lastSuccessAt: 250, nextRetryAt: 600 });

    await expect(claimManualRetry(d1, later.id, 'steam-guide-afallon', 700)).resolves.toBe(true);
    await expect(claimManualRetry(d1, later.id, 'steam-guide-afallon', 701)).resolves.toBe(false);
    await releaseManualRetry(d1, later.id, 700);
    await expect(claimManualRetry(d1, later.id, 'steam-guide-afallon', 701)).resolves.toBe(true);
  });
});
