import type { JobMsg } from '#lib/types/orchestration.js';

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      FETCHER_QUEUE: Queue<JobMsg>;
      STEAM_WEB_API_KEY: string;
      DISCORD_ALERTS_WEBHOOK: string;
      ACCESS_TEAM_DOMAIN: string;
      ACCESS_AUD: string;
      ACCESS_JWKS_URL?: string;
      SMOKE_ENDPOINTS_ENABLED?: string;
    }
  }

  // Routes import these bindings from `cloudflare:workers`, and the worker's
  // queue and scheduled handlers receive them as their `env` argument.
  type Env = Cloudflare.Env;
}

export {};
