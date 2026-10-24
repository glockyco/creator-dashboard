-- `wrangler d1 export` writes tables in creation order. fetcher_failures was created before
-- collection_incidents and only later gained a foreign key to it, so an export could not be imported.
-- Rebuilding the table places it after its parent, with the same columns, rows, ids, and indexes.
CREATE TABLE fetcher_failures_rebuilt (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id          TEXT    NOT NULL,
  ts                 INTEGER NOT NULL,
  tier               TEXT    NOT NULL,
  status_code        INTEGER,
  error_message      TEXT    NOT NULL,
  incident_id        INTEGER REFERENCES collection_incidents(id),
  retry_scheduled_at INTEGER
);

INSERT INTO fetcher_failures_rebuilt (id, source_id, ts, tier, status_code, error_message, incident_id, retry_scheduled_at)
SELECT id, source_id, ts, tier, status_code, error_message, incident_id, retry_scheduled_at
FROM fetcher_failures;

DROP TABLE fetcher_failures;
ALTER TABLE fetcher_failures_rebuilt RENAME TO fetcher_failures;

CREATE INDEX idx_ff_ts ON fetcher_failures(ts DESC);
CREATE INDEX idx_ff_source_ts ON fetcher_failures(source_id, ts DESC);
CREATE INDEX idx_ff_incident_ts ON fetcher_failures(incident_id, ts DESC, id DESC);
