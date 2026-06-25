---
title: "Creator Dashboard Deploy Readiness Implementation Plan"
type: plan
status: implemented
created: 2026-05-10
parent:
superseded_by:
archived: 2026-06-25
---

# Creator Dashboard Deploy Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use skill://superpowers:subagent-driven-development (recommended) or skill://superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Creator Dashboard safe to deploy manually by provisioning/verifying Cloudflare resources, adding bounded ingest/cron smoke checks, and tightening deploy scripts so production readiness is proven before side-effecting post-deploy work.

**Architecture:** Keep the Worker runtime unchanged unless verification exposes a concrete mismatch. Add small scriptable preflight/smoke utilities around the existing Worker endpoints and orchestration flow: connector smoke remains HTTP-fetcher preflight, local ingest smoke proves refresh endpoint -> Queue -> consumer -> D1, cron smoke proves scheduled hourly dispatch without invoking the digest cron, and remote verification proves the deployed Worker can authenticate, enqueue, consume, and persist. Avoid automatic DLQ/digest triggering during smoke.

**Tech Stack:** SvelteKit 2, adapter-cloudflare, Wrangler, D1, Cloudflare Queues, Cron Triggers, Vitest, Playwright, Node TypeScript scripts via `node --experimental-strip-types`.

---

## Safety boundaries

- Do not run `wrangler dev --test-scheduled` as an unbounded smoke. With active consumers it can execute all live connectors and send real alerts.
- Use explicit source allowlists for smoke. Default smoke source: `steam-reviews-erenshor` because it is public, low-risk, and emits stable event/metric rows.
- Do not exercise the digest cron in smoke unless the Discord digest webhook is explicitly pointed at a sandbox sink.
- Permanent-failure and DLQ alerts remain production behavior. Smoke scripts must either stay on success paths or use local webhook sinks.
- GA4 is no longer deferred. Resolve GA4 live integration before deploy-readiness implementation proceeds past planning.

---

## Task 1: Sync planning artifacts and resource checklist

**Files:**

- Modify: `docs/superpowers/specs/2026-05-04-creator-dashboard-design.md`
- Modify: `docs/superpowers/plans/2026-05-04-creator-dashboard-implementation.md`
- Create: `docs/superpowers/plans/2026-05-10-creator-dashboard-deploy-readiness.md`

- [ ] **Step 1: Verify docs mention current source/auth state**

Check that both existing docs mention:

```text
GSC uses Google OAuth refresh-token auth.
GOOGLE_SERVICE_ACCOUNT is retained only for future GA4.
CF analytics requires CF_API_TOKEN, CF_ACCOUNT_ID, and CF_ANALYTICS_SITE_TAGS.
gsc-ak-compendium-org and bing-ak-compendium-org are enabled parallel AK migration sources.
Daily digest uses rich Discord embeds.
GA4 live integration is planned before deploy readiness.
```

- [ ] **Step 2: Verify deploy readiness gate text**

Check that the final verification section requires this order:

```text
resource preflight -> safe local connector smoke -> local ingest smoke -> local cron/queue smoke -> remote deploy -> post-deploy verification
```

- [ ] **Step 3: Run a doc consistency search**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
paths = [
  Path('docs/superpowers/specs/2026-05-04-creator-dashboard-design.md'),
  Path('docs/superpowers/plans/2026-05-04-creator-dashboard-implementation.md'),
  Path('docs/superpowers/plans/2026-05-10-creator-dashboard-deploy-readiness.md'),
]
needles = [
  'gsc-ak-compendium-org',
  'bing-ak-compendium-org',
  'CF_ACCOUNT_ID',
  'Google OAuth',
  'rich Discord embeds',
  'GA4 live integration',
]
for path in paths:
  text = path.read_text()
  missing = [needle for needle in needles if needle not in text]
  if missing:
    raise SystemExit(f'{path}: missing {missing}')
