import { chooseAccessHeaders } from './access-headers.ts';

export type VerifyDeployArgs = { baseUrl: string };

export function parseVerifyDeployArgs(argv: string[]): VerifyDeployArgs {
  const parsed: VerifyDeployArgs = {
    baseUrl: 'https://dashboard.glockyco.com'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--') continue;
    if (arg === '--base-url' && value) {
      parsed.baseUrl = value;
      index += 1;
    } else throw new Error(`unknown or incomplete argument: ${arg}`);
  }
  return parsed;
}

async function requireOk(url: string, headers: Record<string, string>): Promise<void> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`deploy verify failed ${url}: ${response.status} ${await response.text()}`);
}

async function main(): Promise<void> {
  const args = parseVerifyDeployArgs(process.argv.slice(2));
  const headers = await chooseAccessHeaders(args.baseUrl);
  await Promise.all([
    requireOk(`${args.baseUrl}/`, headers),
    requireOk(`${args.baseUrl}/activity`, headers),
    requireOk(`${args.baseUrl}/issues`, headers)
  ]);
  console.log('verify deploy ok: Overview, Activity, and Issues are reachable');
}

if (process.argv[1]?.endsWith('verify-deploy.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
