export type AuthorizeArgs = { clientId: string; scopes: string };

export type DeviceCode = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

export type TokenResult = { access_token: string; scope: string; token_type: string };

type Deps = { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number };

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

export function parseAuthorizeArgs(
  argv: string[],
  env: Record<string, string | undefined> = process.env
): AuthorizeArgs {
  let clientId = env.GITHUB_OAUTH_CLIENT_ID ?? '';
  let scopes = 'read:user';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--client-id' && value) {
      clientId = value;
      index += 1;
    } else if (arg === '--scopes' && value) {
      scopes = value;
      index += 1;
    } else throw new Error(`unknown or incomplete argument: ${arg}`);
  }
  if (!clientId) throw new Error('missing --client-id (or GITHUB_OAUTH_CLIENT_ID)');
  return { clientId, scopes };
}

export async function requestDeviceCode(args: AuthorizeArgs, fetchImpl: typeof fetch = fetch): Promise<DeviceCode> {
  const response = await fetchImpl(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: args.clientId, scope: args.scopes }).toString()
  });
  if (!response.ok) throw new Error(`device code request failed: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as DeviceCode & { error?: string; error_description?: string };
  if (body.error) throw new Error(`device code request error: ${body.error_description ?? body.error}`);
  return body;
}

export async function pollForToken(device: DeviceCode, clientId: string, deps: Deps = {}): Promise<TokenResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;
  let intervalMs = device.interval * 1000;
  const deadline = now() + device.expires_in * 1000;

  while (now() < deadline) {
    await sleep(intervalMs);
    const response = await fetchImpl(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: device.device_code,
        grant_type: GRANT_TYPE
      }).toString()
    });
    const body = (await response.json()) as Partial<TokenResult> & {
      error?: string;
      error_description?: string;
      interval?: number;
    };

    if (body.access_token) {
      return { access_token: body.access_token, scope: body.scope ?? '', token_type: body.token_type ?? 'bearer' };
    }
    switch (body.error) {
      case 'authorization_pending':
        continue;
      case 'slow_down':
        intervalMs = (body.interval ?? Math.round(intervalMs / 1000) + 5) * 1000;
        continue;
      case 'access_denied':
        throw new Error('authorization denied by the user');
      case 'expired_token':
        throw new Error('device code expired before authorization; re-run to request a new code');
      case 'device_flow_disabled':
        throw new Error('device flow is not enabled for this OAuth app; enable it in the app settings');
      default:
        throw new Error(`unexpected device-flow error: ${body.error_description ?? body.error ?? 'unknown'}`);
    }
  }
  throw new Error('device code expired before authorization; re-run to request a new code');
}

async function main(): Promise<void> {
  const args = parseAuthorizeArgs(process.argv.slice(2));
  const device = await requestDeviceCode(args);
  console.log(`\nOpen ${device.verification_uri} and enter code: ${device.user_code}`);
  console.log('Waiting for authorization...\n');
  const token = await pollForToken(device, args.clientId);
  console.log(`access_token=${token.access_token}`);
  console.log(`scope=${token.scope}`);
  console.log('\nNext: put it in .dev.vars as GITHUB_TOKEN=<token> and run `wrangler secret put GITHUB_TOKEN`.');
}

if (process.argv[1]?.endsWith('github-oauth-authorize.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
