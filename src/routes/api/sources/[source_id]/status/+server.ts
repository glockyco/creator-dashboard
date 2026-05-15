import { error, json } from '@sveltejs/kit';
import { getSource } from '$lib/sources/registry';
import type { FetcherStatus } from '$lib/dashboard/types';
import type { RequestHandler } from './$types';

const emptyStatus: FetcherStatus = {
  last_run_at: null,
  last_success_at: null,
  last_status: null,
  last_error: null,
  consecutive_failures: 0
};

export const GET: RequestHandler = async ({ params, platform }) => {
  const source = getSource(params.source_id);
  if (!source) throw error(404, 'unknown source');
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');

  const status = await platform.env.DB.prepare(
    `SELECT last_run_at, last_success_at, last_status, last_error, consecutive_failures
     FROM fetcher_runs
     WHERE source_id = ?`
  )
    .bind(source.id)
    .first<FetcherStatus>();

  return json(status ?? emptyStatus);
};
