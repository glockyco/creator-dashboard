# Creator Dashboard

Single-tenant SvelteKit app on Cloudflare Workers, fronted by Cloudflare Access. D1 storage, queue + hourly fetcher cron. Production: `https://dashboard.glockyco.com`. The product surfaces are Overview, Activity, and Issues; GitHub, Search Console, and Cloudflare Analytics are native links, not collectors.

## Setup

- `flake.nix` pins Node and pnpm. `.envrc` enters that shell through direnv and exports the Workers deploy token with `use cloudflare_workers`; without direnv, run `nix develop` and authenticate Wrangler yourself. Every command below assumes the shell. `.github/workflows/ci.yml` pins Node separately; keep both in step.
- `pnpm install`
- Populate `.dev.vars` from `.dev.vars.example`. Local scripts read it: the Steam key for connector smoke runs and fixture capture, and the Access service token for `verify:deploy`. Local preview and e2e blank the Discord webhook so they never post to the real channel. Cloudflare's secret store is write-only (`wrangler secret list` returns names only); if `.dev.vars` is lost, recover from source-of-truth consoles.
- `pnpm dev:setup` — migrate and seed the local D1. Required before `pnpm dev` returns anything but 500s.

## Dev loop

- `pnpm dev` — Vite HMR. `src/hooks.server.ts` skips the Access JWT under `$app/environment#dev`; the production bundle always validates.
- `pnpm preview:local` — Full `workerd` + JWKS + auth-injecting proxy, no HMR. Use when changing auth, queues, or platform-specific behavior.
- When an agent starts a long-running development process, it must use the process supervisor and stop that same process by its handle. `pnpm kill:dev` is for manual recovery only. Do not use it for routine cleanup because it searches global workstation processes.
- `pnpm dev` and `pnpm migrate:local` share `.wrangler/state/v3`. `pnpm preview:local` uses `.tmp/preview-wrangler` instead — they do not share data.

## Tests

- `pnpm test`, `pnpm check`, `pnpm lint`. Run only tests you touched unless asked.
- `nix flake check` builds the dev shell and validates the OpenSpec artifacts; CI runs the OpenSpec check.
- Unit tests mock D1 with a `{ prepare, bind, all, first }` stub. Tests whose SQL matters run it against the real migrations with `src/lib/server/db/test-d1.ts`, an in-memory SQLite stand-in. Do not spin up real `wrangler d1` from unit tests.
- E2E (`pnpm test:e2e`) authenticates via `e2e/support/access-auth.ts` against the preview-local JWKS — needs the preview harness running.

## Deploy

- `pnpm run deploy` runs preflight, then `check`, `test`, and `build`, and only then `migrate:remote` and `wrangler deploy`. Preflight requires a clean working tree and checks that the Worker's secret names match exactly what the code reads. (`pnpm deploy` is shadowed by pnpm's built-in deploy command, so use `pnpm run deploy`.)
- `pnpm deploy:worker` skips preflight.
- Before a destructive migration, back up D1 with `wrangler d1 export creator-dashboard --remote --output <file>` and rehearse on a copy: `wrangler d1 execute creator-dashboard --local --persist-to <dir> --file <file>`.
- After deploying, `pnpm verify:deploy` loads Overview, Activity, and Issues through Access with the service token in `.dev.vars`. It checks only that the pages render.
- Migrations are append-only. Never edit `migrations/0001_initial_schema.sql`; add `migrations/000N_*.sql`.

## Collectors

- To add a source: add a record to `src/lib/sources/registry-data.ts`, add or reuse a fetcher in `src/lib/connectors/fetchers/` following `src/lib/connectors/README.md`, and give it a fixture and tests. Check it against the live upstream with `pnpm smoke:connectors --source <id> --strict`.
- `node --experimental-strip-types scripts/capture-fixture.ts <connector> --source-id <id>` records a live response as the connector's fixture. It redacts only emails, Steam IDs, and bearer tokens, so trim the result and review it for other personal data before committing.
- After a collection gap longer than a collector's lookback window, `pnpm backfill:events --source <id> --set lookbackDays=<n>` writes the missed events to `.tmp/backfill-events.sql` as `INSERT OR IGNORE` statements. Apply them with `wrangler d1 execute creator-dashboard --remote --file .tmp/backfill-events.sql`.

## Layout

- `src/routes/` — SvelteKit routes; `+page.server.ts` loaders, `+server.ts` endpoints.
- `src/lib/server/` — D1 access lives **only** here. Never touch D1 from `.svelte` files or client modules.
- `src/lib/sources/registry-data.ts` — retained collection source registry; native destinations are not sources.
- `src/lib/connectors/fetchers/<source>.ts` — one fetcher per retained source, paired with fixtures and tests.
- `src/lib/server/orchestration/` — cron → dispatcher → `FETCHER_QUEUE` → consumer → persist and incident transitions.
- `src/lib/server/performance.ts`, `activity.ts`, `incidents/` — focused D1 read models; cumulative gains require eligible baseline captures.

## Conventions

- Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`). Do not reintroduce `export let` or `<script>`-level `let` reactivity.
- LF line endings repo-wide via `.gitattributes`; check `git ls-files --eol` if anything content-hash-sensitive breaks.
- Conventional Commits per `skill://commit-policy`. Never push without explicit instruction.
