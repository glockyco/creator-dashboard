import { chooseAccessHeaders } from './access-headers.ts';

export type SmokeCronArgs = { sourceId: string; baseUrl: string };

export function parseSmokeCronArgs(argv: string[]): SmokeCronArgs {
  const parsed: SmokeCronArgs = {
    sourceId: 'steam-reviews-erenshor',
    baseUrl: 'http://127.0.0.1:8788'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--') continue;
    if (arg === '--source' && value) {
      parsed.sourceId = value;
      index += 1;
    } else if (arg === '--base-url' && value) {
      parsed.baseUrl = value;
      index += 1;
    } else throw new Error(`unknown or incomplete argument: ${arg}`);
  }
  return parsed;
}

async function postHourlySmoke(args: SmokeCronArgs, headers: Record<string, string>): Promise<void> {
  const response = await fetch(`${args.baseUrl}/api/smoke/hourly`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId: args.sourceId })
  });
  if (!response.ok) throw new Error(`cron smoke failed: ${response.status} ${await response.text()}`);
  const payload = (await response.json()) as { enqueued?: number };
  if (payload.enqueued !== 1)
    throw new Error(`cron smoke expected one enqueued job, got ${payload.enqueued ?? 'missing'}`);
}

async function main(): Promise<void> {
  const args = parseSmokeCronArgs(process.argv.slice(2));
  const headers = await chooseAccessHeaders(args.baseUrl);
  await postHourlySmoke(args, headers);
  console.log(`cron smoke queued ${args.sourceId}`);
}

if (process.argv[1]?.endsWith('smoke-cron.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
