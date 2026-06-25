---
title: "Local preview workflow plan"
type: plan
status: implemented
created: 2026-05-11
parent:
superseded_by:
archived: 2026-06-25
---

# Local preview workflow plan

## Goal

Add a one-command local manual preview workflow for the Creator Dashboard so the UI can be inspected before deployment without hand-running Wrangler, generating local Access tokens, or pasting headers into a browser.

Target command:

```bash
pnpm preview:local
```

The command should build the Worker, start a fully local Cloudflare-like runtime, seed deterministic local data, open a browser, and keep running until interrupted.

## Current state

- Existing redesign work is committed as `5041929 Redesign creator dashboard cockpit`.
- The commit message was amended to remove test/verification notes and follow Chris Beams' guidance: short imperative subject, blank line before the body, and body focused on what and why rather than command output.
- `scripts/e2e-server.ts` already has most of the required mechanics:
  - creates a local RS256 keypair;
  - writes local Access config to `.tmp/e2e-access.json`;
  - starts a JWKS server on `127.0.0.1:8790`;
  - resets and migrates local D1 under `.tmp/e2e-wrangler`;
  - seeds posts, events, and metric rows;
  - starts `wrangler dev` on `127.0.0.1:8788` with `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ACCESS_JWKS_URL`, and `SMOKE_ENDPOINTS_ENABLED:true`.
- Normal browser requests to `http://127.0.0.1:8788` return `401` because `src/hooks.server.ts` validates `Cf-Access-Jwt-Assertion` for every request.
- Playwright tests solve that by calling `accessHeaders()` from `e2e/support/access-auth.ts`, but that is too much ceremony for manual preview.

## Design

### User-facing workflow

Run:

```bash
pnpm preview:local
```

Expected output:

```text
Building dashboard worker...
Preparing local D1 preview database...
Starting local Access JWKS on http://127.0.0.1:8790/jwks
Starting Wrangler worker on http://127.0.0.1:8788
Starting authenticated preview proxy on http://127.0.0.1:8791
Opening http://127.0.0.1:8791
Press Ctrl+C to stop local preview.
```

The user opens or is taken to `http://127.0.0.1:8791`. The proxy injects a locally signed Access JWT when forwarding requests to Wrangler. The Worker still performs real JWT verification against the local JWKS endpoint, so this is not an auth bypass.

### Why use a local proxy instead of a Playwright browser

A Playwright-launched browser with `extraHTTPHeaders` is the shortest implementation, but it locks manual preview into a special browser process and still leaves `http://127.0.0.1:8788` unusable from the user's normal browser.

A localhost-only proxy gives a better manual UX:

- the user gets one normal URL;
- the fake Access JWT is injected only for local Worker requests;
- external links still behave like normal browser navigation;
- the production auth path remains exercised because the Worker verifies the JWT.

### Command naming

Add this package script:

```json
"preview:local": "pnpm build && node --experimental-strip-types scripts/preview-local.ts"
```

Do not overload existing `preview`, which currently means Vite preview and does not exercise Worker platform bindings, D1, Queues, or Access verification. Do not use `pnpm deploy`; pnpm 10 reserves that word for its own command.

No `.tmp` paths should appear in `package.json`. Scratch paths stay inside TypeScript.

## Implementation steps

### 1. Extract reusable local harness code

Create `scripts/local-preview/harness.ts` with reusable functions currently embedded in `scripts/e2e-server.ts`:

- `createAccessFixture(options)`
  - generate RS256 keypair;
  - write Access fixture JSON;
  - return issuer, audience, kid, JWKS, and paths.
- `startJwksServer({ host, port, jwks })`
  - serve only `/jwks`;
  - return a `stop()` function.
- `resetAndSeedD1({ persistPath, seedPath, seedSql })`
  - remove previous local persistence for clean deterministic preview;
  - apply local migrations;
  - execute seed SQL.
- `buildWranglerDevArgs(options)`
  - return the existing `wrangler dev` args, including local Access vars.
- `startWranglerDev(options)`
  - spawn `pnpm exec wrangler dev`;
  - return process handle and stop function.
- `waitForHttp(url, timeoutMs)`
  - poll until the Worker/proxy is reachable;
  - fail with a useful message instead of hanging.
- `assertPortsAvailable(ports)`
  - check `8788`, `8790`, and `8791` before mutating `.tmp`;
  - do not kill unknown processes automatically.

Keep the module internal to scripts. Do not import it from app code.

### 2. Preserve Playwright behavior

Rewrite `scripts/e2e-server.ts` as a thin entrypoint over the shared harness:

- use the same ports and paths currently used by Playwright:
  - Worker: `8788`
  - JWKS: `8790`
  - Access fixture: `.tmp/e2e-access.json`
  - Wrangler persistence: `.tmp/e2e-wrangler`
  - seed SQL: `.tmp/e2e-seed.sql`
- keep the same deterministic seed rows so existing e2e tests continue to pass;
- keep process lifetime behavior: the script stays alive while Wrangler is alive and shuts down on `SIGINT`/`SIGTERM`.

This step should be behavior-preserving for `pnpm test:e2e`.

### 3. Add manual preview script

Create `scripts/preview-local.ts`.

Defaults:

