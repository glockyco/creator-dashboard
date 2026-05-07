import { describe, expect, it, vi } from 'vitest';
import type { MetricPoint } from '../src/lib/types/domain';
import type { SourceDef } from '../src/lib/sources/registry';
import { runGscBackfill } from './backfill-gsc';

vi.mock('../src/lib/connectors/auth/google', () => ({ getGoogleAccessToken: vi.fn(async () => 'google-token') }));

const source = {
  id: 'gsc-glockyco-com',
  identity: 'glockyco',
  name: 'GSC: glockyco.com',
  category: 'analytics',
  cadenceHours: 24,
  fetcher: vi.fn(),
  config: { siteUrl: 'sc-domain:glockyco.com' }
} as unknown as SourceDef;

const env = {
  GOOGLE_SERVICE_ACCOUNT: '{}',
  GSC_PROPERTIES: '["sc-domain:glockyco.com"]',
  BING_WEBMASTER_API_KEY: 'bing-key',
  BING_PROPERTIES: '[]',
  CF_API_TOKEN: 'cf-token',
  CF_ANALYTICS_SITE_TAGS: '{}'
} as Env;

describe('runGscBackfill', () => {
  it('uses the GSC connector date-range helper and writes a dry-run SQL batch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ rows: [{ keys: ['2026-01-02', 'creator dashboard', 'https://glockyco.com/'], clicks: 3, impressions: 30, ctr: 0.1, position: 4 }] }), { status: 200 })));
    const writer = vi.fn<(rows: MetricPoint[], out: string, batchSize?: number) => Promise<string>>().mockResolvedValue('BEGIN;\nINSERT OR IGNORE INTO metric_points ...;\nCOMMIT;\n');

    const result = await runGscBackfill({
      args: ['--dry-run', '--out', '.tmp/backfill-gsc.sql'],
      env,
      sources: [source],
      windows: [{ startDate: '2026-01-01', endDate: '2026-01-31' }],
      writer
    });

    expect(result).toEqual({ out: '.tmp/backfill-gsc.sql', rowCount: 8, sourceCount: 1, executed: false });
    expect(writer).toHaveBeenCalledOnce();
    const [rows, out, batchSize] = writer.mock.calls[0];
    expect(out).toBe('.tmp/backfill-gsc.sql');
    expect(batchSize).toBe(500);
    expect(rows.find((row) => row.metric === 'clicks' && row.dimensions === null)).toMatchObject({ source_id: 'gsc-glockyco-com', ts: Date.parse('2026-01-02T00:00:00.000Z'), value: 3 });
    expect(rows.find((row) => row.metric === 'position' && row.dimensions?.query === 'creator dashboard')).toMatchObject({ value: 4 });
  });
});
