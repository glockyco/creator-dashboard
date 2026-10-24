-- The hourly cadence gate compares against the last scheduled run only, so a manual retry no longer
-- pushes the next scheduled collection back by an hour. last_run_at keeps recording every run.
ALTER TABLE fetcher_runs ADD COLUMN last_scheduled_run_at INTEGER;
UPDATE fetcher_runs SET last_scheduled_run_at = last_run_at;
