import { error, json } from '@sveltejs/kit';
import { getSource } from '$lib/sources/registry';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, platform }) => {
  const source = getSource(params.source_id);
  if (!source) throw error(404, 'unknown source');
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');

  await platform.env.FETCHER_QUEUE.send({
    source_id: source.id,
    dispatch_ts: Date.now(),
    force: true
  });

  return json({ queued: true });
};
