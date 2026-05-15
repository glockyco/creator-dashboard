export async function getHealthSnapshot(db: D1Database) {
  const [runs, failures, alerts] = await Promise.all([
    db
      .prepare(
        'SELECT source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures FROM fetcher_runs ORDER BY source_id'
      )
      .all(),
    db
      .prepare(
        'SELECT id, source_id, ts, tier, status_code, error_message FROM fetcher_failures ORDER BY ts DESC LIMIT 100'
      )
      .all(),
    db.prepare('SELECT alert_key, sent_at FROM alerts_sent ORDER BY sent_at DESC LIMIT 100').all()
  ]);

  return { runs: runs.results, failures: failures.results, alerts: alerts.results };
}
