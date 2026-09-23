import { getSource } from '$lib/sources/registry';
import type { JobMsg } from '$lib/types/orchestration';
import { maybeSendFailureAlert, maybeSendRecoveryAlert } from '$lib/server/alerts/dedup';
import {
  getActiveIncident,
  prepareIncidentResolution,
  recordCollectionFailure,
  type CollectionIncident
} from '$lib/server/incidents';
import { log } from '$lib/server/log';
import { classify } from './errors';
import { successStatements } from './persist';

export async function consumeMessage(message: Message<JobMsg>, env: Env, now = Date.now()): Promise<void> {
  const { source_id, force } = message.body;
  const source = getSource(source_id);
  if (!source) {
    log('warn', 'dropping unknown source job', { source_id });
    message.ack();
    return;
  }

  if (!force) {
    const run = await env.DB.prepare('SELECT last_run_at FROM fetcher_runs WHERE source_id = ?')
      .bind(source_id)
      .first<{ last_run_at: number }>();
    const cadenceMs = source.cadenceHours * 3_600_000;
    if (run && now - run.last_run_at < cadenceMs - 300_000) {
      message.ack();
      return;
    }
  }

  try {
    const output = await source.fetcher({ source, env, now });
    const activeIncident = await getActiveIncident(env.DB, source_id);
    const statements = successStatements(env.DB, source_id, now, output);
    if (activeIncident) statements.push(prepareIncidentResolution(env.DB, activeIncident.id, now));
    await env.DB.batch(statements);
    log('info', 'source fetch succeeded', {
      source_id,
      metric_points: output.metric_points.length,
      events: output.events.length
    });

    if (activeIncident) {
      const resolvedIncident: CollectionIncident = {
        ...activeIncident,
        nextRetryAt: null,
        manualRetryQueuedAt: null,
        resolvedAt: now,
        recoveryNotificationState: activeIncident.failureNotificationState === 'sent' ? 'pending' : 'not_required'
      };
      try {
        await maybeSendRecoveryAlert(env, resolvedIncident, now);
      } catch (notificationError) {
        log('error', 'Discord recovery notification failed', {
          source_id,
          incident_id: activeIncident.id,
          error: notificationError instanceof Error ? notificationError.message : String(notificationError)
        });
      }
    }

    message.ack();
  } catch (err) {
    const failure = classify(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const retryDelaySeconds = failure.tier === 'permanent' ? null : (failure.retryAfterSeconds ?? 300);
    const incident = await recordCollectionFailure(env.DB, {
      sourceId: source_id,
      ts: now,
      tier: failure.tier,
      statusCode: failure.statusCode,
      error: errorMessage,
      nextRetryAt: retryDelaySeconds === null ? null : now + retryDelaySeconds * 1_000
    });

    if (failure.tier === 'permanent') {
      try {
        await maybeSendFailureAlert(env, incident, now);
      } catch (notificationError) {
        log('error', 'Discord failure notification failed', {
          source_id,
          incident_id: incident.id,
          error: notificationError instanceof Error ? notificationError.message : String(notificationError)
        });
      }
      message.ack();
      return;
    }

    message.retry({ delaySeconds: retryDelaySeconds ?? 300 });
  }
}
