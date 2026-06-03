# GitHub OAuth Token Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the expiring classic PAT behind the `github-glockyco` connector with a non-expiring OAuth App user token (`read:user`), preserving the contributions graph (private activity included) exactly.

**Architecture:** The runtime stays identical — the Worker reads one secret and sends it as a bearer token to the unchanged GraphQL `viewer` query. The work is: rename `GITHUB_PAT` → `GITHUB_TOKEN` across the codebase, add a reproducible device-flow mint script that produces the `gho_` token, widen fixture redaction to all `gh*_` token prefixes, and document the new credential. The live OAuth App creation, token mint, scope check, deploy, and old-PAT revocation are operator steps in Task 5.

**Tech Stack:** SvelteKit on Cloudflare Workers, TypeScript, Vitest, `node --experimental-strip-types` for `scripts/*.ts`, `wrangler` for secrets/deploy.

**Spec:** `docs/superpowers/specs/2026-06-03-github-oauth-token-design.md`

---

## File Structure

- `src/app.d.ts` — `Env` interface; rename the secret field.
- `src/lib/connectors/auth/github.ts` — bearer header builder; rename the field it reads.
- `src/lib/connectors/fetchers/github.ts` — **not modified** (the `viewer` query is preserved).
- `scripts/deploy-preflight.ts` / `scripts/smoke-connectors.ts` / `scripts/capture-fixture.ts` — rename the secret name string literals.
- `scripts/github-oauth-authorize.ts` — **new** device-flow mint CLI (pure functions + thin `main()` guard, matching `scripts/smoke-ingest.ts`).
- `scripts/github-oauth-authorize.test.ts` — **new** unit tests for the mint script.
- Test files mirroring the renamed references: `src/lib/connectors/fetchers/github.test.ts`, `scripts/smoke-connectors.test.ts`, `scripts/deploy-preflight.test.ts`, `scripts/capture-fixture.test.ts`.
- `.dev.vars.example`, `package.json`, `AGENTS.md` — config/docs.

---

## Task 1: Rename `GITHUB_PAT` → `GITHUB_TOKEN`

The credential is no longer a PAT. This is a pure rename across runtime, scripts, and tests; the existing suite passing under the new name is the test.

**Files:**

- Modify: `src/app.d.ts:15`
- Modify: `src/lib/connectors/auth/github.ts:1-2`
- Modify: `scripts/deploy-preflight.ts:11`
- Modify: `scripts/smoke-connectors.ts:94`
- Modify: `scripts/capture-fixture.ts:157`
- Modify: `.dev.vars.example:5`
- Test: `src/lib/connectors/fetchers/github.test.ts:16`
- Test: `scripts/smoke-connectors.test.ts:59,62,71`
- Test: `scripts/deploy-preflight.test.ts:42`

- [ ] **Step 1: Update the `Env` type and the auth header builder**

In `src/app.d.ts`, line 15:

```ts
GITHUB_TOKEN: string;
```

In `src/lib/connectors/auth/github.ts` (whole file):

```ts
export const githubHeaders = (env: Pick<Env, 'GITHUB_TOKEN'>) => ({
  Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'creator-dashboard/1.0'
});
```

> Prefer `lsp rename` on the `Env.GITHUB_PAT` property to catch typed references, then handle the string literals below. Confirm with `search` for `GITHUB_PAT` that nothing remains after all steps.

- [ ] **Step 2: Update the script string literals**

`scripts/deploy-preflight.ts`, line 11 (inside `requiredProductionSecrets()`):

```ts
    'GITHUB_TOKEN',
```

`scripts/smoke-connectors.ts`, line 94 (inside `secretRequirements`):

```ts
if (sourceId.startsWith('github-')) return ['GITHUB_TOKEN'];
```

`scripts/capture-fixture.ts`, line 157 (the github capture source header):

```ts
        Authorization: `Bearer ${required(env, 'GITHUB_TOKEN')}`,
```

- [ ] **Step 3: Update `.dev.vars.example`**

Line 5:

```text
GITHUB_TOKEN=gho_replace
```

- [ ] **Step 4: Update the tests to the new name**

`src/lib/connectors/fetchers/github.test.ts`, line 16:

```ts
const env = { GITHUB_TOKEN: 'gho_test' } as Env;
```

`scripts/smoke-connectors.test.ts`, lines 57-65 (the `parseDevVars` sample and expectation):

