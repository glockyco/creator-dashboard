import type { JobMsg } from '$lib/types/orchestration';
import { maybeSendAlert } from '$lib/server/alerts/dedup';

export async function consumeDlqMessage(message: Message<JobMsg>, env: Env, now = Date.now()): Promise<void> {
  const sourceId = message.body.source_id;
  await env.DB.prepare(
    'INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(sourceId, now, 'dlq', null, 'Exhausted retries')
    .run();
  await maybeSendAlert(env, sourceId, 'dlq', 'exhausted_retries', 'Failed after 5 retries', now);
  message.ack();
}
