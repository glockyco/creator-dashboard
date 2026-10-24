import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeDlqMessage } from './dlq';

const mocks = vi.hoisted(() => ({
  markRetriesExhausted: vi.fn(),
  maybeSendFailureAlert: vi.fn()
}));

vi.mock('$lib/sources/registry', () => ({
  getSource: (sourceId: string) => (sourceId === 'source-a' ? { id: sourceId } : undefined)
}));
vi.mock('$lib/server/incidents', () => ({ markRetriesExhausted: mocks.markRetriesExhausted }));
vi.mock('$lib/server/alerts/dedup', () => ({ maybeSendFailureAlert: mocks.maybeSendFailureAlert }));

const exhausted = { id: 9, sourceId: 'source-a', latestError: 'invalid JSON response', latestStatusCode: 200 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markRetriesExhausted.mockResolvedValue(exhausted);
  mocks.maybeSendFailureAlert.mockResolvedValue(true);
});

describe('consumeDlqMessage', () => {
  it('alerts with the incident that still carries the real failure', async () => {
    const env = { DB: {} } as Env;
    const msg = {
      body: { source_id: 'source-a', dispatch_ts: 1, force: false },
      ack: vi.fn()
    } as unknown as Message<{ source_id: string; dispatch_ts: number; force: boolean }>;

    await consumeDlqMessage(msg, env, 1714838400000);

    expect(mocks.markRetriesExhausted).toHaveBeenCalledWith(env.DB, 'source-a');
    expect(mocks.maybeSendFailureAlert).toHaveBeenCalledWith(env, exhausted, 1714838400000);
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('does not alert when a later collection already resolved the incident', async () => {
    mocks.markRetriesExhausted.mockResolvedValueOnce(null);
    const msg = {
      body: { source_id: 'source-a', dispatch_ts: 1, force: false },
      ack: vi.fn()
    } as unknown as Message<{ source_id: string; dispatch_ts: number; force: boolean }>;

    await consumeDlqMessage(msg, { DB: {} } as Env, 1714838400000);

    expect(mocks.maybeSendFailureAlert).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('acknowledges a removed collector without writing an incident', async () => {
    const msg = {
      body: { source_id: 'removed', dispatch_ts: 1, force: false },
      ack: vi.fn()
    } as unknown as Message<{ source_id: string; dispatch_ts: number; force: boolean }>;

    await consumeDlqMessage(msg, { DB: {} } as Env, 1714838400000);

    expect(mocks.markRetriesExhausted).not.toHaveBeenCalled();
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
