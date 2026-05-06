export async function postDiscord(webhook: string, content: string): Promise<void> {
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (!response.ok) throw new Error(`Discord webhook failed: ${response.status}`);
}
