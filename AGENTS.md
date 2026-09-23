# Creator Dashboard

Single-tenant SvelteKit app on Cloudflare Workers, fronted by Cloudflare Access. D1 storage, queue + hourly fetcher cron. Production: `https://dashboard.glockyco.com`. The product surfaces are Overview, Activity, and Issues; GitHub, Search Console, and Cloudflare Analytics are native links, not collectors.

## Setup

- `pnpm install`
- Populate `.dev.vars` from `.dev.vars.example`. Cloudflare's secret store is write-only (`wrangler secret list` returns names only); if `.dev.vars` is lost, recover from source-of-truth consoles.
- `pnpm dev:setup` — migrate and seed the local D1. Required before `pnpm dev` returns anything but 500s.

## Dev loop

- `pnpm dev` — Vite HMR. `src/hooks.server.ts` skips the Access JWT under `$app/environment#dev`; the production bundle always validates.
- `pnpm preview:local` — Full `workerd` + JWKS + auth-injecting proxy, no HMR. Use when changing auth, queues, or platform-specific behavior.
- When an agent starts a long-running development process, it must use the process supervisor and stop that same process by its handle. `pnpm kill:dev` is for manual recovery only. Do not use it for routine cleanup because it searches global workstation processes.
- `pnpm dev` and `pnpm migrate:local` share `.wrangler/state/v3`. `pnpm preview:local` uses `.tmp/preview-wrangler` instead — they do not share data.

## Tests

- `pnpm test`, `pnpm check`, `pnpm lint`. Run only tests you touched unless asked.
- D1 is mocked with a `{ prepare, bind, all, first }` stub; see `src/lib/performance/server.test.ts` and `src/lib/server/incidents/model.test.ts`. Do not spin up real `wrangler d1` from unit tests.
- E2E (`pnpm test:e2e`) authenticates via `e2e/support/access-auth.ts` against the preview-local JWKS — needs the preview harness running.

## Deploy

- `pnpm run deploy` runs preflight → `migrate:remote` → build → `wrangler deploy`. Preflight requires every key in `.dev.vars.example` set locally. Back up D1 and rehearse destructive migrations on a copy before deploying. (`pnpm deploy` is shadowed by pnpm's built-in deploy command — use `pnpm run deploy`.)
- `pnpm deploy:worker` skips preflight.
- Migrations are append-only. Never edit `migrations/0001_initial_schema.sql`; add `migrations/000N_*.sql`.

## Layout

- `src/routes/` — SvelteKit routes; `+page.server.ts` loaders, `+server.ts` endpoints.
- `src/lib/server/` — D1 access lives **only** here. Never touch D1 from `.svelte` files or client modules.
- `src/lib/sources/registry-data.ts` — retained collection source registry; native destinations are not sources.
- `src/lib/connectors/fetchers/<source>.ts` — one fetcher per retained source, paired with fixtures and tests.
- `src/lib/server/orchestration/` — cron → dispatcher → `FETCHER_QUEUE` → consumer → persist and incident transitions.
- `src/lib/server/performance.ts`, `activity.ts`, `incidents/` — focused D1 read models; cumulative gains require eligible baseline captures.

## Conventions

- Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`). Do not reintroduce `export let` or `<script>`-level `let` reactivity.
- LF line endings repo-wide via `.gitattributes`. The dev machine has `core.autocrlf=true` globally, so check `git ls-files --eol` if anything content-hash-sensitive breaks.
- Conventional Commits per `skill://commit`. Never push without explicit user request.
