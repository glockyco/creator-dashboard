import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getTimeline } from '$lib/server/timeline';
import { sources } from '$lib/sources/registry';
import { parseTimelineFilters } from '$lib/timeline/schema';

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');

  try {
    const filters = parseTimelineFilters(url.searchParams, { knownSourceIds: sources.map((source) => source.id) });
    return {
      title: 'Timeline',
      filters,
      timeline: await getTimeline(platform.env.DB, filters),
      url: url.toString()
    };
  } catch (cause) {
    throw error(400, cause instanceof Error ? cause.message : 'invalid timeline filters');
  }
};
