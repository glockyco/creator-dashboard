import { accessHeaders } from '../e2e/support/access-auth.ts';

export type SmokeIngestArgs = { sourceId: string; baseUrl: string; timeoutMs: number };
export type FetcherStatusShape = {
  last_status: string | null;
  last_success_at: number | null;
  consecutive_failures: number;
};

export function parseSmokeIngestArgs(argv: string[]): SmokeIngestArgs {
  const parsed: SmokeIngestArgs = {
    sourceId: 'steam-reviews-erenshor',
    baseUrl: 'http://127.0.0.1:8788',
    timeoutMs: 60_000
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--source' && value) {
      parsed.sourceId = value;
      index += 1;
    } else if (arg === '--base-url' && value) {
      parsed.baseUrl = value;
      index += 1;
    } else if (arg === '--timeout-ms' && value) {
      parsed.timeoutMs = Number(value);
      index += 1;
    } else throw new Error(`unknown or incomplete argument: ${arg}`);
  }
  return parsed;
}

export function statusReachedSuccess(status: FetcherStatusShape): boolean {
  return status.last_status === 'success' && status.last_success_at !== null && status.consecutive_failures === 0;
}

export async function postRefresh(args: SmokeIngestArgs, headers: Record<string, string>): Promise<void> {
  const response = await fetch(`${args.baseUrl}/api/refresh/${args.sourceId}`, { method: 'POST', headers });
  if (!response.ok) throw new Error(`refresh smoke failed: ${response.status} ${await response.text()}`);
}

export async function pollStatus(args: SmokeIngestArgs, headers: Record<string, string>): Promise<FetcherStatusShape> {
  const deadline = Date.now() + args.timeoutMs;
  let last: FetcherStatusShape | null = null;
  while (Date.now() < deadline) {
    const response = await fetch(`${args.baseUrl}/api/sources/${args.sourceId}/status`, { headers });
    if (!response.ok) throw new Error(`status smoke failed: ${response.status} ${await response.text()}`);
    last = (await response.json()) as FetcherStatusShape;
    if (statusReachedSuccess(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`ingest smoke timed out for ${args.sourceId}; last status ${JSON.stringify(last)}`);
}

async function main(): Promise<void> {
  const args = parseSmokeIngestArgs(process.argv.slice(2));
  const headers = await accessHeaders();
  await postRefresh(args, headers);
  const status = await pollStatus(args, headers);
  console.log(`ingest smoke ok ${args.sourceId}: last_success_at=${status.last_success_at}`);
}

if (process.argv[1]?.endsWith('smoke-ingest.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
