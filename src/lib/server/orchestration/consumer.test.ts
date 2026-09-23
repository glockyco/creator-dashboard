import { z } from 'zod';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { FetcherOutput } from '$lib/types/domain';
import type { CollectionIncident } from '$lib/server/incidents';
import { consumeMessage } from './consumer';

const mocks = vi.hoisted(() => ({
  fetcher: vi.fn<() => Promise<FetcherOutput>>(),
  getActiveIncident: vi.fn(),
  prepareIncidentResolution: vi.fn(() => ({ resolution: true })),
  recordCollectionFailure: vi.fn(),
  maybeSendFailureAlert: vi.fn(),
  maybeSendRecoveryAlert: vi.fn()
}));

vi.mock('$lib/sources/registry', () => ({
  getSource: (sourceId: string) =>
    sourceId === 'source-a'
      ? {
          id: 'source-a',
          name: 'Source A',
          identity: 'glockyco',
          category: 'platform',
          cadenceHours: 1,
          fetcher: mocks.fetcher,
          config: {}
        }
      : undefined
}));

vi.mock('$lib/server/incidents', () => ({
  getActiveIncident: mocks.getActiveIncident,
  prepareIncidentResolution: mocks.prepareIncidentResolution,
  recordCollectionFailure: mocks.recordCollectionFailure
}));

vi.mock('$lib/server/alerts/dedup', () => ({
  maybeSendFailureAlert: mocks.maybeSendFailureAlert,
  maybeSendRecoveryAlert: mocks.maybeSendRecoveryAlert
}));

const incident: CollectionIncident = {
  id: 12,
  sourceId: 'source-a',
  firstFailureAt: 100,
  lastFailureAt: 200,
  latestTier: 'permanent',
  latestStatusCode: 401,
  latestError: 'bad token',
  attemptCount: 2,
  lastSuccessAt: 50,
  nextRetryAt: null,
  manualRetryQueuedAt: null,
  resolvedAt: null,
  failureNotificationState: 'sent',
  failureNotificationAttemptedAt: 200,
  failureNotifiedAt: 200,
  recoveryNotificationState: 'not_required',
  recoveryNotificationAttemptedAt: null,
  recoveryNotifiedAt: null
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveIncident.mockResolvedValue(null);
  mocks.recordCollectionFailure.mockResolvedValue(incident);
  mocks.maybeSendFailureAlert.mockResolvedValue(true);
  mocks.maybeSendRecoveryAlert.mockResolvedValue(true);
});

type FakeMessage = Message<{ source_id: string; dispatch_ts: number; force: boolean }> & {
  ack: Mock;
  retry: Mock;
};

function message(body: { source_id: string; dispatch_ts: number; force: boolean }): FakeMessage {
  return {
    body,
    ack: vi.fn(),
    retry: vi.fn(),
    id: 'msg-1',
    timestamp: new Date(),
    attempts: 1
  } as unknown as FakeMessage;
}

function dbWithRun(run: { last_run_at: number } | null = null) {
  const batch = vi.fn().mockResolvedValue(undefined);
  const first = vi.fn().mockResolvedValue(run);
  const prepare = vi.fn((_sql: string) => ({
    bind: vi.fn(() => ({ first, run: vi.fn().mockResolvedValue(undefined) }))
  }));
  return { env: { DB: { prepare, batch } } as unknown as Env, batch, prepare };
}

describe('consumeMessage', () => {
  it('acks unknown source IDs without database writes', async () => {
    const msg = message({ source_id: 'missing', dispatch_ts: 1, force: false });
    const { env, prepare, batch } = dbWithRun();

    await consumeMessage(msg, env, 1714838400000);

    expect(prepare).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('acks without fetching when cadence gate says the source is not due', async () => {
    const msg = message({ source_id: 'source-a', dispatch_ts: 1, force: false });
    const { env } = dbWithRun({ last_run_at: 1714838300000 });

    await consumeMessage(msg, env, 1714838400000);

    expect(mocks.fetcher).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('persists output and resolves an active incident in the success batch', async () => {
    mocks.fetcher.mockResolvedValueOnce({ metric_points: [], events: [] });
    mocks.getActiveIncident.mockResolvedValueOnce(incident);
    const msg = message({ source_id: 'source-a', dispatch_ts: 1, force: true });
    const { env, batch } = dbWithRun();

    await consumeMessage(msg, env, 1714838400000);

    expect(mocks.prepareIncidentResolution).toHaveBeenCalledWith(env.DB, 12, 1714838400000);
    expect(batch).toHaveBeenCalledOnce();
    expect(mocks.maybeSendRecoveryAlert).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ id: 12, resolvedAt: 1714838400000, recoveryNotificationState: 'pending' }),
      1714838400000
    );
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('keeps a successful collection successful when Discord recovery fails', async () => {
    mocks.fetcher.mockResolvedValueOnce({ metric_points: [], events: [] });
    mocks.getActiveIncident.mockResolvedValueOnce(incident);
    mocks.maybeSendRecoveryAlert.mockRejectedValueOnce(new Error('Discord unavailable'));
    const msg = message({ source_id: 'source-a', dispatch_ts: 1, force: true });
    const { env } = dbWithRun();

    await consumeMessage(msg, env, 1714838400000);

    expect(mocks.recordCollectionFailure).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledOnce();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it('records, alerts, and acknowledges a permanent failure', async () => {
    mocks.fetcher.mockRejectedValueOnce(new z.ZodError([]));
    const msg = message({ source_id: 'source-a', dispatch_ts: 1, force: true });
    const { env } = dbWithRun();

    await consumeMessage(msg, env, 1714838400000);

    expect(mocks.recordCollectionFailure).toHaveBeenCalledWith(
      env.DB,
      expect.objectContaining({ sourceId: 'source-a', tier: 'permanent', nextRetryAt: null })
    );
    expect(mocks.maybeSendFailureAlert).toHaveBeenCalledWith(env, incident, 1714838400000);
    expect(msg.ack).toHaveBeenCalledOnce();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it('records the real retry time for a transient failure', async () => {
    mocks.fetcher.mockRejectedValueOnce(new Error('network'));
    const msg = message({ source_id: 'source-a', dispatch_ts: 1, force: true });
    const { env } = dbWithRun();

    await consumeMessage(msg, env, 1714838400000);

    expect(mocks.recordCollectionFailure).toHaveBeenCalledWith(
      env.DB,
      expect.objectContaining({ nextRetryAt: 1714838700000, tier: 'transient' })
    );
    expect(msg.retry).toHaveBeenCalledWith({ delaySeconds: 300 });
  });
});
