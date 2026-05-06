import { error } from '@sveltejs/kit';
import { loadPosts } from '$lib/posts/loader';
import { getPost, getPostPerformance } from '$lib/server/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');

  const indexed = await getPost(platform.env.DB, params.slug);
  const bodyPost = loadPosts().find((post) => post.slug === params.slug);
  if (!indexed || !bodyPost) throw error(404, 'unknown post');

  return {
    post: indexed,
    body: bodyPost.body,
    performance: await getPostPerformance(platform.env.DB, params.slug)
  };
};
