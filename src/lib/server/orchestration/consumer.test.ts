import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetcherOutput } from '$lib/types/domain';
import { consumeMessage } from './consumer';

const fetcher = vi.fn<() => Promise<FetcherOutput>>();

vi.mock('$lib/sources/registry', () => ({
  getSource: (sourceId: string) =>
    sourceId === 'source-a'
      ? {
          id: 'source-a',
          name: 'Source A',
          identity: 'glockyco',
          category: 'platform',
          cadenceHours: 1,
          fetcher,
          config: {}
        }
      : undefined
}));

vi.mock('$lib/server/alerts/dedup', () => ({
  maybeSendAlert: vi.fn().mockResolvedValue(true)
}));

beforeEach(() => {
  fetcher.mockReset();
});

type FakeMessage = Message<{ source_id: string; dispatch_ts: number; force: boolean }> & {
  ack: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
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
  const allStatements: { sql: string; binds: unknown[] }[] = [];
  const prepare = vi.fn((sql: string) => ({
    bind: (...binds: unknown[]) => {
      allStatements.push({ sql, binds });
      return { first, run: vi.fn().mockResolvedValue(undefined) };
    }
  }));
  return { env: { DB: { prepare, batch } } as unknown as Env, batch, prepare, first, allStatements };
}

describe('consumeMessage', () => {
  it('acks and drops unknown source IDs', async () => {
    const msg = message({ source_id: 'missing', dispatch_ts: 1, force: false });
    const { env } = dbWithRun();

    await consumeMessage(msg, env, 1714838400000);

    expect(msg.ack).toHaveBeenCalledOnce();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it('acks without fetching when cadence gate says source is not due', async () => {
    fetcher.mockReset();
    const msg = message({ source_id: 'source-a', dispatch_ts: 1, force: false });
    const { env } = dbWithRun({ last_run_at: 1714838300000 });

    await consumeMessage(msg, env, 1714838400000);

    expect(fetcher).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('persists successful fetch output atomically and acks', async () => {
    fetcher.mockResolvedValueOnce({ metric_points: [], events: [] });
    const msg = message({ source_id: 'source-a', dispatch_ts: 1, force: true });
    const { env, batch } = dbWithRun(null);

    await consumeMessage(msg, env, 1714838400000);

    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ now: 1714838400000 }));
    expect(batch).toHaveBeenCalledOnce();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('alerts and acks permanent failures', async () => {
    fetcher.mockRejectedValueOnce(new z.ZodError([]));
    const msg = message({ source_id: 'source-a', dispatch_ts: 1, force: true });
    const { env } = dbWithRun(null);

    await consumeMessage(msg, env, 1714838400000);

    expect(msg.ack).toHaveBeenCalledOnce();
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it('retries transient failures with a delay', async () => {
    fetcher.mockRejectedValueOnce(new Error('network'));
    const msg = message({ source_id: 'source-a', dispatch_ts: 1, force: true });
    const { env } = dbWithRun(null);

    await consumeMessage(msg, env, 1714838400000);

    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalledWith({ delaySeconds: 300 });
  });
});