print('docs synchronized')
PY
```

Expected:

```text
docs synchronized
```

- [ ] **Step 4: Commit planning docs**

```bash
git add docs/superpowers/specs/2026-05-04-creator-dashboard-design.md docs/superpowers/plans/2026-05-04-creator-dashboard-implementation.md docs/superpowers/plans/2026-05-10-creator-dashboard-deploy-readiness.md
git commit -m "docs: sync deploy readiness plan"
```

---

## Task 2: Resolve GA4 live integration

**Files:**

- Modify: `src/lib/connectors/fetchers/ga4.ts`
- Modify: `src/lib/connectors/fetchers/ga4.test.ts`
- Modify: `src/lib/sources/registry-data.ts`
- Modify: `src/lib/sources/registry.test.ts`
- Modify: `src/lib/sources/metrics.ts`
- Modify: `src/lib/sources/metrics.test.ts`
- Modify: `scripts/smoke-connectors.ts`
- Modify: `scripts/smoke-connectors.test.ts`
- Modify: `scripts/backfill/lib/env.ts`
- Modify: `scripts/backfill-ga4.test.ts`
- Modify: `.dev.vars.example`

- [ ] **Step 1: Confirm Google Analytics Data API and property scope**

In GCP project `creator-dashboard-495905`, confirm Google Analytics Data API is enabled:

```bash
pnpm exec wrangler --version
```

The Wrangler version command is only a harmless local sanity check before browser work. Then use the Google Cloud console to enable `analyticsdata.googleapis.com` if it is not already enabled.

In GA4, identify the numeric property ID that covers the traffic the dashboard should track. For initial deployment, use the property that best represents `glockyco.com` / the relevant creator traffic. Write the real numeric value into `.dev.vars`; the value below is an example shape:

```text
GA4_PROPERTY_ID=123456789
```

- [ ] **Step 2: Reissue the Google OAuth refresh token with both scopes**

Use the existing Google OAuth Web client in OAuth Playground with these scopes selected together:

```text
https://www.googleapis.com/auth/webmasters.readonly
https://www.googleapis.com/auth/analytics.readonly
```

Keep OAuth flow `Server-side`, access type `Offline`, and force prompt `Consent Screen`. Replace `GOOGLE_OAUTH_REFRESH_TOKEN` in `.dev.vars` with the new refresh token. This keeps GSC working and allows GA4 to use the same refresh-token path, avoiding the Google service-account permission bug.

- [ ] **Step 3: Write failing GA4 OAuth test**

Update `src/lib/connectors/fetchers/ga4.test.ts` mock:

```ts
vi.mock('../auth/google', () => ({ getGoogleOAuthAccessToken: vi.fn(async () => 'google-token') }));
```

Then assert the connector calls the OAuth helper by importing the mock and checking it was called once. The test should fail before `ga4.ts` switches from `getGoogleAccessToken` to `getGoogleOAuthAccessToken`.

- [ ] **Step 4: Switch GA4 connector to OAuth**

In `src/lib/connectors/fetchers/ga4.ts`, replace:

```ts
import { getGoogleAccessToken } from '../auth/google.ts';
```

with:

```ts
import { getGoogleOAuthAccessToken } from '../auth/google.ts';
```

and replace:

```ts
const token = await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/analytics.readonly']);
```

with:

```ts
const token = await getGoogleOAuthAccessToken(env);
```

- [ ] **Step 5: Enable the GA4 source and metric registry**

Add the source once `GA4_PROPERTY_ID` is known:

```ts
{ id: 'ga4', identity: 'glockyco', name: 'GA4: glockyco.com', category: 'analytics', cadenceHours: 24, connector: 'ga4', config: {} }
```

Add metrics:

```ts
'ga4': { primary: ['active_users', 'sessions', 'views', 'event_count'], sparkline: 'active_users' }
```

Update `src/lib/sources/registry.test.ts` and `src/lib/sources/metrics.test.ts` expectations accordingly.

- [ ] **Step 6: Update env requirements and examples**

Change GA4 smoke requirements in `scripts/smoke-connectors.ts` to:

```ts
if (sourceId.startsWith('ga4') || sourceId.includes('-ga4-'))
  return ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN', 'GA4_PROPERTY_ID'];
