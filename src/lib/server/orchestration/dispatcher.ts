import { sources } from '$lib/sources/registry';
import type { JobMsg } from '$lib/types/orchestration';
import { log } from '$lib/server/log';

export async function dispatchDueSources(
  env: Env,
  now = Date.now(),
  options: { sourceIds?: string[] } = {}
): Promise<number> {
  const allowed = options.sourceIds ? new Set(options.sourceIds) : null;
  const dueSources = allowed ? sources.filter((source) => allowed.has(source.id)) : sources;
  const messages = dueSources.map((source) => ({
    body: { source_id: source.id, dispatch_ts: now, force: false } satisfies JobMsg
  }));
  if (messages.length > 0) await env.FETCHER_QUEUE.sendBatch(messages);
  log('info', 'dispatched source jobs', { enqueued: messages.length });
  return messages.length;
}
