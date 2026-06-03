# GitHub Token — OAuth App Migration Design Spec

> **Status:** Approved design, pre-implementation (2026-06-03).
> **Scope:** Replace the expiring classic PAT used by the `github-glockyco` connector with a non-expiring OAuth App user token, preserving the contributions graph (private activity included) byte-for-byte.

---

## 0. Problem

The classic personal access token `creator-dashboard` (`public_repo`, `read:user`) authenticates the hourly `github-glockyco` connector against the GitHub GraphQL API. GitHub emailed a 6-day expiry warning. Classic PATs cannot be auto-renewed or extended — regeneration is a manual web action with a fixed new expiry, so the fire drill recurs on every cycle. A lapsed token makes the hourly fetcher fail with `401` and silently stops collecting GitHub metrics.

Goal: eliminate the expiry/rotation problem permanently **without changing what data is collected** — specifically, the contributions sparkline must keep counting **private** contributions exactly as today.

## 1. Decision

Use a **GitHub OAuth App user token** carrying the classic `read:user` scope.

### 1.1 Why (the binding constraint)

Private contributions in the GraphQL `contributionsCollection` are included **only** with the classic `read:user` scope. Of the credential types that carry classic scopes vs. those that self-renew, no single credential offers both:

| Credential | Self-renewing | Private contributions | Posture |
| --- | --- | --- | --- |
| Classic PAT (today) | No — expires, manual regen | Yes (`read:user`) | the problem |
| GitHub App installation token | Yes (1h, minted from private key) | No — App tokens carry no classic scopes (public-only) | least privilege |
| GitHub App user token + refresh | Yes (8h / 6mo refresh) | No — empty scope (public-only) | complex *and* loses private |
| **OAuth App user token (`read:user`)** | **No expiry, no refresh** | **Yes (`read:user`)** | long-lived static, never breaks |

Preserving private contributions is a hard requirement, which forces a `read:user`-scoped credential. Among those, the OAuth App token is the only one that does **not** expire: OAuth App tokens remain valid until revoked, and GitHub auto-revokes only after **one year of non-use**. At an hourly cadence the token is never idle, so it is effectively permanent — the expiry emails stop for good.

It is also strictly better governed than the classic PAT: bound to a dedicated OAuth App (not a raw user PAT), attributable to that app, and revocable per-app.

### 1.2 Why not the alternatives

- **GitHub App (installation or user token):** the modern least-privilege pattern, but App tokens have no classic scopes, so contributions become public-only — fails the hard requirement.
- **Computing contributions ourselves** from per-repo data via an App with repo read: would not reproduce GitHub's official contribution-count algorithm, a fidelity regression, and is a large, fragile change.
- **Classic PAT set to "no expiration":** also non-expiring and preserves data, but a no-expiry raw user PAT is worse hygiene than an app-scoped OAuth token and is explicitly the "hack" we are avoiding.

### 1.3 Evidence

- Private contributions require `read:user`: GitHub GraphQL Users reference (`contributionsCollection`).
- GitHub App user tokens report empty `scope`: GitHub App user-token docs.
- OAuth App tokens have no refresh and do not expire until revoked; 1-year-non-use auto-revoke: "Differences between GitHub Apps and OAuth Apps" and token-expiration docs.
- Device Flow needs only the Client ID (no client secret) for token exchange: GitHub OAuth device-flow docs.

## 2. Architecture

Unchanged at runtime. The Worker reads a single secret and sends it as a bearer token to the existing GraphQL `viewer` query.

```
cron (hourly) -> dispatcher -> FETCHER_QUEUE -> consumer
  -> fetchGithub({ env })
     -> githubHeaders(env)  // Authorization: Bearer <env.GITHUB_TOKEN>
     -> POST https://api.github.com/graphql  { query: viewer { followers, contributionsCollection, repositories } }
     -> metric_points: followers, total_stars, public_repos, contributions[], repo_stars[]
```

The GraphQL query in `src/lib/connectors/fetchers/github.ts` is **not modified**. Because the new token keeps `read:user`, `viewer.contributionsCollection.contributionCalendar` returns the same private-inclusive data as today.

## 3. Changes

### 3.1 Secret rename: `GITHUB_PAT` -> `GITHUB_TOKEN`

The credential is no longer a PAT; the name must not claim otherwise. Rename every reference:

- `src/app.d.ts` — `Env.GITHUB_TOKEN: string`.
- `src/lib/connectors/auth/github.ts` — `githubHeaders` reads `env.GITHUB_TOKEN`; `Pick<Env, 'GITHUB_TOKEN'>`. Bearer logic otherwise unchanged.
- `.dev.vars.example` — `GITHUB_TOKEN=gho_replace` with an updated comment pointing at the mint script and scope.
- `scripts/deploy-preflight.ts` — `requiredProductionSecrets()` entry.
- `scripts/smoke-connectors.ts` — `secretRequirements()` (`github-` -> `['GITHUB_TOKEN']`).
- `scripts/capture-fixture.ts` — fixture-capture source reads `GITHUB_TOKEN`.
- Tests: `github.test.ts`, `smoke-connectors.test.ts`, `deploy-preflight.test.ts`, and `capture-fixture.test.ts` env/expectation references.