```ts
      parseDevVars(
        'GITHUB_TOKEN=gho_test\nCF_ANALYTICS_SITE_TAGS={"source":"tag"}\nQUOTED="value with spaces"\n# ignored\n'
      )
    ).toEqual({
      GITHUB_TOKEN: 'gho_test',
      CF_ANALYTICS_SITE_TAGS: '{"source":"tag"}',
      QUOTED: 'value with spaces'
```

`scripts/smoke-connectors.test.ts`, line 71:

```ts
expect(secretRequirements('github-glockyco')).toEqual(['GITHUB_TOKEN']);
```

`scripts/deploy-preflight.test.ts`, line 42:

```ts
      'GITHUB_TOKEN',
```

- [ ] **Step 5: Run the affected tests + type check**

Run: `pnpm vitest run src/lib/connectors/fetchers/github.test.ts scripts/smoke-connectors.test.ts scripts/deploy-preflight.test.ts`
Expected: PASS (all three files green).

Run: `pnpm check`
Expected: no type errors (no remaining `GITHUB_PAT` reference in `Env`).

- [ ] **Step 6: Confirm no stragglers**

Run `search` for `GITHUB_PAT` across `src`, `scripts`, and `.dev.vars.example`.
Expected: zero matches.

- [ ] **Step 7: Commit**

```bash
git add src/app.d.ts src/lib/connectors/auth/github.ts scripts/deploy-preflight.ts scripts/smoke-connectors.ts scripts/capture-fixture.ts .dev.vars.example src/lib/connectors/fetchers/github.test.ts scripts/smoke-connectors.test.ts scripts/deploy-preflight.test.ts
git commit -m "refactor(github): rename GITHUB_PAT secret to GITHUB_TOKEN"
```

---

## Task 2: Widen fixture redaction to all `gh*_` token prefixes

The OAuth token is `gho_`-prefixed; the current redaction regex only catches `ghp_`. Cover the whole `gh<letter>_` family so a captured fixture never leaks an OAuth/installation/refresh token.

**Files:**

- Modify: `scripts/capture-fixture.ts:46`
- Test: `scripts/capture-fixture.test.ts`

- [ ] **Step 1: Write the failing test**

In `scripts/capture-fixture.test.ts`, add inside the `describe('capture-fixture utility', …)` block (after the existing redaction test, around line 33):

```ts
it('redacts oauth and app token prefixes, not just classic PATs', () => {
  expect(redactFixtureText('gho_oauth123 ghu_user456 ghs_app789 ghr_refreshABC')).toBe(
    '[redacted] [redacted] [redacted] [redacted]'
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/capture-fixture.test.ts -t "oauth and app token"`
Expected: FAIL — `gho_`/`ghu_`/`ghs_`/`ghr_` are not redacted (output still contains the raw tokens).

- [ ] **Step 3: Widen the pattern**

In `scripts/capture-fixture.ts`, line 46, replace the `ghp_` pattern:

```ts
  /gh[a-z]_[A-Za-z0-9_]+/g,
```

- [ ] **Step 4: Run the redaction tests to verify they pass**

Run: `pnpm vitest run scripts/capture-fixture.test.ts`
Expected: PASS — both the original `ghp_`/email/steamid/Bearer test and the new `gh*_` test are green.

- [ ] **Step 5: Commit**

```bash
git add scripts/capture-fixture.ts scripts/capture-fixture.test.ts
git commit -m "fix(capture-fixture): redact all gh*_ token prefixes"
```

---

## Task 3: Add the device-flow mint script

A reproducible CLI that runs the OAuth Device Authorization Grant and prints the `gho_` token. Pure functions are exported for tests; `main()` runs under a `process.argv[1]` guard, matching `scripts/smoke-ingest.ts`.

**Files:**

- Create: `scripts/github-oauth-authorize.ts`
- Test: `scripts/github-oauth-authorize.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `scripts/github-oauth-authorize.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { parseAuthorizeArgs, pollForToken, requestDeviceCode } from './github-oauth-authorize';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const device = {
  device_code: 'devcode',
  user_code: 'WDJB-MJHT',
  verification_uri: 'https://github.com/login/device',
  expires_in: 900,
  interval: 5
};

describe('parseAuthorizeArgs', () => {
  it('defaults scope to read:user and reads --client-id', () => {
    expect(parseAuthorizeArgs(['--client-id', 'cli_123'], {})).toEqual({
      clientId: 'cli_123',
      scopes: 'read:user'
    });
  });

  it('falls back to GITHUB_OAUTH_CLIENT_ID and honors --scopes', () => {
    expect(parseAuthorizeArgs(['--scopes', 'read:user public_repo'], { GITHUB_OAUTH_CLIENT_ID: 'env_id' })).toEqual({
      clientId: 'env_id',
      scopes: 'read:user public_repo'
    });
  });

  it('throws when no client id is provided', () => {
    expect(() => parseAuthorizeArgs([], {})).toThrow('missing --client-id');
  });
});

