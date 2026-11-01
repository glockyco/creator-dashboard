import type { JobMsg } from '#lib/types/orchestration.js';
import { consumeDlqMessage } from '#lib/server/orchestration/dlq.js';
import { consumeMessage } from '#lib/server/orchestration/consumer.js';

export async function queue(batch: MessageBatch<JobMsg>, env: Env, _ctx: ExecutionContext): Promise<void> {
  for (const message of batch.messages) {
    if (batch.queue === 'creator-dashboard-fetcher-dlq') await consumeDlqMessage(message, env);
    else await consumeMessage(message, env);
  }
}
