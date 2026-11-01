import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { dispatchDueSources } from '#lib/server/orchestration/dispatcher.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  if (env.SMOKE_ENDPOINTS_ENABLED !== 'true') throw error(404, 'not found');
  const body = (await request.json().catch(() => ({}))) as { sourceId?: string };
  if (!body.sourceId) throw error(400, 'sourceId required');
  const enqueued = await dispatchDueSources(env, Date.now(), { sourceIds: [body.sourceId] });
  return Response.json({ enqueued });
};
