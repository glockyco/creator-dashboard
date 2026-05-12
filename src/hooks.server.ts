import { dev } from '$app/environment';
import { error, type Handle } from '@sveltejs/kit';
import { assertAccessJwt, AuthError } from '$lib/server/auth/access';

export const handle: Handle = async ({ event, resolve }) => {
  // Local Vite dev mode runs entirely on the loopback interface and has
  // no Cloudflare Access in front of it. Skipping the JWT check there
  // lets `pnpm dev` serve the SvelteKit app with HMR; production
  // (the deployed Worker bundle) always takes the validating branch
  // because `dev` is a build-time false constant.
  if (dev) return resolve(event);
  try {
    if (!event.platform?.env) throw error(500, 'Cloudflare platform env missing');
    await assertAccessJwt(event.request, event.platform.env);
    return resolve(event);
  } catch (err) {
    if (err instanceof AuthError) throw error(401, 'Unauthorized');
    throw err;
  }
};
