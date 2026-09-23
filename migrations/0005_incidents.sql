CREATE TABLE collection_incidents (
  id                                  INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id                           TEXT    NOT NULL,
  first_failure_at                    INTEGER NOT NULL,
  last_failure_at                     INTEGER NOT NULL,
  latest_tier                         TEXT    NOT NULL,
  latest_status_code                  INTEGER,
  latest_error                        TEXT    NOT NULL,
  attempt_count                       INTEGER NOT NULL DEFAULT 0,
  last_success_at                     INTEGER,
  next_retry_at                       INTEGER,
  manual_retry_queued_at              INTEGER,
  resolved_at                         INTEGER,
  failure_notification_state          TEXT    NOT NULL DEFAULT 'not_requested'
    CHECK (failure_notification_state IN ('not_requested', 'sending', 'sent', 'failed')),
  failure_notification_attempted_at   INTEGER,
  failure_notified_at                 INTEGER,
  recovery_notification_state         TEXT    NOT NULL DEFAULT 'not_required'
    CHECK (recovery_notification_state IN ('not_required', 'pending', 'sending', 'sent', 'failed')),
  recovery_notification_attempted_at  INTEGER,
  recovery_notified_at                INTEGER
);

CREATE UNIQUE INDEX idx_ci_active_source
  ON collection_incidents(source_id)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_ci_resolved_last_failure
  ON collection_incidents(resolved_at, last_failure_at DESC);
CREATE INDEX idx_ci_source_last_failure
  ON collection_incidents(source_id, last_failure_at DESC);

ALTER TABLE fetcher_failures ADD COLUMN incident_id INTEGER REFERENCES collection_incidents(id);
ALTER TABLE fetcher_failures ADD COLUMN retry_scheduled_at INTEGER;
CREATE INDEX idx_ff_incident_ts ON fetcher_failures(incident_id, ts DESC, id DESC);

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
  failure_notified_at,
  recovery_notification_state
)
SELECT
  run.source_id,
  COALESCE(
    (
      SELECT MIN(failure.ts)
      FROM fetcher_failures AS failure
      WHERE failure.source_id = run.source_id
        AND failure.ts > COALESCE(run.last_success_at, -1)
    ),
    run.last_run_at
  ),
  COALESCE(
    (
      SELECT MAX(failure.ts)
      FROM fetcher_failures AS failure
      WHERE failure.source_id = run.source_id
        AND failure.ts > COALESCE(run.last_success_at, -1)
    ),
    run.last_run_at
  ),
  COALESCE(
    (
      SELECT failure.tier
      FROM fetcher_failures AS failure
      WHERE failure.source_id = run.source_id
        AND failure.ts > COALESCE(run.last_success_at, -1)
      ORDER BY failure.ts DESC, failure.id DESC
      LIMIT 1
    ),
    CASE
      WHEN run.last_status = 'permanent_failure' THEN 'permanent'
      WHEN run.last_status = 'rate_limited_failure' THEN 'rate_limited'
      ELSE 'transient'
    END
  ),
  (
    SELECT failure.status_code
    FROM fetcher_failures AS failure
    WHERE failure.source_id = run.source_id
      AND failure.ts > COALESCE(run.last_success_at, -1)
    ORDER BY failure.ts DESC, failure.id DESC
    LIMIT 1
  ),
  COALESCE(
    (
      SELECT failure.error_message
      FROM fetcher_failures AS failure
      WHERE failure.source_id = run.source_id
        AND failure.ts > COALESCE(run.last_success_at, -1)
      ORDER BY failure.ts DESC, failure.id DESC
      LIMIT 1
    ),
    run.last_error,
    'Collection failed without a recorded error'
  ),
  MAX(
    1,
    run.consecutive_failures,
    (
      SELECT COUNT(*)
      FROM fetcher_failures AS failure
      WHERE failure.source_id = run.source_id
        AND failure.ts > COALESCE(run.last_success_at, -1)
    )
  ),
  run.last_success_at,
  NULL,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM alerts_sent AS alert
      WHERE instr(alert.alert_key, ':' || run.source_id || ':') > 0
        AND alert.sent_at >= COALESCE(
          (
            SELECT MIN(failure.ts)
            FROM fetcher_failures AS failure
            WHERE failure.source_id = run.source_id
              AND failure.ts > COALESCE(run.last_success_at, -1)
          ),
          run.last_run_at
        )
    ) THEN 'sent'
    ELSE 'not_requested'
  END,
  (
    SELECT MAX(alert.sent_at)
    FROM alerts_sent AS alert
    WHERE instr(alert.alert_key, ':' || run.source_id || ':') > 0
      AND alert.sent_at >= COALESCE(
        (
          SELECT MIN(failure.ts)
          FROM fetcher_failures AS failure
          WHERE failure.source_id = run.source_id
            AND failure.ts > COALESCE(run.last_success_at, -1)
        ),
        run.last_run_at
      )
  ),
  'not_required'
FROM fetcher_runs AS run
WHERE run.last_status <> 'success' OR run.consecutive_failures > 0;

UPDATE fetcher_failures
SET incident_id = (
  SELECT incident.id
  FROM collection_incidents AS incident
  WHERE incident.source_id = fetcher_failures.source_id
    AND incident.resolved_at IS NULL
    AND fetcher_failures.ts > COALESCE(incident.last_success_at, -1)
)
WHERE incident_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM collection_incidents AS incident
    WHERE incident.source_id = fetcher_failures.source_id
      AND incident.resolved_at IS NULL
      AND fetcher_failures.ts > COALESCE(incident.last_success_at, -1)
  );
