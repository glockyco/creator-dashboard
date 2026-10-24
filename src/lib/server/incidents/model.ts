export type IncidentFailureTier = 'transient' | 'rate_limited' | 'permanent' | 'dlq' | 'stale';
export type FailureNotificationState = 'not_requested' | 'sending' | 'sent' | 'failed';
export type RecoveryNotificationState = 'not_required' | 'pending' | 'sending' | 'sent' | 'failed';

export type CollectionIncident = {
  id: number;
  sourceId: string;
  firstFailureAt: number;
  lastFailureAt: number;
  latestTier: IncidentFailureTier;
  latestStatusCode: number | null;
  latestError: string;
  attemptCount: number;
  lastSuccessAt: number | null;
  nextRetryAt: number | null;
  manualRetryQueuedAt: number | null;
  resolvedAt: number | null;
  failureNotificationState: FailureNotificationState;
  failureNotificationAttemptedAt: number | null;
  failureNotifiedAt: number | null;
  recoveryNotificationState: RecoveryNotificationState;
  recoveryNotificationAttemptedAt: number | null;
  recoveryNotifiedAt: number | null;
};

export type RecordFailureInput = {
  sourceId: string;
  ts: number;
  tier: IncidentFailureTier;
  statusCode: number | null;
  error: string;
  nextRetryAt: number | null;
  /** A cron-dispatched run, which advances the cadence gate. Manual retries do not. */
  scheduled: boolean;
  /** The failure ends a manual retry chain, so the retry button may be offered again. */
  endsManualRetry: boolean;
};

// A forced retry chain runs up to six attempts five or more minutes apart before reaching the dead-letter queue.
export const MANUAL_RETRY_GUARD_MS = 45 * 60_000;

/** A collector is stale when it has gone two expected collection intervals without a success. */
export function isStale(lastSuccessAt: number, cadenceHours: number, now: number): boolean {
  return now - lastSuccessAt > cadenceHours * 2 * 3_600_000;
}

/** Opens an incident for a collector that stopped succeeding without recording a failure. */
export async function openStaleIncident(
  db: D1Database,
  sourceId: string,
  lastSuccessAt: number | null,
  now: number
): Promise<CollectionIncident | null> {
  const since = lastSuccessAt === null ? 'its first run' : new Date(lastSuccessAt).toISOString();
  await db
    .prepare(
      `
        INSERT INTO collection_incidents (
          source_id, first_failure_at, last_failure_at, latest_tier, latest_status_code, latest_error,
          attempt_count, last_success_at, next_retry_at, failure_notification_state, recovery_notification_state
        )
        SELECT ?, ?, ?, 'stale', NULL, ?, 0, ?, NULL, 'not_requested', 'not_required'
        WHERE NOT EXISTS (SELECT 1 FROM collection_incidents WHERE source_id = ? AND resolved_at IS NULL)
      `
    )
    .bind(sourceId, now, now, `No successful collection since ${since}.`, lastSuccessAt, sourceId)
    .run();
  return getActiveIncident(db, sourceId);
}

export type IncidentRow = {
  id: number;
  source_id: string;
  first_failure_at: number;
  last_failure_at: number;
  latest_tier: IncidentFailureTier;
  latest_status_code: number | null;
  latest_error: string;
  attempt_count: number;
  last_success_at: number | null;
  next_retry_at: number | null;
  manual_retry_queued_at: number | null;
  resolved_at: number | null;
  failure_notification_state: FailureNotificationState;
  failure_notification_attempted_at: number | null;
  failure_notified_at: number | null;
  recovery_notification_state: RecoveryNotificationState;
  recovery_notification_attempted_at: number | null;
  recovery_notified_at: number | null;
};

export const incidentColumns = `
  id,
  source_id,
  first_failure_at,
  last_failure_at,
  latest_tier,
  latest_status_code,
  latest_error,
  attempt_count,
  last_success_at,
  next_retry_at,
  manual_retry_queued_at,
  resolved_at,
  failure_notification_state,
  failure_notification_attempted_at,
  failure_notified_at,
  recovery_notification_state,
  recovery_notification_attempted_at,
  recovery_notified_at
`;

export function mapIncident(row: IncidentRow): CollectionIncident {
  return {
    id: row.id,
    sourceId: row.source_id,
    firstFailureAt: row.first_failure_at,
    lastFailureAt: row.last_failure_at,
    latestTier: row.latest_tier,
    latestStatusCode: row.latest_status_code,
    latestError: row.latest_error,
    attemptCount: row.attempt_count,
    lastSuccessAt: row.last_success_at,
    nextRetryAt: row.next_retry_at,
    manualRetryQueuedAt: row.manual_retry_queued_at,
    resolvedAt: row.resolved_at,
    failureNotificationState: row.failure_notification_state,
    failureNotificationAttemptedAt: row.failure_notification_attempted_at,
    failureNotifiedAt: row.failure_notified_at,
    recoveryNotificationState: row.recovery_notification_state,
    recoveryNotificationAttemptedAt: row.recovery_notification_attempted_at,
    recoveryNotifiedAt: row.recovery_notified_at
  };
}

export async function getActiveIncident(db: D1Database, sourceId: string): Promise<CollectionIncident | null> {
  const row = await db
    .prepare(`SELECT ${incidentColumns} FROM collection_incidents WHERE source_id = ? AND resolved_at IS NULL`)
    .bind(sourceId)
    .first<IncidentRow>();
  return row ? mapIncident(row) : null;
}

