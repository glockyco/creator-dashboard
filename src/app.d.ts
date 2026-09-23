import type { JobMsg } from '$lib/types/orchestration';

declare global {
  namespace App {
    interface Platform {
      env: Env;
      cf?: IncomingRequestCfProperties;
      ctx: ExecutionContext;
    }
  }

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

export {};
