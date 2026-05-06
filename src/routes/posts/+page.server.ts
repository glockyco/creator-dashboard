import { error } from '@sveltejs/kit';
import { listPosts } from '$lib/server/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');

  const filters = {
    author: url.searchParams.get('author') ?? undefined,
    tag: url.searchParams.get('tag') ?? undefined,
    related_source: url.searchParams.get('related_source') ?? undefined
  };

  return {
    posts: await listPosts(platform.env.DB, filters),
    filters,
    url: url.toString()
  };
};
