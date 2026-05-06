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
    GITHUB_PAT: string;
    STEAM_WEB_API_KEY: string;
    GOOGLE_SERVICE_ACCOUNT: string;
    GSC_PROPERTIES: string;
    GA4_PROPERTY_ID: string;
    BING_WEBMASTER_API_KEY: string;
    BING_PROPERTIES: string;
    CF_API_TOKEN: string;
    CF_ANALYTICS_SITE_TAGS: string;
    DISCORD_DIGEST_WEBHOOK: string;
    DISCORD_ALERTS_WEBHOOK: string;
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD: string;
    ACCESS_JWKS_URL?: string;
  }
}

export {};
