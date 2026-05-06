import { getSource } from '$lib/sources/registry';
import type { JobMsg } from '$lib/types/orchestration';
import { maybeSendAlert } from '$lib/server/alerts/dedup';
import { log } from '$lib/server/log';
import { classify } from './errors';
import { successStatements } from './persist';

export async function consumeMessage(message: Message<JobMsg>, env: Env, now = Date.now()): Promise<void> {
  const { source_id, force } = message.body;
  const source = getSource(source_id);
  if (!source) {
    log('warn', 'dropping unknown source job', { source_id });
    message.ack();
    return;
  }

  if (!force) {
    const run = await env.DB.prepare('SELECT last_run_at FROM fetcher_runs WHERE source_id = ?').bind(source_id).first<{ last_run_at: number }>();
    const cadenceMs = source.cadenceHours * 3_600_000;
    if (run && now - run.last_run_at < cadenceMs - 300_000) {
      message.ack();
      return;
    }
  }

  try {
    const output = await source.fetcher({ source, env, now });
    await env.DB.batch(successStatements(env.DB, source_id, now, output));
    log('info', 'source fetch succeeded', { source_id, metric_points: output.metric_points.length, events: output.events.length });
    message.ack();
  } catch (err) {
    const failure = classify(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message) VALUES (?, ?, ?, ?, ?)').bind(
        source_id,
        now,
        failure.tier,
        failure.statusCode,
        errorMessage
      ),
      env.DB.prepare(`
        INSERT INTO fetcher_runs (source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures)
        VALUES (?, ?, NULL, ?, ?, 1)
        ON CONFLICT(source_id) DO UPDATE SET
          last_run_at = excluded.last_run_at,
          last_status = excluded.last_status,
          last_error = excluded.last_error,
          consecutive_failures = fetcher_runs.consecutive_failures + 1
      `).bind(source_id, now, `${failure.tier}_failure`, errorMessage)
    ]);

    if (failure.tier === 'permanent') {
      await maybeSendAlert(env, source_id, 'permanent', failure.errorClass, errorMessage);
      message.ack();
      return;
    }

    message.retry({ delaySeconds: failure.retryAfterSeconds ?? 300 });
  }
}
