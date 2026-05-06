import { error, json } from '@sveltejs/kit';
import { getSource } from '$lib/sources/registry';
import { getSourceEvents } from '$lib/server/source-detail';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform, url }) => {
  const source = getSource(params.source_id);
  if (!source) throw error(404, 'unknown source');
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');

  const cursorParam = url.searchParams.get('cursor');
  const cursor = cursorParam ? Number(cursorParam) : undefined;
  if (cursorParam && !Number.isFinite(cursor)) throw error(400, 'invalid cursor');

  return json(
    await getSourceEvents(platform.env.DB, source.id, {
      cursor,
      kind: url.searchParams.get('kind') ?? undefined
    })
  );
};
