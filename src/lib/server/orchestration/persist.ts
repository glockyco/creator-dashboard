import type { FetcherOutput } from '$lib/types/domain';

export function successStatements(
  db: D1Database,
  sourceId: string,
  now: number,
  output: FetcherOutput
): D1PreparedStatement[] {
  const awardStatements = output.steam_guide_awards
    ? [
        ...output.steam_guide_awards.map((award) =>
          db
            .prepare(
              `INSERT INTO steam_guide_awards (source_id, reaction_id, count, icon_url, captured_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(source_id, reaction_id) DO UPDATE SET
                 count = excluded.count,
                 icon_url = excluded.icon_url,
                 captured_at = excluded.captured_at`
            )
            .bind(award.source_id, award.reaction_id, award.count, award.icon_url, award.captured_at)
        ),
        db.prepare('DELETE FROM steam_guide_awards WHERE source_id = ? AND captured_at <> ?').bind(sourceId, now)
      ]
    : [];

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
    ...awardStatements,
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
