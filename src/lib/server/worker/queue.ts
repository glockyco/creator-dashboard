import type { JobMsg } from '$lib/types/orchestration';

export async function queue(batch: MessageBatch<JobMsg>, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log(JSON.stringify({ level: 'info', message: 'queue handler reached', queue: batch.queue, messages: batch.messages.length, ts: new Date().toISOString() }));
  batch.ackAll();
}
