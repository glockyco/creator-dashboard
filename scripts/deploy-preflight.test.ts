import { describe, expect, it } from 'vitest';
import { deployedSecretErrors, parseDevVars, parseWranglerPreflight } from './deploy-preflight';

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
crons = ["0 * * * *"]
`;
    expect(parseWranglerPreflight(toml).errors).toEqual([]);
  });

  it('flags missing required secrets and unused leftovers on the production Worker', () => {
    expect(
      deployedSecretErrors(['ACCESS_TEAM_DOMAIN', 'DISCORD_ALERTS_WEBHOOK', 'STEAM_WEB_API_KEY', 'GITHUB_TOKEN'])
    ).toEqual([
      'production Worker is missing secret ACCESS_AUD',
      'production Worker holds unused secret GITHUB_TOKEN; delete it and revoke the credential'
    ]);
    expect(
      deployedSecretErrors(['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'DISCORD_ALERTS_WEBHOOK', 'STEAM_WEB_API_KEY'])
    ).toEqual([]);
  });

  it('parses local dev vars without comments or quotes', () => {
    expect(
      parseDevVars(
        'ACCESS_TEAM_DOMAIN="team.cloudflareaccess.com"\n# comment\nACCESS_AUD=aud-value\nSTEAM_WEB_API_KEY=steam-key\n'
      )
    ).toEqual({
      ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
      ACCESS_AUD: 'aud-value',
      STEAM_WEB_API_KEY: 'steam-key'
    });
  });
});