```ts
type PreviewLocalArgs = {
  workerPort: number; // 8788
  jwksPort: number; // 8790
  proxyPort: number; // 8791
  open: boolean; // true
  reset: boolean; // true
};
```

Supported flags:

- `--no-open` prints the URL but does not open a browser.
- `--no-reset` reuses the local preview D1 persistence instead of clearing it.
- `--worker-port <port>` overrides 8788.
- `--jwks-port <port>` overrides 8790.
- `--proxy-port <port>` overrides 8791.

The script should:

1. assert required ports are available;
2. create `.tmp/preview-access.json`;
3. reset/migrate/seed `.tmp/preview-wrangler` unless `--no-reset` is passed;
4. start local JWKS;
5. start Wrangler dev with local Access vars;
6. start an authenticated proxy on `127.0.0.1:<proxyPort>`;
7. open the proxy URL using the OS default browser when `open` is true;
8. print the URL and shutdown instruction;
9. cleanly stop child processes and servers on `SIGINT`/`SIGTERM`.

### 4. Implement authenticated proxy

Add proxy logic inside `scripts/preview-local.ts` or `scripts/local-preview/proxy.ts`.

Behavior:

- listen only on `127.0.0.1`;
- for each incoming request, sign a short-lived local Access JWT or reuse one that expires soon enough for manual preview;
- forward method, URL path, query string, headers, and body to `http://127.0.0.1:<workerPort>`;
- set/replace `Cf-Access-Jwt-Assertion` on the forwarded request;
- stream the Worker response back to the browser;
- strip hop-by-hop headers such as `connection`, `transfer-encoding`, and `upgrade` where needed;
- no remote host forwarding; the upstream is always the local Worker.

This keeps production auth verification active while making manual browser use trivial.

### 5. Improve preview seed data

Keep current e2e seed data as the shared baseline. Add manual-preview-only rows so the redesigned UI is realistic:

- `fetcher_runs` rows:
  - one healthy source;
  - one never-successful source;
  - one permanent failure or retrying source;
- `fetcher_failures` rows for the failing source;
- `alerts_sent` row if the alerts table exists;
- enough aggregate `metric_points` to show sparklines;
- at least one event with a URL and one without a URL;
- existing post seed row linked to a source.

Do not seed real secrets or call live connectors. Manual refresh can still enqueue real fetcher work if clicked; the preview script should print a note that refresh buttons exercise the local Worker path and may need local secrets for authenticated connectors.

### 6. Add focused tests

Add unit tests for script helpers, not browser automation:

- `scripts/preview-local.test.ts`
  - `parsePreviewLocalArgs()` defaults;
  - flag parsing and invalid args;
  - proxy header injection builds the expected upstream request shape using a fake signer/fetcher;
  - `buildWranglerDevArgs()` includes local Access vars and does not contain secrets.
- Update or add `scripts/e2e-server.test.ts` only if extracting harness changes observable helper behavior.

Do not add broad e2e coverage for manual preview. The existing mobile e2e test already checks that the local harness serves pages with Access headers.

### 7. Documentation

Add a short section to the existing deploy-readiness or dashboard plan docs, not a new general README unless requested:

```bash
pnpm preview:local
```

Mention:

- it is for manual UI inspection;
- it uses local D1 seed data;
- it does not deploy;
- it does not bypass Access verification;
- use Ctrl+C to stop;
- use `--no-open` if the browser should not be launched.

## Commit plan

Use atomic commits and Chris Beams style commit bodies. Do not include verification command output in commit messages.

Suggested commits:

1. `Extract local preview harness`

   Body: explain that e2e already knew how to create local Access, JWKS, D1, and Wrangler state, and extracting it avoids duplicating that setup for manual preview.

2. `Add authenticated local preview command`

   Body: explain that normal browsers cannot hit the protected Worker without an Access assertion, so the preview command provides a localhost proxy that preserves Worker-side JWT verification while giving the user one URL.

3. `Seed local preview operations data`

   Body: explain that the redesigned cockpit needs realistic healthy, failed, and never-run states to be useful before deployment.

4. `Document local preview workflow`

   Body: explain when to use `pnpm preview:local` and what it does not do.

If implementation is small enough, commits 2 and 3 can be combined. Do not squash unrelated harness extraction with documentation.

## Verification before completion

Run only commands that prove the changed workflow works:

```bash
pnpm test scripts/preview-local.test.ts
pnpm test:e2e e2e/mobile.spec.ts
pnpm check
```

Then run the manual command once with `--no-open` and verify that it prints the preview URL and can serve the dashboard through the proxy:

```bash
pnpm preview:local -- --no-open
```

In another terminal, fetch the proxy URL headers or use a browser manually. Stop with Ctrl+C.

## Risks and mitigations

- **Port collisions:** fail clearly and do not kill unknown processes.
- **Auth bypass regression:** do not change `hooks.server.ts`; inject a JWT and keep Worker-side verification active.
- **Secret leakage:** use generated local keys only; do not read or print `.dev.vars`.
- **Live side effects:** default preview seed must not call live connectors. Warn that clicking manual refresh exercises connector paths.
- **E2E behavior drift:** keep `scripts/e2e-server.ts` as a thin compatibility wrapper using the same defaults.
- **Proxy correctness:** keep upstream hardcoded to loopback Worker and strip hop-by-hop headers.