describe('requestDeviceCode', () => {
  it('posts client_id + scope and returns the parsed device code', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(device));
    const result = await requestDeviceCode({ clientId: 'cli_123', scopes: 'read:user' }, fetchImpl);

    expect(result).toEqual(device);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://github.com/login/device/code');
    expect((init as RequestInit).body).toContain('client_id=cli_123');
    expect((init as RequestInit).body).toContain('scope=read%3Auser');
  });

  it('throws when the device code response carries an error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'invalid_client' }));
    await expect(requestDeviceCode({ clientId: 'bad', scopes: 'read:user' }, fetchImpl)).rejects.toThrow(
      'invalid_client'
    );
  });
});

describe('pollForToken', () => {
  const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
  const now = () => 0;

  it('keeps polling on authorization_pending then returns the token', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gho_minted', scope: 'read:user', token_type: 'bearer' }));

    const token = await pollForToken(device, 'cli_123', { fetchImpl, sleep, now });

    expect(token).toEqual({ access_token: 'gho_minted', scope: 'read:user', token_type: 'bearer' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('adopts the returned interval on slow_down', async () => {
    const calls: number[] = [];
    const recordingSleep = vi.fn(async (ms: number) => {
      calls.push(ms);
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'slow_down', interval: 10 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gho_minted', scope: 'read:user' }));

    await pollForToken(device, 'cli_123', { fetchImpl, sleep: recordingSleep, now });

    expect(calls).toEqual([5_000, 10_000]);
  });

  it('throws a clear message on access_denied', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'access_denied' }));
    await expect(pollForToken(device, 'cli_123', { fetchImpl, sleep, now })).rejects.toThrow('denied');
  });

  it('throws on device_flow_disabled', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'device_flow_disabled' }));
    await expect(pollForToken(device, 'cli_123', { fetchImpl, sleep, now })).rejects.toThrow('device flow');
  });

  it('throws when the device code expires before authorization', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'expired_token' }));
    await expect(pollForToken(device, 'cli_123', { fetchImpl, sleep, now })).rejects.toThrow('expired');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run scripts/github-oauth-authorize.test.ts`
Expected: FAIL — module `./github-oauth-authorize` does not exist.

- [ ] **Step 3: Implement the mint script**

Create `scripts/github-oauth-authorize.ts`:

```ts
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
  console.log(
    '\nNext: put it in .dev.vars as GITHUB_TOKEN=<token> and run `pnpm exec wrangler secret put GITHUB_TOKEN`.'
  );
}

