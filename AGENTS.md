# Creator Dashboard

Single-tenant SvelteKit app on Cloudflare Workers, fronted by Cloudflare Access. D1 storage, queue + cron fetcher orchestration. Production: `https://dashboard.glockyco.com`. Crons: hourly platform/event fetchers, `0 4,5 * * *` daily analytics.

## Setup

- `pnpm install`
- Populate `.dev.vars` from `.dev.vars.example`. Cloudflare's secret store is write-only (`wrangler secret list` returns names only); if `.dev.vars` is lost, recover from source-of-truth consoles.
- `pnpm dev:setup` — migrate and seed the local D1. Required before `pnpm dev` returns anything but 500s.

## Dev loop

- `pnpm dev` — Vite HMR. `src/hooks.server.ts` skips the Access JWT under `$app/environment#dev`; the production bundle always validates.
- `pnpm preview:local` — Full `workerd` + JWKS + auth-injecting proxy, no HMR. Use when changing auth, queues, or platform-specific behavior.
- `pnpm kill:dev` — Reap stale `vite` / `wrangler` / `workerd` / `miniflare` children on ports 5173–5180 and 8787–8791. Run after backgrounding a dev server from a non-interactive shell; the npm wrappers do not propagate SIGTERM.
- `pnpm dev` and `pnpm migrate:local` share `.wrangler/state/v3`. `pnpm preview:local` uses `.tmp/preview-wrangler` instead — they do not share data.

## Tests

- `pnpm test`, `pnpm check`, `pnpm lint`. Run only tests you touched unless asked.
- D1 is mocked with a `{ prepare, bind, all, first }` stub; canonical shape in `src/lib/server/dashboard.test.ts`. Do not spin up real `wrangler d1` from unit tests.
- E2E (`pnpm test:e2e`) authenticates via `e2e/support/access-auth.ts` against the preview-local JWKS — needs the preview harness running.

## Deploy

- `pnpm deploy` runs preflight → `migrate:remote` → build → `wrangler deploy` → `sync-posts:remote`. Preflight requires every key in `.dev.vars.example` set locally.
- `pnpm deploy:worker` skips preflight.
- Migrations are append-only. Never edit `migrations/0001_initial_schema.sql`; add `migrations/000N_*.sql`.

## Layout

- `src/routes/` — SvelteKit routes; `+page.server.ts` loaders, `+server.ts` endpoints.
- `src/lib/server/` — D1 access lives **only** here. Never touch D1 from `.svelte` files or client modules.
- `src/lib/sources/{registry-data,metrics}.ts` — source registry and per-source metric/event config.
- `src/lib/connectors/fetchers/<source>.ts` — one fetcher per source, paired with `*.fixture.json` + `*.test.ts`.
- `src/lib/server/orchestration/` — cron → dispatcher → `FETCHER_QUEUE` → consumer → persist.
- `src/lib/dashboard/delta.ts` — 24h-prior comparison with ±12h tolerance. All dashboard tiles and the digest go through it.

## Conventions

- Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`). Do not reintroduce `export let` or `<script>`-level `let` reactivity.
- LF line endings repo-wide via `.gitattributes`. The dev machine has `core.autocrlf=true` globally, so check `git ls-files --eol` if anything content-hash-sensitive breaks.
- Conventional Commits per `skill://commit`. Never push without explicit user request.
