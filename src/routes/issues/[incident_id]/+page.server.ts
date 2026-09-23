import { error } from '@sveltejs/kit';
import { getIssue, MANUAL_RETRY_GUARD_MS } from '$lib/server/incidents';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');
  const incidentId = Number(params.incident_id);
  if (!Number.isSafeInteger(incidentId) || incidentId <= 0) throw error(404, 'Unknown issue');

  const now = Date.now();
  const issue = await getIssue(platform.env.DB, incidentId, now);
  if (!issue) throw error(404, 'Unknown issue');
  const retryQueued =
    issue.incident.manualRetryQueuedAt !== null && now - issue.incident.manualRetryQueuedAt < MANUAL_RETRY_GUARD_MS;
  return { ...issue, now, retryQueued };
};