if (process.argv[1]?.endsWith('github-oauth-authorize.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run scripts/github-oauth-authorize.test.ts`
Expected: PASS — all `parseAuthorizeArgs`, `requestDeviceCode`, and `pollForToken` cases green.

- [ ] **Step 5: Type check**

Run: `pnpm check`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/github-oauth-authorize.ts scripts/github-oauth-authorize.test.ts
git commit -m "feat(scripts): add github oauth device-flow mint script"
```

---

## Task 4: Documentation and pnpm alias

**Files:**

- Modify: `.dev.vars.example` (comment above `GITHUB_TOKEN`)
- Modify: `package.json` (scripts)
- Modify: `AGENTS.md` (Conventions or Setup)

- [ ] **Step 1: Comment the credential in `.dev.vars.example`**

Insert a comment block immediately above the `GITHUB_TOKEN=gho_replace` line:

```text
# OAuth App user token (read:user) for the github-glockyco connector. It does
# not expire. Mint a fresh one with: pnpm github:authorize --client-id <id>
# (the OAuth App must have Device Flow enabled). read:user preserves private
# contributions; add public_repo only if repo-star metrics need it.
GITHUB_TOKEN=gho_replace
```

- [ ] **Step 2: Add the pnpm alias**

In `package.json`, add to `"scripts"` (after the `smoke:*` entries):

```json
    "github:authorize": "node --experimental-strip-types scripts/github-oauth-authorize.ts",
```

- [ ] **Step 3: Note the recovery path in `AGENTS.md`**

Under the **Setup** section (near the existing secret-store recovery note), add:

```text
- `GITHUB_TOKEN` is an OAuth App user token (`read:user`), not a PAT, so it does not expire. Recreate it with `pnpm github:authorize --client-id <oauth-app-client-id>` (OAuth App must have Device Flow enabled), then `pnpm exec wrangler secret put GITHUB_TOKEN`.
```

- [ ] **Step 4: Verify formatting and lint**

Run: `pnpm lint`
Expected: PASS (prettier + eslint clean; `package.json` and markdown well-formed).

- [ ] **Step 5: Commit**

```bash
git add .dev.vars.example package.json AGENTS.md
git commit -m "docs(github): document GITHUB_TOKEN oauth credential and mint alias"
```

---

## Task 5: Operator cutover (live token; runs outside the code edits)

These steps require GitHub UI access and the production environment; they cannot be done from unit tests. Run them in order. Do **not** delete the old PAT until step 7 confirms the deployed run succeeds.

- [ ] **Step 1: Create the OAuth App**

On `github.com` → Settings → Developer settings → OAuth Apps → New OAuth App (owned by `glockyco`). Any homepage/callback URL is fine (device flow ignores it). After creation, open the app and **enable "Device Flow"**. Note the **Client ID**.

- [ ] **Step 2: Mint the token (try `read:user` only first)**

Run: `pnpm github:authorize --client-id <client-id>`
Open the printed URL, enter the code, approve. Copy the printed `access_token` (`gho_…`).

- [ ] **Step 3: Verify scope sufficiency locally**

Put the token in `.dev.vars` as `GITHUB_TOKEN=<token>`, then run:

Run: `pnpm smoke:authenticated --source github-glockyco`
Expected: `ok` with non-skipped metrics including `followers`, `total_stars`, `public_repos`, and `contributions`. Confirm the contributions total — **including private contributions** — matches what the dashboard showed before the change.
If `total_stars` / `public_repos` / `repo_stars` come back empty or error, re-mint with `--scopes "read:user public_repo"` and repeat. Otherwise keep `read:user` only.

- [ ] **Step 4: Set the production secret**

Run: `pnpm exec wrangler secret put GITHUB_TOKEN`
Paste the same token.

- [ ] **Step 5: Deploy**

Run: `pnpm run deploy`
Expected: preflight passes (it now requires `GITHUB_TOKEN`), build + deploy succeed.

- [ ] **Step 6: Confirm the deployed connector**

After the next hourly cron (or trigger a refresh), confirm in the dashboard that GitHub metrics updated and the contributions graph is unchanged from before the migration.

- [ ] **Step 7: Revoke the old classic PAT**

In GitHub → Settings → Developer settings → Personal access tokens (classic), delete the `creator-dashboard` token (`https://github.com/settings/tokens`). Remove the old `GITHUB_PAT` Worker secret if it still exists: `pnpm exec wrangler secret delete GITHUB_PAT`.

---

## Final verification

- [ ] Run the full unit suite: `pnpm test` → all green.
- [ ] Run `pnpm check` and `pnpm lint` → clean.
- [ ] `search` for `GITHUB_PAT` repo-wide (excluding `docs/`) → zero matches.

---

## Self-Review

**Spec coverage:**

- §3.1 secret rename → Task 1 (all listed files covered: app.d.ts, auth/github.ts, deploy-preflight.ts, smoke-connectors.ts, capture-fixture.ts, .dev.vars.example, and the three test files).
- §3.1 redaction widening → Task 2.
- §3.2 mint script (device flow, Accept header, full error set, client-id-not-a-secret, test) → Task 3.
- §3.3 scope `read:user` with public-repo fallback verification → Task 4 Step 1 comment + Task 5 Step 3.
- §3.4 docs (.dev.vars.example, AGENTS.md) → Task 4 (plus a `package.json` alias for discoverability).
- §5 testing (unit + live parity) → Task 3 tests, Task 5 Step 3, Final verification.
- §6 rollout/cutover → Task 5.

**Placeholder scan:** No TBD/TODO; every code step has complete code; commands have expected output. The only intentional branch is the `read:user` vs `+public_repo` scope decision, which is an explicit operator verification (Task 5 Step 3), not a placeholder.

**Type consistency:** `AuthorizeArgs { clientId, scopes }`, `DeviceCode`, `TokenResult { access_token, scope, token_type }`, and the `Deps { fetchImpl, sleep, now }` shape are used identically in `github-oauth-authorize.ts` and its test. `Env.GITHUB_TOKEN` is the single renamed field used in `app.d.ts`, `auth/github.ts`, and (as a `keyof Env` string) in `capture-fixture.ts`.
