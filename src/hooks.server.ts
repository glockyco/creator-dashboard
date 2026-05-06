import { error, type Handle } from '@sveltejs/kit';
import { assertAccessJwt, AuthError } from '$lib/server/auth/access';

export const handle: Handle = async ({ event, resolve }) => {
  try {
    if (!event.platform?.env) throw error(500, 'Cloudflare platform env missing');
    await assertAccessJwt(event.request, event.platform.env);
    return resolve(event);
  } catch (err) {
    if (err instanceof AuthError) throw error(401, 'Unauthorized');
    throw err;
  }
};
