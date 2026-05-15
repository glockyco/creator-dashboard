import { describe, expect, it, vi } from 'vitest';
import { consumeDlqMessage } from './dlq';

vi.mock('$lib/server/alerts/dedup', () => ({ maybeSendAlert: vi.fn().mockResolvedValue(true) }));

describe('consumeDlqMessage', () => {
  it('records DLQ failure, alerts once, and acks', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const env = { DB: { prepare } } as unknown as Env;
    const msg = { body: { source_id: 'source-a', dispatch_ts: 1, force: false }, ack: vi.fn() } as unknown as Message<{
      source_id: string;
      dispatch_ts: number;
      force: boolean;
    }>;

    await consumeDlqMessage(msg, env, 1714838400000);

    expect(prepare).toHaveBeenCalledWith(
      'INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message) VALUES (?, ?, ?, ?, ?)'
    );
    expect(bind).toHaveBeenCalledWith('source-a', 1714838400000, 'dlq', null, 'Exhausted retries');
    expect(msg.ack).toHaveBeenCalledOnce();
  });
});
