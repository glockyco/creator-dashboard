import { postDiscord } from './discord';

export async function maybeSendAlert(
  env: Env,
  sourceId: string,
  tier: 'permanent' | 'dlq',
  errorClass: string,
  message: string,
  now = Date.now()
): Promise<boolean> {
  const alertKey = `${tier}:${sourceId}:${errorClass}`;
  const existing = await env.DB.prepare('SELECT sent_at FROM alerts_sent WHERE alert_key = ?')
    .bind(alertKey)
    .first<{ sent_at: number }>();
  if (existing && now - existing.sent_at < 24 * 3_600_000) return false;

  await postDiscord(
    env.DISCORD_ALERTS_WEBHOOK,
    `creator-dashboard ${tier} failure: ${sourceId} (${errorClass})\n${message}`
  );
  await env.DB.prepare('INSERT OR REPLACE INTO alerts_sent (alert_key, sent_at) VALUES (?, ?)')
    .bind(alertKey, now)
    .run();
  return true;
}
