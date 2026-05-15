import { chooseAccessHeaders } from './access-headers.ts';
import { parseSmokeIngestArgs, pollStatus, type SmokeIngestArgs } from './smoke-ingest.ts';

export type SmokeCronArgs = SmokeIngestArgs;

export function parseSmokeCronArgs(argv: string[]): SmokeCronArgs {
  return parseSmokeIngestArgs(argv);
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
  const status = await pollStatus(args, headers);
  console.log(`cron smoke ok ${args.sourceId}: last_success_at=${status.last_success_at}`);
}

if (process.argv[1]?.endsWith('smoke-cron.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
