import { chooseAccessHeaders } from './access-headers.ts';
import { pollStatus, type SmokeIngestArgs } from './smoke-ingest.ts';

export type VerifyDeployArgs = SmokeIngestArgs;

export function parseVerifyDeployArgs(argv: string[]): VerifyDeployArgs {
  const parsed: VerifyDeployArgs = {
    sourceId: 'steam-reviews-erenshor',
    baseUrl: 'https://dashboard.glockyco.com',
    timeoutMs: 120_000
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

async function requireOk(url: string, headers: Record<string, string>): Promise<void> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`deploy verify failed ${url}: ${response.status} ${await response.text()}`);
}

async function postRefresh(args: VerifyDeployArgs, headers: Record<string, string>): Promise<void> {
  const response = await fetch(`${args.baseUrl}/api/refresh/${args.sourceId}`, { method: 'POST', headers });
  if (!response.ok) throw new Error(`deploy refresh failed: ${response.status} ${await response.text()}`);
}

async function main(): Promise<void> {
  const args = parseVerifyDeployArgs(process.argv.slice(2));
  const headers = await chooseAccessHeaders(args.baseUrl);
  await requireOk(`${args.baseUrl}/`, headers);
  await requireOk(`${args.baseUrl}/health`, headers);
  await postRefresh(args, headers);
  const status = await pollStatus(args, headers);
  console.log(`verify deploy ok ${args.sourceId}: last_success_at=${status.last_success_at}`);
}

if (process.argv[1]?.endsWith('verify-deploy.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
