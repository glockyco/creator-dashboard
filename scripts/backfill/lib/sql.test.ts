import { describe, expect, it } from 'vitest';
import { metricInsertSql, transaction } from './sql';
import type { MetricPoint } from '../../../src/lib/types/domain';

const rows: MetricPoint[] = [
  { source_id: 'gsc-glockyco-com', metric: 'clicks', ts: 1777593600000, value: 12, dimensions: null },
  { source_id: "bing-o'hare", metric: 'impressions', ts: 1777593600000, value: 120, dimensions: { query: "johann's site", page: 'https://example.invalid/a' } }
];

describe('metricInsertSql', () => {
  it('generates escaped INSERT OR IGNORE metric statements', () => {
    const sql = metricInsertSql(rows);

    expect(sql).toContain('INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions)');
    expect(sql).toContain("('gsc-glockyco-com', 'clicks', 1777593600000, 12, NULL)");
    expect(sql).toContain("('bing-o''hare', 'impressions', 1777593600000, 120, '{\"query\":\"johann''s site\",\"page\":\"https://example.invalid/a\"}')");
    expect(sql).not.toContain('undefined');
  });

  it('returns an empty string for empty batches', () => {
    expect(metricInsertSql([])).toBe('');
  });
});

describe('transaction', () => {
  it('wraps non-empty chunks in a transaction', () => {
    expect(transaction(['INSERT one;', '', 'INSERT two;'])).toBe('BEGIN;\nINSERT one;\nINSERT two;\nCOMMIT;\n');
  });
});
