import { describe, expect, it } from 'vitest';
import {
  missingProductionSecrets,
  parseDevVars,
  parseWranglerPreflight,
  requiredProductionSecrets
} from './deploy-preflight';

describe('deploy preflight', () => {
  it('rejects the placeholder D1 database id', () => {
    const result = parseWranglerPreflight(
      'database_id = "<replace with wrangler d1 create creator-dashboard database_id>"'
    );
    expect(result.errors).toContain('wrangler.toml still contains the placeholder D1 database_id');
  });

  it('requires D1, queue, DLQ, and cron bindings', () => {
    const toml = `
[[d1_databases]]
binding = "DB"
database_id = "11111111-1111-1111-1111-111111111111"
[[queues.producers]]
binding = "FETCHER_QUEUE"
queue = "creator-dashboard-fetchers"
[[queues.consumers]]
queue = "creator-dashboard-fetchers"
dead_letter_queue = "creator-dashboard-fetcher-dlq"
[[queues.consumers]]
queue = "creator-dashboard-fetcher-dlq"
[triggers]
crons = ["0 * * * *", "0 4,5 * * *"]
`;
    expect(parseWranglerPreflight(toml).errors).toEqual([]);
  });

  it('documents all production secrets including GA4', () => {
    expect(requiredProductionSecrets()).toEqual([
      'ACCESS_TEAM_DOMAIN',
      'ACCESS_AUD',
      'DISCORD_ALERTS_WEBHOOK',
      'DISCORD_DIGEST_WEBHOOK',
      'GITHUB_PAT',
      'STEAM_WEB_API_KEY',
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_REFRESH_TOKEN',
      'GSC_PROPERTIES',
      'BING_WEBMASTER_API_KEY',
      'BING_PROPERTIES',
      'CF_API_TOKEN',
      'GA4_PROPERTY_ID',
      'CF_ACCOUNT_ID',
      'CF_ANALYTICS_SITE_TAGS'
    ]);
  });

  it('accepts production secrets from a parsed env source', () => {
    const source = Object.fromEntries(requiredProductionSecrets().map((name) => [name, 'set']));

    expect(missingProductionSecrets(source)).toEqual([]);
  });

  it('treats blank and placeholder production secrets as missing', () => {
    const source = {
      ...Object.fromEntries(requiredProductionSecrets().map((name) => [name, 'set'])),
      ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com',
      ACCESS_AUD: 'replace-with-access-application-aud',
      DISCORD_ALERTS_WEBHOOK: 'https://discord.com/api/webhooks/example/alerts',
      DISCORD_DIGEST_WEBHOOK: ''
    };

    expect(missingProductionSecrets(source)).toEqual([
      'ACCESS_TEAM_DOMAIN',
      'ACCESS_AUD',
      'DISCORD_ALERTS_WEBHOOK',
      'DISCORD_DIGEST_WEBHOOK'
    ]);
  });

  it('parses local dev vars for deploy preflight without comments or quotes', () => {
    expect(
      parseDevVars(
        'ACCESS_TEAM_DOMAIN="team.cloudflareaccess.com"\n# comment\nACCESS_AUD=aud-value\nDISCORD_DIGEST_WEBHOOK=https://discord.com/api/webhooks/id/token\n'
      )
    ).toEqual({
      ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
      ACCESS_AUD: 'aud-value',
      DISCORD_DIGEST_WEBHOOK: 'https://discord.com/api/webhooks/id/token'
    });
  });
});
