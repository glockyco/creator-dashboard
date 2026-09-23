import type { FetcherOutput } from '$lib/types/domain';

export function successStatements(
  db: D1Database,
  sourceId: string,
  now: number,
  output: FetcherOutput
): D1PreparedStatement[] {
  return [
    ...output.metric_points.map((point) =>
      db
        .prepare(
          "INSERT INTO metric_points (source_id, metric, ts, value, dimensions) VALUES (?, ?, ?, ?, ?) ON CONFLICT(source_id, metric, ts, COALESCE(dimensions, '')) DO UPDATE SET value = excluded.value"
        )
        .bind(
          point.source_id,
          point.metric,
          point.ts,
          point.value,
          point.dimensions ? JSON.stringify(point.dimensions) : null
        )
    ),
    ...output.events.map((event) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO events (source_id, external_id, ts, kind, author, title, body, url, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          event.source_id,
          event.external_id,
          event.ts,
          event.kind,
          event.author,
          event.title,
          event.body,
          event.url,
          event.metadata ? JSON.stringify(event.metadata) : null
        )
    ),
    db
      .prepare(
        `
      INSERT INTO fetcher_runs (source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures)
      VALUES (?, ?, ?, 'success', NULL, 0)
      ON CONFLICT(source_id) DO UPDATE SET
        last_run_at = excluded.last_run_at,
        last_success_at = excluded.last_success_at,
        last_status = 'success',
        last_error = NULL,
        consecutive_failures = 0
    `
      )
      .bind(sourceId, now, now)
  ];
}
