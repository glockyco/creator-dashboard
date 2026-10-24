export async function postDiscord(webhook: string, content: string): Promise<void> {
  if (!webhook) throw new Error('Discord webhook is not configured');
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Alert text quotes upstream responses; never let them ping @everyone or a role.
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    // A hung webhook would leave the notification stuck in 'sending'.
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Discord webhook failed: ${response.status}`);
}
