import { getSource } from '#lib/sources/registry.js';
import type { JobMsg } from '#lib/types/orchestration.js';
import { maybeSendFailureAlert } from '#lib/server/alerts/dedup.js';
import { markRetriesExhausted } from '#lib/server/incidents/index.js';
import { log } from '#lib/server/log.js';

export async function consumeDlqMessage(message: Message<JobMsg>, env: Env, now = Date.now()): Promise<void> {
  const sourceId = message.body.source_id;
  if (!getSource(sourceId)) {
    log('warn', 'dropping unknown source dead-letter job', { source_id: sourceId });
    message.ack();
    return;
  }

  const incident = await markRetriesExhausted(env.DB, sourceId);
  if (!incident) {
    // A later collection succeeded and resolved the incident, so there is nothing to report.
    message.ack();
    return;
  }

  try {
    await maybeSendFailureAlert(env, incident, now);
  } catch (notificationError) {
    log('error', 'Discord dead-letter notification failed', {
      source_id: sourceId,
      incident_id: incident.id,
      error: notificationError instanceof Error ? notificationError.message : String(notificationError)
    });
  }
  message.ack();
}