```

Update `scripts/smoke-connectors.test.ts` for that requirement list.

In `scripts/backfill/lib/env.ts`, include `GA4_PROPERTY_ID` when `includeGa4` is true but do not require `GOOGLE_SERVICE_ACCOUNT` for GA4 if the connector uses OAuth.

In `.dev.vars.example`, keep `GA4_PROPERTY_ID=` and note that the OAuth refresh token must include `analytics.readonly`.

- [ ] **Step 7: Verify GA4 locally and live**

Run targeted tests:

```bash
pnpm vitest run src/lib/connectors/fetchers/ga4.test.ts scripts/smoke-connectors.test.ts src/lib/sources/registry.test.ts src/lib/sources/metrics.test.ts scripts/backfill-ga4.test.ts
pnpm check
```

Run live smoke:

```bash
pnpm smoke:connectors --source ga4 --strict
```

Expected: `ok ga4: 4 metric points, 0 events` or `ok ga4: 0 metric points, 0 events` if the selected property has no prior-day data.

- [ ] **Step 8: Commit GA4 integration**

```bash
git add src/lib/connectors/fetchers/ga4.ts src/lib/connectors/fetchers/ga4.test.ts src/lib/sources/registry-data.ts src/lib/sources/registry.test.ts src/lib/sources/metrics.ts src/lib/sources/metrics.test.ts scripts/smoke-connectors.ts scripts/smoke-connectors.test.ts scripts/backfill/lib/env.ts scripts/backfill-ga4.test.ts .dev.vars.example docs/superpowers
git commit -m "feat: enable ga4 analytics source"
```

---

## Task 3: Split deploy scripts and add preflight validation

**Files:**

- Modify: `package.json`
- Create: `scripts/deploy-preflight.ts`
- Create: `scripts/deploy-preflight.test.ts`

- [ ] **Step 1: Write failing preflight tests**

`scripts/deploy-preflight.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseWranglerPreflight, requiredProductionSecrets } from './deploy-preflight';

describe('deploy preflight', () => {
  it('rejects the placeholder D1 database id', () => {
    const result = parseWranglerPreflight(
      'database_id = "<replace with wrangler d1 create creator-dashboard database_id>"'
    );
    expect(result.errors).toContain('wrangler.toml still contains the placeholder D1 database_id');
  });

  it('requires D1, queue, DLQ, and cron bindings', () => {
    const toml = `
[[d1_databases]]
binding = "DB"
database_id = "11111111-1111-1111-1111-111111111111"
[[queues.producers]]
binding = "FETCHER_QUEUE"
queue = "creator-dashboard-fetchers"
[[queues.consumers]]
queue = "creator-dashboard-fetchers"
dead_letter_queue = "creator-dashboard-fetcher-dlq"
[[queues.consumers]]
queue = "creator-dashboard-fetcher-dlq"
[triggers]
crons = ["0 * * * *", "0 4,5 * * *"]
`;
    expect(parseWranglerPreflight(toml).errors).toEqual([]);
  });

  it('documents all production secrets including GA4', () => {
    expect(requiredProductionSecrets()).toEqual([
      'ACCESS_TEAM_DOMAIN',
      'ACCESS_AUD',
      'DISCORD_ALERTS_WEBHOOK',
      'DISCORD_DIGEST_WEBHOOK',
      'GITHUB_PAT',
      'STEAM_WEB_API_KEY',
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_REFRESH_TOKEN',
      'GSC_PROPERTIES',
      'BING_WEBMASTER_API_KEY',
      'BING_PROPERTIES',
      'CF_API_TOKEN',
      'GA4_PROPERTY_ID',
      'CF_ACCOUNT_ID',
      'CF_ANALYTICS_SITE_TAGS'
    ]);
  });
});
```

- [ ] **Step 2: Run preflight tests red**

```bash
pnpm vitest run scripts/deploy-preflight.test.ts
```

Expected: fail because `scripts/deploy-preflight.ts` does not exist.

- [ ] **Step 3: Implement preflight script**

`scripts/deploy-preflight.ts`:

```ts
import { readFile } from 'node:fs/promises';

