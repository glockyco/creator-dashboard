import { getSource } from '$lib/sources/registry';
import type { JobMsg } from '$lib/types/orchestration';
import { maybeSendFailureAlert } from '$lib/server/alerts/dedup';
import { recordCollectionFailure } from '$lib/server/incidents';
import { log } from '$lib/server/log';

export async function consumeDlqMessage(message: Message<JobMsg>, env: Env, now = Date.now()): Promise<void> {
  const sourceId = message.body.source_id;
  if (!getSource(sourceId)) {
    log('warn', 'dropping unknown source dead-letter job', { source_id: sourceId });
    message.ack();
    return;
  }

  const incident = await recordCollectionFailure(env.DB, {
    sourceId,
    ts: now,
    tier: 'dlq',
    statusCode: null,
    error: 'Exhausted queue retries',
    nextRetryAt: null
  });
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
