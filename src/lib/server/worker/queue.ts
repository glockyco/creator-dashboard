import type { JobMsg } from '$lib/types/orchestration';
import { consumeDlqMessage } from '$lib/server/orchestration/dlq';
import { consumeMessage } from '$lib/server/orchestration/consumer';

export async function queue(batch: MessageBatch<JobMsg>, env: Env, ctx: ExecutionContext): Promise<void> {
  for (const message of batch.messages) {
    if (batch.queue === 'creator-dashboard-fetcher-dlq') await consumeDlqMessage(message, env);
    else await consumeMessage(message, env);
  }
}