The redaction patterns in `capture-fixture.ts` already cover `gho_`-style secrets via the `ghp_`/bearer regexes; verify `gho_` is redacted (extend the pattern to `gh[a-z]_` if not).

### 3.2 Mint script: `scripts/github-oauth-authorize.ts`

A device-flow CLI that produces the `gho_` token reproducibly (parallels how the Google OAuth refresh token is provisioned out-of-band):

1. `POST https://github.com/login/device/code` with `client_id` + `scope` -> `user_code`, `verification_uri`, `device_code`, `interval`.
2. Print the `user_code` and `verification_uri`; the operator authorizes in a browser.
3. Poll `POST https://github.com/login/oauth/access_token` with `client_id`, `device_code`, `grant_type=urn:ietf:params:oauth:grant-type:device_code` until an `access_token` is returned (handle `authorization_pending` / `slow_down`).
4. Print the resulting `gho_` token and its granted scopes for the operator to place into `.dev.vars` and `wrangler secret put GITHUB_TOKEN`.

Design notes:

- **Client ID is not a Worker secret.** It is passed as a CLI argument (`--client-id`) or read from an optional `GITHUB_OAUTH_CLIENT_ID` env; it is **not** added to `.dev.vars.example`/`requiredProductionSecrets`, because the Worker never needs it. The OAuth App must have Device Flow enabled.
- Pure Node (`node --experimental-strip-types`), consistent with the other `scripts/*.ts`. No new dependencies.
- The script only prints the token; it never writes secrets to disk automatically.
- Add a `scripts/github-oauth-authorize.test.ts` covering the pollable response parsing (`authorization_pending`, `slow_down`, success, error) with mocked `fetch`, matching the existing script test style.

### 3.3 Scope: request `read:user` only, verify public-repo metrics

The classic PAT carried `public_repo` (which grants *write* to public repos) — unnecessary for reads. The mint script requests `read:user` only. During implementation, verify via `pnpm smoke:authenticated` that `total_stars`, `public_repos`, and `repo_stars` (from `viewer.repositories(privacy: PUBLIC, ownerAffiliations: OWNER)`) still resolve with `read:user` alone. If repo enumeration requires it, add `public_repo` back. Net outcome: identical data with equal-or-tighter scope.

### 3.4 Docs

- `.dev.vars.example` comment block describing the OAuth token, the mint script, and the scope.
- A short note in `AGENTS.md` (Conventions/Setup) on the GitHub OAuth App + mint script as the source-of-truth recovery path for `GITHUB_TOKEN`.

## 4. Error handling

Unchanged. `fetchGithub` still throws `FetchError` on non-2xx (incl. `401`) and `ZodError` on shape mismatch. There is no expiry branch to add. If the token is ever revoked (manual revoke, leak detection), the operator re-runs the mint script and updates the secret — the same recovery path as any secret loss noted in `AGENTS.md`.

## 5. Testing & verification

- **Unit:** existing `github.test.ts` (asserts followers / total_stars / contributions / repo metrics and the `401 -> FetchError` path) carries over under `GITHUB_TOKEN`; new `github-oauth-authorize.test.ts` covers device-flow polling.
- **Suite gates:** `pnpm test`, `pnpm check`, `pnpm lint` over the changed files.
- **Live parity:** `pnpm smoke:authenticated` against the connector with the freshly minted token; confirm the contributions calendar total — **including private contributions** — matches the dashboard value observed before the change. This is the acceptance check for the hard requirement.

## 6. Rollout / cutover

1. Operator creates the OAuth App (Device Flow enabled), notes the Client ID.
2. Run `scripts/github-oauth-authorize.ts --client-id <id>`; authorize; capture the `gho_` token.
3. Verify scope sufficiency with `pnpm smoke:authenticated` locally (decide `read:user` vs `+public_repo`).
4. `wrangler secret put GITHUB_TOKEN` (production) and update local `.dev.vars`; the old `GITHUB_PAT` secret can be deleted after deploy.
5. Deploy; confirm the next hourly run records GitHub metrics and the contributions graph is unchanged.
6. Revoke the old classic PAT.

Clean cutover: the rename and the secret swap land together; no dual-credential interim, no back-compat alias for `GITHUB_PAT`.

## 7. Non-goals

- Migrating other connectors' auth.
- Changing the GraphQL query, metrics, or dashboard rendering.
- Adding KV/Durable Object token caching (no minting at runtime; the OAuth token is static).
