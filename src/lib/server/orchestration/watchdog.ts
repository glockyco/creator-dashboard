import { sources } from '$lib/sources/registry';
import { maybeSendFailureAlert, maybeSendRecoveryAlert } from '$lib/server/alerts/dedup';
import {
  incidentColumns,
  isStale,
  mapIncident,
  openStaleIncident,
  type CollectionIncident,
  type IncidentRow
} from '$lib/server/incidents/model';
import { log } from '$lib/server/log';

/** An incident open this long alerts even if no single failure was permanent or exhausted its retries. */
export const ESCALATE_AFTER_MS = 3 * 3_600_000;
/** A notification still 'sending' after this long was interrupted and may be sent again. */
export const STUCK_SENDING_MS = 10 * 60_000;
/** Failed recovery notifications are retried for this long after resolution. */
const RECOVERY_RETRY_WINDOW_MS = 7 * 24 * 3_600_000;

/**
 * Hourly checks that do not depend on queue delivery: collectors that stopped succeeding without a
 * recorded failure, incidents that stayed open without alerting, and notifications that failed or
 * were interrupted.
 */
export async function runWatchdog(env: Env, now: number): Promise<void> {
  await openStaleIncidents(env, now);

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE collection_incidents SET failure_notification_state = 'failed'
       WHERE failure_notification_state = 'sending' AND failure_notification_attempted_at <= ?`
    ).bind(now - STUCK_SENDING_MS),
    env.DB.prepare(
      `UPDATE collection_incidents SET recovery_notification_state = 'failed'
       WHERE recovery_notification_state = 'sending' AND recovery_notification_attempted_at <= ?`
    ).bind(now - STUCK_SENDING_MS)
  ]);

  const unalerted = await env.DB.prepare(
    `SELECT ${incidentColumns} FROM collection_incidents
     WHERE resolved_at IS NULL
       AND (failure_notification_state = 'failed'
         OR (failure_notification_state = 'not_requested' AND first_failure_at <= ?))`
  )
    .bind(now - ESCALATE_AFTER_MS)
    .all<IncidentRow>();
  for (const incident of unalerted.results.map(mapIncident)) {
    await notify('failure', incident, () => maybeSendFailureAlert(env, incident, now));
  }

  const unrecovered = await env.DB.prepare(
    `SELECT ${incidentColumns} FROM collection_incidents
     WHERE resolved_at >= ? AND recovery_notification_state = 'failed'`
  )
    .bind(now - RECOVERY_RETRY_WINDOW_MS)
    .all<IncidentRow>();
  for (const incident of unrecovered.results.map(mapIncident)) {
    await notify('recovery', incident, () => maybeSendRecoveryAlert(env, incident, now));
  }
}

async function openStaleIncidents(env: Env, now: number): Promise<void> {
  const runs = await env.DB.prepare(
    `SELECT run.source_id, run.last_success_at
     FROM fetcher_runs AS run
     WHERE NOT EXISTS (
       SELECT 1 FROM collection_incidents AS incident
       WHERE incident.source_id = run.source_id AND incident.resolved_at IS NULL
     )`
  ).all<{ source_id: string; last_success_at: number | null }>();

  for (const run of runs.results) {
    const source = sources.find((candidate) => candidate.id === run.source_id);
    if (!source || (run.last_success_at !== null && !isStale(run.last_success_at, source.cadenceHours, now))) continue;
    const incident = await openStaleIncident(env.DB, run.source_id, run.last_success_at, now);
    if (incident) await notify('failure', incident, () => maybeSendFailureAlert(env, incident, now));
  }
}

async function notify(kind: string, incident: CollectionIncident, send: () => Promise<boolean>): Promise<void> {
  try {
    await send();
  } catch (error) {
    log('error', `Discord ${kind} notification failed`, {
      source_id: incident.sourceId,
      incident_id: incident.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
