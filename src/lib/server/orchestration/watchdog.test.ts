import { beforeEach, describe, expect, it, vi } from 'vitest';
import { d1Fixture } from '$lib/server/db/test-d1';
import { ESCALATE_AFTER_MS, runWatchdog } from './watchdog';

const discord = vi.hoisted(() => ({ postDiscord: vi.fn() }));
vi.mock('$lib/server/alerts/discord', () => discord);

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

beforeEach(() => {
  discord.postDiscord.mockReset();
  discord.postDiscord.mockResolvedValue(undefined);
});

function setup(sql: string) {
  const { sqlite, d1 } = d1Fixture();
  sqlite.exec(sql);
  const env = { DB: d1, DISCORD_ALERTS_WEBHOOK: 'https://discord.invalid/hook' } as unknown as Env;
  const incident = (sourceId: string) =>
    sqlite
      .prepare(
        `SELECT latest_tier, latest_error, failure_notification_state, recovery_notification_state
         FROM collection_incidents WHERE source_id = ? ORDER BY id DESC LIMIT 1`
      )
      .get(sourceId);
  return { env, incident };
}

function openIncident(sourceId: string, firstFailureAt: number, state = 'not_requested'): string {
  return `INSERT INTO collection_incidents (source_id, first_failure_at, last_failure_at, latest_tier, latest_error,
            attempt_count, failure_notification_state, failure_notification_attempted_at)
          VALUES ('${sourceId}', ${firstFailureAt}, ${NOW - HOUR}, 'transient', 'error code: 502', 4, '${state}', ${NOW - HOUR});`;
}

describe('runWatchdog', () => {
  it('alerts an incident that stayed open past the escalation window, but not a younger one', async () => {
    const { env, incident } = setup(
      openIncident('erenshor-wiki-recent', NOW - ESCALATE_AFTER_MS) + openIncident('steam-guide-ak', NOW - HOUR)
    );

    await runWatchdog(env, NOW);

    expect(discord.postDiscord).toHaveBeenCalledOnce();
    expect(discord.postDiscord.mock.calls[0][1]).toContain('erenshor-wiki-recent');
    expect(discord.postDiscord.mock.calls[0][1]).toContain('error code: 502');
    expect(incident('erenshor-wiki-recent')).toMatchObject({ failure_notification_state: 'sent' });
    expect(incident('steam-guide-ak')).toMatchObject({ failure_notification_state: 'not_requested' });
  });

  it('resends a failure notification that was interrupted mid-send', async () => {
    const { env, incident } = setup(openIncident('steam-guide-ak', NOW - HOUR, 'sending'));

    await runWatchdog(env, NOW);

    expect(incident('steam-guide-ak')).toMatchObject({ failure_notification_state: 'sent' });
  });

  it('opens and alerts a stale incident for a collector that stopped succeeding without failing', async () => {
    const { env, incident } = setup(`
      INSERT INTO fetcher_runs (source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures)
      VALUES ('thunderstore-wowmuch', ${NOW - 3 * HOUR}, ${NOW - 3 * HOUR}, 'success', NULL, 0),
             ('steam-guide-ak', ${NOW - HOUR}, ${NOW - HOUR}, 'success', NULL, 0);
    `);

    await runWatchdog(env, NOW);

    expect(incident('thunderstore-wowmuch')).toMatchObject({
      latest_tier: 'stale',
      failure_notification_state: 'sent'
    });
    expect(incident('steam-guide-ak')).toBeUndefined();
  });

  it('retries a recovery notification that failed', async () => {
    const { env, incident } = setup(`
      INSERT INTO collection_incidents (source_id, first_failure_at, last_failure_at, latest_tier, latest_error,
        resolved_at, failure_notification_state, recovery_notification_state)
      VALUES ('steam-guide-ak', ${NOW - 5 * HOUR}, ${NOW - 4 * HOUR}, 'permanent', 'gone', ${NOW - HOUR}, 'sent', 'failed');
    `);

    await runWatchdog(env, NOW);

    expect(discord.postDiscord.mock.calls[0][1]).toContain('recovered');
    expect(incident('steam-guide-ak')).toMatchObject({ recovery_notification_state: 'sent' });
  });
});
