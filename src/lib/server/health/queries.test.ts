import { describe, expect, it, vi } from 'vitest';
import { getHealthSnapshot } from './queries';

describe('getHealthSnapshot', () => {
  it('reads fetcher runs, recent failures, and alert log', async () => {
    const all = vi
      .fn()
      .mockResolvedValueOnce({ results: [{ source_id: 'source-a', last_status: 'success' }] })
      .mockResolvedValueOnce({ results: [{ source_id: 'source-a', tier: 'permanent' }] })
      .mockResolvedValueOnce({ results: [{ alert_key: 'permanent:source-a:auth_dead' }] });
    const prepare = vi.fn((sql: string) => ({ all }));
    const db = { prepare } as unknown as D1Database;

    await expect(getHealthSnapshot(db)).resolves.toEqual({
      runs: [{ source_id: 'source-a', last_status: 'success' }],
      failures: [{ source_id: 'source-a', tier: 'permanent' }],
      alerts: [{ alert_key: 'permanent:source-a:auth_dead' }]
    });

    expect(prepare).toHaveBeenCalledTimes(3);
    expect(prepare.mock.calls[0][0]).toContain('FROM fetcher_runs');
    expect(prepare.mock.calls[1][0]).toContain('FROM fetcher_failures');
    expect(prepare.mock.calls[2][0]).toContain('FROM alerts_sent');
  });
});
