import { describe, expect, it } from 'vitest';
import { buildWranglerDevArgs, e2eSeedSql, previewSeedSql } from './harness';

describe('local preview harness helpers', () => {
  it('points local Access at the fixture and never at the real Discord webhook', () => {
    const args = buildWranglerDevArgs({
      workerPort: 8788,
      persistPath: '.tmp/e2e-wrangler',
      issuerDomain: 'team.cloudflareaccess.com',
      audience: 'creator-dashboard-e2e',
      jwksUrl: 'http://127.0.0.1:8790/jwks',
      smokeEndpointsEnabled: true
    });
    const vars = args.flatMap((arg, index) => (args[index - 1] === '--var' ? [arg] : []));

    expect(vars).toEqual(
      expect.arrayContaining([
        'ACCESS_TEAM_DOMAIN:team.cloudflareaccess.com',
        'ACCESS_AUD:creator-dashboard-e2e',
        'ACCESS_JWKS_URL:http://127.0.0.1:8790/jwks',
        'DISCORD_ALERTS_WEBHOOK:'
      ])
    );
  });

  it('seeds retained performance and activity rows relative to the current time', () => {
    expect(e2eSeedSql).toContain("'steam-guide-afallon', 'views'");
    expect(e2eSeedSql).toContain("'thunderstore-wowmuch', 'package_downloads'");
    expect(e2eSeedSql).toContain('InteractiveMapCompanion');
    expect(e2eSeedSql).toContain("'erenshor-vault-wowmuch', 'mod_downloads'");
    expect(e2eSeedSql).toContain('interactive-map-companion');
    expect(e2eSeedSql).toContain("'review'");
    expect(e2eSeedSql).toContain("'wiki_edit'");
    expect(e2eSeedSql).not.toContain('posts_index');
    expect(e2eSeedSql).not.toContain('github-glockyco');
  });

  it('adds active and recovered incident examples without real secrets', () => {
    expect(previewSeedSql).toContain('INSERT INTO collection_incidents');
    expect(previewSeedSql).toContain('permanent_failure');
    expect(previewSeedSql).toContain('INSERT INTO fetcher_failures');
    expect(previewSeedSql).toContain("'sent'");
    expect(previewSeedSql).not.toContain('discord.com/api/webhooks');
  });
});
