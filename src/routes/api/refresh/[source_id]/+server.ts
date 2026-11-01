import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { claimManualRetry, releaseManualRetry } from '#lib/server/incidents/index.js';
import { getSource } from '#lib/sources/registry.js';
import type { RequestHandler } from './$types';

type RetryRequest = { incidentId?: unknown };

export const POST: RequestHandler = async ({ params, request }) => {
  const source = getSource(params.source_id);
  if (!source) throw error(404, 'Unknown collector');

  const payload = (await request.json().catch(() => null)) as RetryRequest | null;
  if (!Number.isSafeInteger(payload?.incidentId) || Number(payload?.incidentId) <= 0) {
    throw error(400, 'A valid incident ID is required');
  }
  const incidentId = Number(payload?.incidentId);
  const incident = await env.DB.prepare('SELECT source_id, resolved_at FROM collection_incidents WHERE id = ?')
    .bind(incidentId)
    .first<{ source_id: string; resolved_at: number | null }>();
  if (!incident || incident.source_id !== source.id) throw error(404, 'Unknown incident');
  if (incident.resolved_at !== null) throw error(409, 'This incident has recovered');

  const now = Date.now();
  if (!(await claimManualRetry(env.DB, incidentId, source.id, now))) {
    throw error(409, 'A retry is already queued');
  }

  try {
    await env.FETCHER_QUEUE.send({
      source_id: source.id,
      dispatch_ts: now,
      force: true
    });
  } catch {
    await releaseManualRetry(env.DB, incidentId, now);
    throw error(503, 'The retry could not be queued');
  }

  return Response.json({ queued: true, incidentId }, { status: 202 });
};
