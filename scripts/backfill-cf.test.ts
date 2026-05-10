import { describe, expect, it, vi } from 'vitest';
import type { MetricPoint } from '../src/lib/types/domain';
import type { SourceDef } from '../src/lib/sources/registry';
import { runCfBackfill } from './backfill-cf';

const source = {
  id: 'cf-analytics-glockyco-com',
  identity: 'glockyco',
  name: 'Cloudflare Analytics: glockyco.com',
  category: 'analytics',
  cadenceHours: 24,
  fetcher: vi.fn(),
  config: {}
} as unknown as SourceDef;

const env = {
  GOOGLE_OAUTH_CLIENT_ID: 'cid', GOOGLE_OAUTH_CLIENT_SECRET: 'cs', GOOGLE_OAUTH_REFRESH_TOKEN: 'rt',
  GSC_PROPERTIES: '[]',
  BING_WEBMASTER_API_KEY: 'bing-key',
  BING_PROPERTIES: '[]',
  CF_API_TOKEN: 'cf-token',
  CF_ACCOUNT_ID: 'acct-test',
  CF_ANALYTICS_SITE_TAGS: '{"cf-analytics-glockyco-com":"site-tag"}'
} as Env;

describe('runCfBackfill', () => {
  it('uses the Cloudflare connector date-range helper and writes a dry-run SQL batch', async () => {
    const fixture = { data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [{ dimensions: { date: '2026-01-02' }, sum: { visits: 11 }, count: 17 }] }] } } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 })));
    const writer = vi.fn<(rows: MetricPoint[], out: string, batchSize?: number) => Promise<string>>().mockResolvedValue('BEGIN;\nINSERT OR IGNORE INTO metric_points ...;\nCOMMIT;\n');

    const result = await runCfBackfill({
      args: ['--dry-run', '--out', '.tmp/backfill-cf.sql'],
      env,
      sources: [source],
      windows: [{ startDate: '2026-01-01', endDate: '2026-01-02' }],
      writer
    });

    expect(result).toEqual({ out: '.tmp/backfill-cf.sql', rowCount: 2, sourceCount: 1, executed: false });
    const [rows, out, batchSize] = writer.mock.calls[0];
    expect(out).toBe('.tmp/backfill-cf.sql');
    expect(batchSize).toBe(500);
    expect(rows.map((row) => [row.metric, row.value, row.ts])).toEqual([
      ['visits', 11, Date.parse('2026-01-02T00:00:00.000Z')],
      ['pageviews', 17, Date.parse('2026-01-02T00:00:00.000Z')]
    ]);
  });
});
