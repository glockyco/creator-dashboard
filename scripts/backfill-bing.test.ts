import { describe, expect, it, vi } from 'vitest';
import type { MetricPoint } from '../src/lib/types/domain';
import type { SourceDef } from '../src/lib/sources/registry';
import { runBingBackfill } from './backfill-bing';

const source = {
  id: 'bing-glockyco-com',
  identity: 'glockyco',
  name: 'Bing: glockyco.com',
  category: 'analytics',
  cadenceHours: 24,
  fetcher: vi.fn(),
  config: { siteUrl: 'https://glockyco.com/' }
} as unknown as SourceDef;

const env = {
  GOOGLE_OAUTH_CLIENT_ID: 'cid', GOOGLE_OAUTH_CLIENT_SECRET: 'cs', GOOGLE_OAUTH_REFRESH_TOKEN: 'rt',
  GSC_PROPERTIES: '[]',
  BING_WEBMASTER_API_KEY: 'bing-key',
  BING_PROPERTIES: '["https://glockyco.com/"]',
  CF_API_TOKEN: 'cf-token',
  CF_ACCOUNT_ID: 'acct-test',
  CF_ANALYTICS_SITE_TAGS: '{}'
} as Env;

describe('runBingBackfill', () => {
  it('uses the Bing connector date-range helper and writes a dry-run SQL batch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ QueryStats: [{ Query: 'creator dashboard', Page: 'https://glockyco.com/', Clicks: 2, Impressions: 20, Ctr: 0.1, Position: 9, Date: '2026-01-02T00:00:00Z' }] }), { status: 200 })));
    const writer = vi.fn<(rows: MetricPoint[], out: string, batchSize?: number) => Promise<string>>().mockResolvedValue('BEGIN;\nINSERT OR IGNORE INTO metric_points ...;\nCOMMIT;\n');

    const result = await runBingBackfill({
      args: ['--dry-run', '--out', '.tmp/backfill-bing.sql'],
      env,
      sources: [source],
      windows: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
      writer
    });

    expect(result).toEqual({ out: '.tmp/backfill-bing.sql', rowCount: 8, sourceCount: 1, executed: false });
    const [rows, out, batchSize] = writer.mock.calls[0];
    expect(out).toBe('.tmp/backfill-bing.sql');
    expect(batchSize).toBe(500);
    expect(rows.find((row) => row.metric === 'clicks' && row.dimensions === null)).toMatchObject({ ts: Date.parse('2026-01-02T00:00:00.000Z'), value: 2 });
    expect(rows.find((row) => row.metric === 'position' && row.dimensions?.query === 'creator dashboard')).toMatchObject({ value: 9 });
  });
});
