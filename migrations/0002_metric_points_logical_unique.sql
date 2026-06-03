-- Dedupe metric_points by logical key (source_id, metric, ts, dimensions with NULL == '').
--
-- The original PRIMARY KEY includes `dimensions`, but SQLite treats NULL as distinct in a
-- unique index (see https://www.sqlite.org/nulls.html), so the previous `INSERT OR IGNORE`
-- could never dedupe NULL-dimension rows (contributions, bing daily metrics) — each fetch
-- inserted a fresh duplicate. This unique index coalesces NULL and '' to one logical key and
-- backs the upsert in successStatements() (ON CONFLICT(... COALESCE(dimensions,'')) DO UPDATE).
--
-- Run `pnpm dedup:metrics --remote` (batched) BEFORE deploying: D1 cannot delete hundreds of
-- thousands of rows in one statement, so the bulk cleanup is batched in that script. The DELETE
-- below is only a residual safety net — it removes the handful of duplicates the old code may add
-- between that batched cleanup and this migration, so CREATE UNIQUE INDEX never fails on a near-
-- clean table. On a fresh or already-deduped database it is a no-op.
DELETE FROM metric_points WHERE rowid NOT IN (
  SELECT MAX(rowid) FROM metric_points GROUP BY source_id, metric, ts, COALESCE(dimensions, '')
);
CREATE UNIQUE INDEX idx_mp_logical ON metric_points (source_id, metric, ts, COALESCE(dimensions, ''));