const D1_PLACEHOLDER = '<replace with wrangler d1 create creator-dashboard database_id>';

export function requiredProductionSecrets(): string[] {
  return [
    'ACCESS_TEAM_DOMAIN',
    'ACCESS_AUD',
    'DISCORD_ALERTS_WEBHOOK',
    'DISCORD_DIGEST_WEBHOOK',
    'GITHUB_PAT',
    'STEAM_WEB_API_KEY',
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REFRESH_TOKEN',
    'GSC_PROPERTIES',
    'BING_WEBMASTER_API_KEY',
    'BING_PROPERTIES',
    'CF_API_TOKEN',
    'GA4_PROPERTY_ID',
    'CF_ACCOUNT_ID',
    'CF_ANALYTICS_SITE_TAGS'
  ];
}

export function parseWranglerPreflight(text: string): { errors: string[] } {
  const errors: string[] = [];
  if (text.includes(D1_PLACEHOLDER)) errors.push('wrangler.toml still contains the placeholder D1 database_id');
  if (!text.includes('binding       = "DB"') && !text.includes('binding = "DB"'))
    errors.push('wrangler.toml is missing DB D1 binding');
  if (!text.includes('binding = "FETCHER_QUEUE"'))
    errors.push('wrangler.toml is missing FETCHER_QUEUE producer binding');
  if (
    !text.includes('queue   = "creator-dashboard-fetchers"') &&
    !text.includes('queue = "creator-dashboard-fetchers"')
  )
    errors.push('wrangler.toml is missing creator-dashboard-fetchers queue');
  if (
    !text.includes('dead_letter_queue  = "creator-dashboard-fetcher-dlq"') &&
    !text.includes('dead_letter_queue = "creator-dashboard-fetcher-dlq"')
  )
    errors.push('wrangler.toml is missing creator-dashboard-fetcher-dlq dead-letter binding');
  if (!text.includes('"0 * * * *"')) errors.push('wrangler.toml is missing hourly fetch cron');
  if (!text.includes('"0 4,5 * * *"')) errors.push('wrangler.toml is missing Vienna digest cron');
  return { errors };
}

async function main(): Promise<void> {
  const wrangler = await readFile('wrangler.toml', 'utf8');
  const errors = parseWranglerPreflight(wrangler).errors;
  const missingSecrets = requiredProductionSecrets().filter((name) => !process.env[name]);
  for (const secret of missingSecrets) errors.push(`missing production env var ${secret}`);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  console.log('deploy preflight passed');
}

