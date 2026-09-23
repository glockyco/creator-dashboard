import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionIncident } from '$lib/server/incidents';
import { maybeSendFailureAlert, maybeSendRecoveryAlert } from './dedup';

const postDiscord = vi.hoisted(() => vi.fn());
vi.mock('./discord', () => ({ postDiscord }));

const incident: CollectionIncident = {
  id: 42,
  sourceId: 'steam-guide-afallon',
  firstFailureAt: 100,
  lastFailureAt: 200,
  latestTier: 'permanent',
  latestStatusCode: 401,
  latestError: 'complete failure text',
  attemptCount: 2,
  lastSuccessAt: 50,
  nextRetryAt: null,
  manualRetryQueuedAt: null,
  resolvedAt: null,
  failureNotificationState: 'not_requested',
  failureNotificationAttemptedAt: null,
  failureNotifiedAt: null,
  recoveryNotificationState: 'not_required',
  recoveryNotificationAttemptedAt: null,
  recoveryNotifiedAt: null
};

function envWithChanges(...changes: number[]) {
  const run = vi.fn();
  for (const value of changes) run.mockResolvedValueOnce({ meta: { changes: value } });
  const prepare = vi.fn((_sql: string) => ({ bind: vi.fn(() => ({ run })) }));
  return {
    env: {
      DB: { prepare },
      DISCORD_ALERTS_WEBHOOK: 'https://discord.invalid/webhook'
    } as unknown as Env,
    prepare,
    run
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  postDiscord.mockResolvedValue(undefined);
});

describe('incident Discord notifications', () => {
  it('claims one failure notification and includes the stable issue link', async () => {
    const { env } = envWithChanges(1, 1);

    await expect(maybeSendFailureAlert(env, incident, 1_000)).resolves.toBe(true);

    expect(postDiscord).toHaveBeenCalledWith(
      env.DISCORD_ALERTS_WEBHOOK,
      expect.stringContaining('https://dashboard.glockyco.com/issues/42')
    );
  });

  it('does not send when another request already claimed the incident', async () => {
    const { env } = envWithChanges(0);

    await expect(maybeSendFailureAlert(env, incident, 1_000)).resolves.toBe(false);

    expect(postDiscord).not.toHaveBeenCalled();
  });

  it('marks a failed webhook attempt without marking the incident delivered', async () => {
    const { env, prepare } = envWithChanges(1, 1);
    postDiscord.mockRejectedValueOnce(new Error('Discord unavailable'));

    await expect(maybeSendFailureAlert(env, incident, 1_000)).rejects.toThrow('Discord unavailable');

    expect(prepare.mock.calls.some(([sql]) => String(sql).includes("failure_notification_state = 'failed'"))).toBe(
      true
    );
  });

  it('sends recovery only after an alerted incident resolves', async () => {
    const { env } = envWithChanges();
    const resolvedWithoutAlert = {
      ...incident,
      resolvedAt: 2_000,
      recoveryNotificationState: 'not_required' as const
    };

    await expect(maybeSendRecoveryAlert(env, resolvedWithoutAlert, 2_000)).resolves.toBe(false);
    expect(postDiscord).not.toHaveBeenCalled();

    const deliveredEnv = envWithChanges(1, 1).env;
    const alertedIncident = {
      ...resolvedWithoutAlert,
      failureNotificationState: 'sent' as const,
      recoveryNotificationState: 'pending' as const
    };
    await expect(maybeSendRecoveryAlert(deliveredEnv, alertedIncident, 2_000)).resolves.toBe(true);
    expect(postDiscord).toHaveBeenCalledWith(
      deliveredEnv.DISCORD_ALERTS_WEBHOOK,
      expect.stringContaining('https://dashboard.glockyco.com/issues/42')
    );
  });
});
