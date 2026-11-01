import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { env } from 'cloudflare:workers';
import { dev } from '$app/env';
import { assertAccessJwt, AuthError } from '#lib/server/auth/access.js';

export const handle: Handle = async ({ event, resolve }) => {
  // Local Vite dev mode runs entirely on the loopback interface and has
  // no Cloudflare Access in front of it. Skipping the JWT check there
  // lets `pnpm dev` serve the SvelteKit app with HMR; production
  // (the deployed Worker bundle) always takes the validating branch
  // because `dev` is a build-time false constant.
  if (dev) return resolve(event);
  try {
    await assertAccessJwt(event.request, env);
    return resolve(event);
  } catch (err) {
    if (err instanceof AuthError) throw error(401, 'Unauthorized');
    throw err;
  }
};