if (process.argv[1]?.endsWith('deploy-preflight.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Update package scripts**

Modify `package.json` scripts:

```json
{
  "deploy:preflight": "node --experimental-strip-types scripts/deploy-preflight.ts",
  "deploy:worker": "pnpm migrate:remote && pnpm build && wrangler deploy",
  "sync-posts:remote": "node --experimental-strip-types scripts/sync-posts.ts --execute-remote",
  "deploy": "pnpm deploy:preflight && pnpm deploy:worker && pnpm sync-posts:remote",
  "smoke:ingest": "node --experimental-strip-types scripts/smoke-ingest.ts",
  "smoke:cron": "node --experimental-strip-types scripts/smoke-cron.ts",
  "verify:deploy": "node --experimental-strip-types scripts/verify-deploy.ts"
}
```

Keep existing scripts unchanged unless one of these names already exists.

- [ ] **Step 5: Run tests green**

```bash
pnpm vitest run scripts/deploy-preflight.test.ts
pnpm check
```

Expected: tests pass and check reports 0 errors.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/deploy-preflight.ts scripts/deploy-preflight.test.ts
git commit -m "chore: add deploy preflight checks"
```

---

## Task 4: Add local ingest smoke through refresh endpoint and queue consumer

**Files:**

- Create: `scripts/smoke-ingest.ts`
- Create: `scripts/smoke-ingest.test.ts`
- Modify: `scripts/e2e-server.ts` only if reusable bootstrap extraction is necessary

- [ ] **Step 1: Write failing argument and polling tests**

`scripts/smoke-ingest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSmokeIngestArgs, statusReachedSuccess } from './smoke-ingest';

describe('smoke-ingest helpers', () => {
  it('defaults to a safe public source and local base url', () => {
    expect(parseSmokeIngestArgs([])).toEqual({
      sourceId: 'steam-reviews-erenshor',
      baseUrl: 'http://127.0.0.1:8788',
      timeoutMs: 60_000
    });
  });

  it('accepts explicit source and timeout', () => {
    expect(
      parseSmokeIngestArgs([
        '--source',
        'github-glockyco',
        '--base-url',
        'https://dashboard.glockyco.com',
        '--timeout-ms',
        '5000'
      ])
    ).toEqual({ sourceId: 'github-glockyco', baseUrl: 'https://dashboard.glockyco.com', timeoutMs: 5_000 });
  });

  it('recognizes a successful fetcher status', () => {
    expect(statusReachedSuccess({ last_status: 'success', last_success_at: 123, consecutive_failures: 0 })).toBe(true);
    expect(
      statusReachedSuccess({ last_status: 'permanent_failure', last_success_at: null, consecutive_failures: 1 })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests red**

```bash
pnpm vitest run scripts/smoke-ingest.test.ts
```

Expected: fail because `scripts/smoke-ingest.ts` does not exist.

- [ ] **Step 3: Implement helper exports and HTTP flow**

`scripts/smoke-ingest.ts` should:

1. Parse `--source`, `--base-url`, `--timeout-ms`.
2. Use `e2e/support/access-auth.ts` `accessHeaders()` for local/remote Access-compatible auth.
3. `POST /api/refresh/:source_id`.
4. Poll `/api/sources/:source_id/status` until `last_status === 'success' && last_success_at != null && consecutive_failures === 0`.
5. Print sanitized result and exit non-zero on timeout/failure.

Implementation outline:

```ts
import { accessHeaders } from '../e2e/support/access-auth';

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

async function main(): Promise<void> {
  const args = parseSmokeIngestArgs(process.argv.slice(2));
  const headers = await accessHeaders();
  await postRefresh(args, headers);
  const status = await pollStatus(args, headers);
  console.log(`ingest smoke ok ${args.sourceId}: last_success_at=${status.last_success_at}`);
}
```

- [ ] **Step 4: Run helper tests green**

```bash
pnpm vitest run scripts/smoke-ingest.test.ts
```

Expected: pass.

- [ ] **Step 5: Run local ingest smoke manually**

In one terminal, start the existing local e2e server:

```bash
node --experimental-strip-types scripts/e2e-server.ts
```

In another terminal:

```bash
pnpm smoke:ingest --source steam-reviews-erenshor --base-url http://127.0.0.1:8788 --timeout-ms 90000
```

Expected:

```text
ingest smoke ok steam-reviews-erenshor: last_success_at=1778420000000
```

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/smoke-ingest.ts scripts/smoke-ingest.test.ts
git commit -m "test: add local ingest smoke"
```

---

## Task 5: Add bounded cron/queue smoke

**Files:**

- Create: `scripts/smoke-cron.ts`
- Create: `scripts/smoke-cron.test.ts`
- Create: `src/routes/api/smoke/hourly/+server.ts`
- Create: `src/routes/api/smoke/hourly/server.test.ts`
- Modify: `src/lib/server/orchestration/dispatcher.ts`
- Modify: `src/lib/server/orchestration/dispatcher.test.ts`
- Modify: `src/lib/server/worker/scheduled.ts`
- Modify: `src/lib/server/worker/scheduled.test.ts`

- [ ] **Step 1: Write failing dispatcher allowlist test**

Add to `src/lib/server/orchestration/dispatcher.test.ts`:

```ts
it('can dispatch only selected sources for smoke verification', async () => {
  const queue = { sendBatch: vi.fn().mockResolvedValue(undefined) };
  const env = { FETCHER_QUEUE: queue } as unknown as Env;

  const count = await dispatchDueSources(env, 123, { sourceIds: ['steam-reviews-erenshor'] });

  expect(count).toBe(1);
  expect(queue.sendBatch).toHaveBeenCalledWith([
    { body: { source_id: 'steam-reviews-erenshor', dispatch_ts: 123, force: false } }
  ]);
});
```

- [ ] **Step 2: Run dispatcher test red**

```bash
pnpm vitest run src/lib/server/orchestration/dispatcher.test.ts
```

Expected: fail because `dispatchDueSources` has no options parameter.

- [ ] **Step 3: Add optional dispatch allowlist**

Change `dispatchDueSources` signature:

```ts
export async function dispatchDueSources(
  env: Env,
  now = Date.now(),
  options: { sourceIds?: string[] } = {}
): Promise<number> {
  const allowed = options.sourceIds ? new Set(options.sourceIds) : null;
  const dueSources = allowed ? sources.filter((source) => allowed.has(source.id)) : sources;
  const messages = dueSources.map((source) => ({
    body: { source_id: source.id, dispatch_ts: now, force: false } satisfies JobMsg
  }));
  if (messages.length > 0) await env.FETCHER_QUEUE.sendBatch(messages);
  log('info', 'dispatched source jobs', { enqueued: messages.length });
  return messages.length;
}
```

- [ ] **Step 4: Add smoke cron script tests**

`scripts/smoke-cron.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSmokeCronArgs } from './smoke-cron';

describe('smoke-cron args', () => {
  it('defaults to hourly cron and safe source', () => {
    expect(parseSmokeCronArgs([])).toEqual({
      sourceId: 'steam-reviews-erenshor',
      baseUrl: 'http://127.0.0.1:8788',
      timeoutMs: 60_000
    });
  });
});
```

- [ ] **Step 5: Implement smoke cron script**

`scripts/smoke-cron.ts` uses a smoke-only route `src/routes/api/smoke/hourly/+server.ts`. The route checks `platform.env.SMOKE_ENDPOINTS_ENABLED === 'true'`, calls `dispatchDueSources(platform.env, Date.now(), { sourceIds: [sourceId] })`, and returns `{ enqueued }`. The script calls that route with one source ID, then reuses the status polling logic from `scripts/smoke-ingest.ts` to confirm the queue consumer persists success. Production deploys leave `SMOKE_ENDPOINTS_ENABLED` unset, so the route returns 404 outside local/explicit smoke runs.

- [ ] **Step 6: Run targeted tests and local smoke**

```bash
pnpm vitest run src/lib/server/orchestration/dispatcher.test.ts src/lib/server/worker/scheduled.test.ts scripts/smoke-cron.test.ts
pnpm smoke:cron --source steam-reviews-erenshor --base-url http://127.0.0.1:8788 --timeout-ms 90000
```

Expected: tests pass; local cron smoke reports success and no digest/DLQ alert path is invoked.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/orchestration/dispatcher.ts src/lib/server/orchestration/dispatcher.test.ts src/lib/server/worker/scheduled.ts src/lib/server/worker/scheduled.test.ts scripts/smoke-cron.ts scripts/smoke-cron.test.ts package.json
git commit -m "test: add bounded cron queue smoke"
```

---

## Task 6: Remote resource provisioning and configuration

**Files:**

- Modify: `wrangler.toml`
- Modify: `.dev.vars.example` only if a new smoke-only flag is introduced
- No secrets committed

- [ ] **Step 1: Create or verify remote D1**

Run only with user approval because this modifies Cloudflare account state:

```bash
pnpm exec wrangler d1 create creator-dashboard
```

Copy the returned UUID into `wrangler.toml`; the value below is an example shape:

```toml
[[d1_databases]]
binding       = "DB"
database_name = "creator-dashboard"
database_id   = "11111111-1111-1111-1111-111111111111"
```

- [ ] **Step 2: Create or verify queues**

Run only with user approval:

```bash
pnpm exec wrangler queues create creator-dashboard-fetchers
pnpm exec wrangler queues create creator-dashboard-fetcher-dlq
```

If Wrangler reports either queue already exists, keep the existing queue.

- [ ] **Step 3: Upload production secrets**

For each secret from `requiredProductionSecrets()`, run:

```bash
pnpm exec wrangler secret put SECRET_NAME
```

Do not upload `GA4_PROPERTY_ID` until GA4 is enabled.

- [ ] **Step 4: Run preflight**

```bash
pnpm deploy:preflight
```

Expected:

```text
deploy preflight passed
```

- [ ] **Step 5: Commit config**

```bash
git add wrangler.toml .dev.vars.example package.json
git commit -m "chore: configure cloudflare deploy resources"
```

---

## Task 7: Remote deploy and post-deploy verification

**Files:**

- Create: `scripts/verify-deploy.ts`
- Create: `scripts/verify-deploy.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write verify-deploy helper tests**

`scripts/verify-deploy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseVerifyDeployArgs } from './verify-deploy';

describe('verify-deploy args', () => {
  it('defaults to production dashboard and safe source', () => {
    expect(parseVerifyDeployArgs([])).toEqual({
      baseUrl: 'https://dashboard.glockyco.com',
      sourceId: 'steam-reviews-erenshor',
      timeoutMs: 120_000
    });
  });
});
```

- [ ] **Step 2: Implement verify-deploy**

`verify-deploy.ts` should:

1. Fetch `/` and `/health` with Access headers and require HTTP 200.
2. POST `/api/refresh/:source_id`.
3. Poll `/api/sources/:source_id/status` until success.
4. Print one success line with source ID and `last_success_at`.

- [ ] **Step 3: Run remote deployment sequence**

```bash
pnpm deploy:preflight
pnpm migrate:remote
pnpm build
pnpm exec wrangler deploy
pnpm verify:deploy --source steam-reviews-erenshor --base-url https://dashboard.glockyco.com --timeout-ms 120000
pnpm sync-posts
```

Expected:

```text
verify deploy ok steam-reviews-erenshor: last_success_at=1778420000000
```

- [ ] **Step 4: Tail logs and manually inspect Access/UI**

```bash
pnpm exec wrangler tail creator-dashboard
```

Manual checks:

```text
Access login succeeds with GitHub OAuth
Dashboard, Health, Posts, Timeline, Settings load
Manual refresh updates Health for a safe source
No unexpected Discord digest, permanent-failure alert, or DLQ alert was sent
```

- [ ] **Step 5: Commit verification script**

```bash
git add package.json scripts/verify-deploy.ts scripts/verify-deploy.test.ts
git commit -m "test: add post deploy verification"
```

---

## Final verification for this deploy-readiness batch

Run after Tasks 1-6:

```bash
pnpm vitest run
pnpm check
pnpm playwright test e2e/settings.spec.ts e2e/mobile.spec.ts e2e/timeline.spec.ts --project=chromium
pnpm deploy:preflight
pnpm smoke:public
pnpm smoke:connectors --source github-glockyco --source gsc-ak-compendium-org --source bing-ak-compendium-org --source cf-analytics-ak-compendium --strict
pnpm smoke:ingest --source steam-reviews-erenshor --base-url http://127.0.0.1:8788 --timeout-ms 90000
pnpm smoke:cron --source steam-reviews-erenshor --base-url http://127.0.0.1:8788 --timeout-ms 90000
```

Expected:

```text
unit/check/e2e pass
preflight passes
connector smoke passes or returns ok 0 metric points for newly indexed AK .org sources
ingest smoke reaches success
cron smoke reaches success without digest/DLQ side effects
```
