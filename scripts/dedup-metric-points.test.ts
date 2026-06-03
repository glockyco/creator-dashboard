import { describe, expect, it, vi } from 'vitest';
import { dedupBatchSql, parseDedupArgs, runDedup } from './dedup-metric-points';

describe('parseDedupArgs', () => {
  it('selects the remote target with a default batch size', () => {
    expect(parseDedupArgs(['--remote'])).toEqual({ target: 'remote', batchSize: 2000 });
  });

  it('selects local and a custom batch size, skipping a forwarded --', () => {
    expect(parseDedupArgs(['--', '--local', '--batch-size', '500'])).toEqual({ target: 'local', batchSize: 500 });
  });

  it('requires a target', () => {
    expect(() => parseDedupArgs([])).toThrow('--remote or --local');
  });

  it('rejects a non-positive batch size', () => {
    expect(() => parseDedupArgs(['--remote', '--batch-size', '0'])).toThrow('positive integer');
  });
});

describe('dedupBatchSql', () => {
  it('deletes non-latest rows per logical key in bounded batches', () => {
    const sql = dedupBatchSql(2000);
    expect(sql).toContain('DELETE FROM metric_points');
    expect(sql).toContain("COALESCE(m2.dimensions, '') = COALESCE(m.dimensions, '')");
    expect(sql).toContain('MAX(rowid)');
    expect(sql).toContain('LIMIT 2000');
  });
});

describe('runDedup', () => {
  it('loops until a batch deletes nothing and returns the total removed', () => {
    const executor = vi
      .fn<(sql: string) => number>()
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(137)
      .mockReturnValueOnce(0);

    const total = runDedup(executor, 2000, () => {});

    expect(total).toBe(4137);
    expect(executor).toHaveBeenCalledTimes(4);
  });
});
