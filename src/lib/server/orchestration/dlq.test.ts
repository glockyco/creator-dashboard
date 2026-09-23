import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeDlqMessage } from './dlq';

const mocks = vi.hoisted(() => ({
  recordCollectionFailure: vi.fn(),
  maybeSendFailureAlert: vi.fn()
}));

vi.mock('$lib/sources/registry', () => ({
  getSource: (sourceId: string) => (sourceId === 'source-a' ? { id: sourceId } : undefined)
}));
vi.mock('$lib/server/incidents', () => ({ recordCollectionFailure: mocks.recordCollectionFailure }));
vi.mock('$lib/server/alerts/dedup', () => ({ maybeSendFailureAlert: mocks.maybeSendFailureAlert }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recordCollectionFailure.mockResolvedValue({ id: 9, sourceId: 'source-a' });
  mocks.maybeSendFailureAlert.mockResolvedValue(true);
});

describe('consumeDlqMessage', () => {
  it('records a terminal incident, alerts, and acknowledges the message', async () => {
    const env = { DB: {} } as Env;
    const msg = {
      body: { source_id: 'source-a', dispatch_ts: 1, force: false },
      ack: vi.fn()
    } as unknown as Message<{ source_id: string; dispatch_ts: number; force: boolean }>;

    await consumeDlqMessage(msg, env, 1714838400000);

    expect(mocks.recordCollectionFailure).toHaveBeenCalledWith(env.DB, {
      sourceId: 'source-a',
      ts: 1714838400000,
      tier: 'dlq',
      statusCode: null,
      error: 'Exhausted queue retries',
      nextRetryAt: null
    });
    expect(mocks.maybeSendFailureAlert).toHaveBeenCalledWith(env, { id: 9, sourceId: 'source-a' }, 1714838400000);
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('acknowledges a removed collector without writing an incident', async () => {
    const msg = {
      body: { source_id: 'removed', dispatch_ts: 1, force: false },
      ack: vi.fn()
    } as unknown as Message<{ source_id: string; dispatch_ts: number; force: boolean }>;

    await consumeDlqMessage(msg, { DB: {} } as Env, 1714838400000);

    expect(mocks.recordCollectionFailure).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('acknowledges the message when Discord delivery fails', async () => {
    mocks.maybeSendFailureAlert.mockRejectedValueOnce(new Error('Discord unavailable'));
    const msg = {
      body: { source_id: 'source-a', dispatch_ts: 1, force: false },
      ack: vi.fn()
    } as unknown as Message<{ source_id: string; dispatch_ts: number; force: boolean }>;

    await consumeDlqMessage(msg, { DB: {} } as Env, 1714838400000);

    expect(msg.ack).toHaveBeenCalledOnce();
  });
});
