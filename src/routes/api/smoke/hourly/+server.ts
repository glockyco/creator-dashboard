import { error, json } from '@sveltejs/kit';
import { dispatchDueSources } from '$lib/server/orchestration/dispatcher';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ platform, request }) => {
  const env = platform?.env;
  if (!env || env.SMOKE_ENDPOINTS_ENABLED !== 'true') throw error(404, 'not found');
  const body = (await request.json().catch(() => ({}))) as { sourceId?: string };
  if (!body.sourceId) throw error(400, 'sourceId required');
  const enqueued = await dispatchDueSources(env, Date.now(), { sourceIds: [body.sourceId] });
  return json({ enqueued });
};
