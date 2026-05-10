import { formatDigest } from './format';
import { getDigestData } from './query';
import { isViennaDigestHour, viennaDateKey } from './vienna';

export type DigestSendResult = { sent: boolean; reason: 'outside_digest_hour' | 'already_sent' | 'sent' };

export async function maybeDailyDigest(env: Env, now: Date): Promise<DigestSendResult> {
  if (!isViennaDigestHour(now)) return { sent: false, reason: 'outside_digest_hour' };

  const dateKey = viennaDateKey(now);
  const existing = await env.DB.prepare('SELECT digest_date FROM digest_sent WHERE digest_date = ?').bind(dateKey).first<{ digest_date: string }>();
  if (existing) return { sent: false, reason: 'already_sent' };

  const data = await getDigestData(env.DB, now);
  const message = formatDigest(data, dateKey);
  const response = await fetch(env.DISCORD_DIGEST_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
  if (!response.ok) throw new Error(`Discord digest webhook failed: ${response.status}`);

  await env.DB.prepare('INSERT INTO digest_sent (digest_date, sent_at) VALUES (?, ?)').bind(dateKey, now.getTime()).run();
  return { sent: true, reason: 'sent' };
}
