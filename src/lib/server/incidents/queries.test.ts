import { describe, expect, it, vi } from 'vitest';
import type { IncidentRow } from './model';
import { getIssues, getIssueSummary } from './queries';

vi.mock('$lib/sources/registry', () => ({
  sources: ['retrying', 'failed', 'never', 'stale', 'healthy', 'recovered'].map((id) => ({
    id,
    name: id.toUpperCase(),
    cadenceHours: 1
  }))
}));

const now = 20_000_000;

function incidentRow(id: number, sourceId: string, values: Partial<IncidentRow> = {}): IncidentRow {
  return {
    id,
    source_id: sourceId,
    first_failure_at: now - 2_000,
    last_failure_at: now - 1_000,
    latest_tier: 'transient',
    latest_status_code: 503,
    latest_error: `${sourceId} error`,
    attempt_count: 1,
    last_success_at: now - 5_000,
    next_retry_at: null,
    manual_retry_queued_at: null,
    resolved_at: null,
    failure_notification_state: 'not_requested',
    failure_notification_attempted_at: null,
    failure_notified_at: null,
    recovery_notification_state: 'not_required',
    recovery_notification_attempted_at: null,
    recovery_notified_at: null,
    ...values
  };
}

describe('getIssues', () => {
  it('keeps never-run, stale, healthy, retrying, failed, and recovered states distinct', async () => {
    const active = [
      incidentRow(1, 'retrying', { next_retry_at: now + 60_000 }),
      incidentRow(2, 'failed', { latest_tier: 'permanent' })
    ];
    const recovered = incidentRow(3, 'recovered', {
      resolved_at: now - 1_000,
      recovery_notification_state: 'sent'
    });
    const runs = [
      {
        source_id: 'retrying',
        last_run_at: now - 1_000,
        last_success_at: now - 5_000,
        last_status: 'transient_failure',
        last_error: 'retrying error',
        consecutive_failures: 1
      },
      {
        source_id: 'failed',
        last_run_at: now - 1_000,
        last_success_at: now - 5_000,
        last_status: 'permanent_failure',
        last_error: 'failed error',
        consecutive_failures: 1
      },
      {
        source_id: 'stale',
        last_run_at: now - 10_800_000,
        last_success_at: now - 10_800_000,
        last_status: 'success',
        last_error: null,
        consecutive_failures: 0
      },
      {
        source_id: 'healthy',
        last_run_at: now - 3_600_000,
        last_success_at: now - 3_600_000,
        last_status: 'success',
        last_error: null,
        consecutive_failures: 0
      },
      {
        source_id: 'recovered',
        last_run_at: now - 1_000,
        last_success_at: now - 1_000,
        last_status: 'success',
        last_error: null,
        consecutive_failures: 0
      }
    ];
    const prepare = vi.fn((sql: string) => ({
      all: vi.fn().mockResolvedValue({
        results: sql.includes('WHERE resolved_at IS NULL')
          ? active
          : sql.includes('WHERE resolved_at IS NOT NULL')
            ? [recovered]
            : sql.includes('FROM collection_incidents AS incident')
              ? [recovered]
              : runs
      })
    }));

    const result = await getIssues({ prepare } as unknown as D1Database, now);

    expect(Object.fromEntries(result.collectors.map((collector) => [collector.sourceId, collector.state]))).toEqual({
      retrying: 'retrying',
      failed: 'failed',
      never: 'never-run',
      stale: 'stale',
      healthy: 'healthy',
      recovered: 'recovered'
    });
    expect(result.activeIssues.map((issue) => ({ id: issue.id, state: issue.state }))).toEqual([
      { id: 1, state: 'retrying' },
      { id: 2, state: 'failed' }
    ]);
  });

  it('returns stable numeric IDs for active retained incidents', async () => {
    const prepare = vi.fn((sql: string) => ({
      all: vi.fn().mockResolvedValue({
        results: sql.includes('FROM collection_incidents')
          ? [
              { id: 17, source_id: 'failed' },
              { id: 18, source_id: 'retired' }
            ]
          : [
              { source_id: 'healthy', last_success_at: now - 2_000 },
              { source_id: 'retired', last_success_at: now }
            ]
      })
    }));

    await expect(getIssueSummary({ prepare } as unknown as D1Database, now)).resolves.toEqual({
      activeCount: 1,
      issues: [{ id: 17, sourceId: 'failed', name: 'FAILED' }],
      latestSuccessAt: now - 2_000
    });
  });
});