export async function recordCollectionFailure(db: D1Database, input: RecordFailureInput): Promise<CollectionIncident> {
  const { sourceId, ts, tier, statusCode, error, nextRetryAt, scheduled, endsManualRetry } = input;
  await db.batch([
    db
      .prepare(
        `
          INSERT INTO collection_incidents (
            source_id,
            first_failure_at,
            last_failure_at,
            latest_tier,
            latest_status_code,
            latest_error,
            attempt_count,
            last_success_at,
            next_retry_at,
            failure_notification_state,
            recovery_notification_state
          )
          SELECT ?, ?, ?, ?, ?, ?, 0,
            (SELECT last_success_at FROM fetcher_runs WHERE source_id = ?),
            ?, 'not_requested', 'not_required'
          WHERE NOT EXISTS (
            SELECT 1 FROM collection_incidents WHERE source_id = ? AND resolved_at IS NULL
          )
        `
      )
      .bind(sourceId, ts, ts, tier, statusCode, error, sourceId, nextRetryAt, sourceId),
    db
      .prepare(
        `
          UPDATE collection_incidents
          SET last_failure_at = ?,
              latest_tier = ?,
              latest_status_code = ?,
              latest_error = ?,
              attempt_count = attempt_count + 1,
              next_retry_at = ?,
              manual_retry_queued_at = CASE WHEN ? THEN NULL ELSE manual_retry_queued_at END
          WHERE source_id = ? AND resolved_at IS NULL
        `
      )
      .bind(ts, tier, statusCode, error, nextRetryAt, endsManualRetry ? 1 : 0, sourceId),
    db
      .prepare(
        `
          INSERT INTO fetcher_failures (
            source_id, ts, tier, status_code, error_message, incident_id, retry_scheduled_at
          )
          SELECT ?, ?, ?, ?, ?, id, ?
          FROM collection_incidents
          WHERE source_id = ? AND resolved_at IS NULL
        `
      )
      .bind(sourceId, ts, tier, statusCode, error, nextRetryAt, sourceId),
    db
      .prepare(
        `
          INSERT INTO fetcher_runs (
            source_id, last_run_at, last_scheduled_run_at, last_success_at, last_status, last_error, consecutive_failures
          )
          VALUES (?, ?, ?, NULL, ?, ?, 1)
          ON CONFLICT(source_id) DO UPDATE SET
            last_run_at = excluded.last_run_at,
            last_scheduled_run_at = COALESCE(excluded.last_scheduled_run_at, fetcher_runs.last_scheduled_run_at),
            last_status = excluded.last_status,
            last_error = excluded.last_error,
            consecutive_failures = fetcher_runs.consecutive_failures + 1
        `
      )
      .bind(sourceId, ts, scheduled ? ts : null, `${tier}_failure`, error)
  ]);

  const incident = await getActiveIncident(db, sourceId);
  if (!incident) throw new Error(`Failed to record collection incident for ${sourceId}`);
  return incident;
}

/**
 * Marks the active incident as out of automatic retries. The latest real failure stays the incident's
 * evidence, and no attempt is recorded because the dead-letter queue does not fetch.
 */
export async function markRetriesExhausted(db: D1Database, sourceId: string): Promise<CollectionIncident | null> {
  await db
    .prepare(
      `
        UPDATE collection_incidents
        SET latest_tier = 'dlq',
            next_retry_at = NULL,
            manual_retry_queued_at = NULL
        WHERE source_id = ? AND resolved_at IS NULL
      `
    )
    .bind(sourceId)
    .run();
  return getActiveIncident(db, sourceId);
}

export function prepareIncidentResolution(db: D1Database, incidentId: number, resolvedAt: number): D1PreparedStatement {
  return db
    .prepare(
      `
        UPDATE collection_incidents
        SET resolved_at = ?,
            next_retry_at = NULL,
            manual_retry_queued_at = NULL,
            recovery_notification_state = CASE
              WHEN failure_notification_state = 'sent' THEN 'pending'
              ELSE 'not_required'
            END
        WHERE id = ? AND resolved_at IS NULL
      `
    )
    .bind(resolvedAt, incidentId);
}

export async function claimManualRetry(
  db: D1Database,
  incidentId: number,
  sourceId: string,
  now = Date.now()
): Promise<boolean> {
  const result = await db
    .prepare(
      `
        UPDATE collection_incidents
        SET manual_retry_queued_at = ?
        WHERE id = ?
          AND source_id = ?
          AND resolved_at IS NULL
          AND (manual_retry_queued_at IS NULL OR manual_retry_queued_at < ?)
      `
    )
    .bind(now, incidentId, sourceId, now - MANUAL_RETRY_GUARD_MS)
    .run();
  return result.meta.changes === 1;
}

export async function releaseManualRetry(db: D1Database, incidentId: number, queuedAt: number): Promise<void> {
  await db
    .prepare(
      `
        UPDATE collection_incidents
        SET manual_retry_queued_at = NULL
        WHERE id = ? AND manual_retry_queued_at = ? AND resolved_at IS NULL
      `
    )
    .bind(incidentId, queuedAt)
    .run();
}
