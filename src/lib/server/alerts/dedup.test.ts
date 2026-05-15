import { describe, expect, it, vi } from 'vitest';
import { maybeSendAlert } from './dedup';

vi.mock('./discord', () => ({ postDiscord: vi.fn().mockResolvedValue(undefined) }));

function envWithExisting(existing: { sent_at: number } | null = null) {
  const first = vi.fn().mockResolvedValue(existing);
  const run = vi.fn().mockResolvedValue(undefined);
  const prepare = vi.fn((_sql: string) => ({ bind: vi.fn(() => ({ first, run })) }));
  return { env: { DB: { prepare }, DISCORD_ALERTS_WEBHOOK: 'https://discord.invalid/webhook' } as unknown as Env, run };
}

describe('maybeSendAlert', () => {
  it('suppresses duplicate alerts for 24 hours', async () => {
    const { env, run } = envWithExisting({ sent_at: 1000 });
    await expect(maybeSendAlert(env, 'source-a', 'permanent', 'auth_dead', 'bad', 1000 + 60_000)).resolves.toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('records and sends a new alert after dedupe window', async () => {
    const { env, run } = envWithExisting(null);
    await expect(maybeSendAlert(env, 'source-a', 'permanent', 'auth_dead', 'bad', 1000)).resolves.toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });
});
