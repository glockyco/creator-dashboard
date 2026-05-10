import { describe, expect, it, vi } from 'vitest';
import type { MetricPoint } from '../src/lib/types/domain';
import type { SourceDef } from '../src/lib/sources/registry';
import { runGa4Backfill } from './backfill-ga4';

vi.mock('../src/lib/connectors/auth/google', () => ({ getGoogleOAuthAccessToken: vi.fn(async () => 'google-token') }));

const source = {
  id: 'ga4-glockyco-com',
  identity: 'glockyco',
  name: 'GA4: glockyco.com',
  category: 'analytics',
  cadenceHours: 24,
  fetcher: vi.fn(),
  config: {}
} as unknown as SourceDef;

const env = {
  GOOGLE_OAUTH_CLIENT_ID: 'cid', GOOGLE_OAUTH_CLIENT_SECRET: 'cs', GOOGLE_OAUTH_REFRESH_TOKEN: 'rt',
  GSC_PROPERTIES: '[]',
  GA4_PROPERTY_ID: '123456789',
  BING_WEBMASTER_API_KEY: 'bing-key',
  BING_PROPERTIES: '[]',
  CF_API_TOKEN: 'cf-token',
  CF_ACCOUNT_ID: 'acct-test',
  CF_ANALYTICS_SITE_TAGS: '{}'
} as Env;

describe('runGa4Backfill', () => {
  it('uses the GA4 connector date-range helper and writes a dry-run SQL batch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ rows: [{ dimensionValues: [{ value: '20260102' }], metricValues: [{ value: '5' }, { value: '6' }, { value: '7' }, { value: '8' }] }] }), { status: 200 })));
    const writer = vi.fn<(rows: MetricPoint[], out: string, batchSize?: number) => Promise<string>>().mockResolvedValue('BEGIN;\nINSERT OR IGNORE INTO metric_points ...;\nCOMMIT;\n');

    const result = await runGa4Backfill({
      args: ['--dry-run', '--out', '.tmp/backfill-ga4.sql'],
      env,
      sources: [source],
      windows: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
      writer
    });

    expect(result).toEqual({ out: '.tmp/backfill-ga4.sql', rowCount: 4, sourceCount: 1, executed: false });
    const [rows, out, batchSize] = writer.mock.calls[0];
    expect(out).toBe('.tmp/backfill-ga4.sql');
    expect(batchSize).toBe(500);
    expect(rows.map((row) => [row.metric, row.value, row.ts])).toEqual([
      ['active_users', 5, Date.parse('2026-01-02T00:00:00.000Z')],
      ['sessions', 6, Date.parse('2026-01-02T00:00:00.000Z')],
      ['views', 7, Date.parse('2026-01-02T00:00:00.000Z')],
      ['event_count', 8, Date.parse('2026-01-02T00:00:00.000Z')]
    ]);
  });
});
