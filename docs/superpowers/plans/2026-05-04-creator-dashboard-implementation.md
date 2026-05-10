# Creator Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use skill://superpowers:subagent-driven-development (recommended) or skill://superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the private single-user Creator Dashboard that aggregates metrics, content events, and Johann's own posts across the approved source registry, with a timeline correlation view and scheduled collection on Cloudflare.

**Architecture:** One SvelteKit 2 / Svelte 5 app deployed as a Cloudflare Worker, protected by Cloudflare Access and verified again inside the Worker with `jose`. Cloudflare Cron fans out source jobs to Queues; queue consumers run pure HTTP connectors and persist idempotently to D1. Posts remain markdown in the repo with deploy-time D1 metadata sync.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS 4 Vite plugin, Cloudflare Workers, D1, Queues, Cron Triggers, Wrangler, Zod 4, jose, Vitest, Playwright, Observable Plot, gray-matter.

---

## Implementation guardrails

- Keep the design spec uncommitted unless Johann explicitly asks to commit it.
- Do not deploy automatically from CI. `pnpm deploy` remains manual.
- Do not add public routes. All HTTP routes go through Cloudflare Access and Worker-side JWT verification.
- Do not write connector code that touches D1. Connectors are pure: HTTP response -> Zod parse -> `FetcherOutput`.
- Do not use `Promise.all` inside connectors; use sequential `await` loops to respect the Worker six-connection limit.
- Do not perform live API calls in unit tests. Use hand-curated fixtures and synthetic error responses.
- Do not backfill point-in-time sources: GitHub scalar values, Steam guide stats, Thunderstore totals, and recent changes start collecting when Phase 3 deploys.
- Use Vienna time (`Europe/Vienna`) for daily digest anchoring and "today" boundaries.
- Use `X-Requested-With: XMLHttpRequest` on dashboard `fetch()` calls so expired Access sessions surface as 401 rather than hidden 302 redirects.
- Commit after each task with a lowercase conventional-commit subject, for example `feat: add access jwt verification`.

## Design corrections encoded in this plan

These are implementation-level corrections discovered while converting the approved design into executable work. They preserve the architecture.

1. **SvelteKit Worker wrapper:** The deployed Worker uses `.svelte-kit/cloudflare/worker.js`, generated from `scripts/write-worker-wrapper.ts`. Task 1 creates a fetch-only wrapper so `pnpm build` works immediately; Task 5 extends it to export source-controlled `scheduled` and `queue` handlers.
2. **Cloudflare Queue `send()` body shape:** `Queue.send(body)` takes the message body directly. Only `sendBatch()` uses items shaped as `{ body }`.
3. **Phase 2 no-fetcher acceptance:** Phase 2 proves orchestration with injected test fetchers and an empty production source registry. Phase 3 enables Tier 1 sources.
4. **Posts sync shared code:** The runtime posts loader may use Vite `import.meta.glob`, but the Node deploy script cannot. Share schema and normalization code; use separate file readers.
5. **Observable Plot rendering:** Implement dashboard sparklines with simple SVG first. For timeline Plot charts, default to client-side Plot rendering unless an explicit Worker-compatible DOM strategy is added and tested.
6. **Daily digest dedupe:** The digest posts to Discord, an external side effect. The `digest_sent` table belongs in the initial schema so the scheduled digest can be enabled later without a schema surprise.
7. **Local secrets:** Use `.dev.vars` for Wrangler local development. Use `.env.local` only if SvelteKit-only tooling needs non-Wrangler variables later.

---

## File structure map

```text
creator-dashboard/
  package.json
  pnpm-lock.yaml
  svelte.config.js
  vite.config.ts
  tsconfig.json
  wrangler.toml
  lefthook.yml
  .gitignore
  .dev.vars.example
  migrations/
    0001_initial_schema.sql
  posts/
    .gitkeep
  scripts/
    write-worker-wrapper.ts
    sync-posts.ts
    capture-fixture.ts
    backfill-gsc.ts
    backfill-ga4.ts
    backfill-bing.ts
    backfill-cf.ts
    backfill/lib/
      env.ts
      sql.ts
      windows.ts
      run.ts
  src/
    app.css
    app.d.ts
    app.html
    hooks.server.ts
    worker.ts
    lib/
      identities.ts
      types/domain.ts
      types/orchestration.ts
      sources/registry.ts
      sources/metrics.ts
      server/
        auth/access.ts
        db/d1.ts
        log.ts
        worker/scheduled.ts
        worker/queue.ts
        orchestration/dispatcher.ts
        orchestration/consumer.ts
        orchestration/persist.ts
        orchestration/errors.ts
        orchestration/dlq.ts
        alerts/discord.ts
        alerts/dedup.ts
        health/queries.ts
        dashboard.ts
        source-detail.ts
        posts.ts
        timeline.ts
      connectors/
        README.md
        errors.ts
        http.ts
        types.ts
        index.ts
        auth/github.ts
        auth/steam.ts
        auth/cloudflare.ts
        auth/bing.ts
        auth/google.ts
        fetchers/index.ts
        fetchers/github.ts
        fetchers/steam-guide.ts
        fetchers/steam-reviews.ts
        fetchers/thunderstore-team.ts
        fetchers/mediawiki-recent-changes.ts
        fetchers/gsc.ts
        fetchers/bing-webmaster.ts
        fetchers/ga4.ts
        fetchers/cf-analytics.ts
      dashboard/types.ts
      posts/schema.ts
      posts/normalize.ts
      posts/loader.ts
      timeline/schema.ts
      timeline/domain.svelte.ts
      digest/types.ts
      digest/query.ts
      digest/format.ts
      digest/vienna.ts
      settings/schema.ts
      settings/store.svelte.ts
      ui/
      components/
    routes/
      +layout.server.ts
      +layout.svelte
      +page.server.ts
      +page.svelte
      health/+page.server.ts
      health/+page.svelte
      sources/[id]/+page.server.ts
      sources/[id]/+page.svelte
      posts/+page.server.ts
      posts/+page.svelte
      posts/[slug]/+page.server.ts
      posts/[slug]/+page.svelte
      timeline/+page.server.ts
      timeline/+page.svelte
      settings/+page.svelte
      api/refresh/[source_id]/+server.ts
      api/sources/[source_id]/status/+server.ts
      api/sources/[source_id]/events/+server.ts
  e2e/
    dashboard-shell.spec.ts
    dashboard-tiles.spec.ts
    source-detail.spec.ts
    posts.spec.ts
    timeline.spec.ts
    settings.spec.ts
    mobile.spec.ts
```

---

## Phase 1: Foundation

### Task 1: Create SvelteKit and Cloudflare project configuration

**Files:**
- Create: `package.json`
- Create: `svelte.config.js`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `wrangler.toml`
- Create: `.gitignore`
- Create: `.dev.vars.example`
- Create: `scripts/write-worker-wrapper.ts`
- Create: `src/app.html`
- Create: `src/app.css`
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/+page.server.ts`
- Create: `src/routes/+page.svelte`

- [ ] **Step 1: Add project manifest**

`package.json`:

```json
{
  "name": "creator-dashboard",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build && node --experimental-strip-types scripts/write-worker-wrapper.ts",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "lint": "prettier --check . && eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "migrate:local": "wrangler d1 migrations apply creator-dashboard --local",
    "migrate:remote": "wrangler d1 migrations apply creator-dashboard --remote",
    "sync-posts": "node --experimental-strip-types scripts/sync-posts.ts",
    "deploy": "pnpm migrate:remote && pnpm build && wrangler deploy && pnpm sync-posts",
    "backfill": "node --experimental-strip-types scripts/backfill-gsc.ts && node --experimental-strip-types scripts/backfill-bing.ts && node --experimental-strip-types scripts/backfill-cf.ts && node --experimental-strip-types scripts/backfill-ga4.ts"
  },
  "dependencies": {
    "@observablehq/plot": "latest",
    "gray-matter": "latest",
    "jose": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "latest",
    "@eslint/js": "latest",
    "@playwright/test": "latest",
    "@types/node": "latest",
    "@sveltejs/adapter-cloudflare": "latest",
    "@sveltejs/kit": "latest",
    "@sveltejs/vite-plugin-svelte": "latest",
    "@tailwindcss/vite": "latest",
    "eslint": "latest",
    "eslint-config-prettier": "latest",
    "eslint-plugin-svelte": "latest",
    "prettier": "latest",
    "prettier-plugin-svelte": "latest",
    "svelte": "latest",
    "svelte-check": "latest",
    "tailwindcss": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest",
    "wrangler": "latest"
  },
  "packageManager": "pnpm@10.0.0"
}
```

- [ ] **Step 2: Configure SvelteKit for Cloudflare**

`svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ config: 'wrangler.toml' })
  }
};

export default config;
```

`vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']
  }
});
```

`tsconfig.json`:

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types", "node"]
  }
}
```

- [ ] **Step 3: Configure Wrangler skeleton**

`wrangler.toml`:

```toml
name = "creator-dashboard"
compatibility_date = "2026-05-04"
compatibility_flags = ["nodejs_als"]
workers_dev = false
preview_urls = false
main = ".svelte-kit/cloudflare/worker.js"

routes = [
  { pattern = "dashboard.glockyco.com", custom_domain = true, zone_name = "glockyco.com" }
]

[assets]
binding = "ASSETS"
directory = ".svelte-kit/cloudflare"

[[d1_databases]]
binding       = "DB"
database_name = "creator-dashboard"
database_id   = "<replace with pnpm exec wrangler d1 create creator-dashboard database_id>"

[[queues.producers]]
binding = "FETCHER_QUEUE"
queue   = "creator-dashboard-fetchers"

[[queues.consumers]]
queue              = "creator-dashboard-fetchers"
max_batch_size     = 1
max_batch_timeout  = 0
max_retries        = 5
dead_letter_queue  = "creator-dashboard-fetcher-dlq"

[[queues.consumers]]
queue          = "creator-dashboard-fetcher-dlq"
max_batch_size = 1

[triggers]
crons = ["0 * * * *", "0 4,5 * * *"]
```

Replace the placeholder `database_id` immediately after `pnpm exec wrangler d1 create creator-dashboard` returns the real ID.

- [ ] **Step 4: Add global CSS and minimal routes**

`src/app.html`:

```html
<!doctype html>
<html lang="en" style="color-scheme: dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

`src/app.css`:

```css
@import 'tailwindcss';

@theme {
  --color-bg-primary: light-dark(#fafafa, #0a0a0a);
  --color-bg-secondary: light-dark(#f0f0f0, #161616);
  --color-fg-primary: light-dark(#0a0a0a, #fafafa);
  --color-fg-muted: light-dark(#525252, #a3a3a3);
  --color-border: light-dark(#e5e5e5, #262626);
  --color-glockyco: #6366f1;
  --color-wowmuch: #f59e0b;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-event: #8b5cf6;
  --color-post: #14b8a6;
}

:root {
  color-scheme: dark;
  background: var(--color-bg-primary);
  color: var(--color-fg-primary);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
}
```

`src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

`src/routes/+page.server.ts`:

```ts
export const load = async () => ({
  title: 'Creator Dashboard'
});
```

`src/routes/+page.svelte`:

```svelte
<script lang="ts">
  let { data } = $props();
</script>

<main class="min-h-screen bg-bg-primary p-6 text-fg-primary">
  <section class="rounded-lg border border-border bg-bg-secondary p-6">
    <p class="text-sm uppercase tracking-wide text-fg-muted">Private dashboard</p>
    <h1 class="mt-2 text-3xl font-semibold">{data.title}</h1>
    <p class="mt-3 text-fg-muted">Foundation deployed. Sources are enabled in later phases.</p>
  </section>
</main>
```

- [ ] **Step 5: Add initial fetch-only Worker wrapper writer**

`scripts/write-worker-wrapper.ts`:

```ts
import { rename, writeFile } from 'node:fs/promises';

const out = '.svelte-kit/cloudflare/worker.js';
const svelteWorkerOut = '.svelte-kit/cloudflare/sveltekit-worker.js';

await rename(out, svelteWorkerOut);

const content = `import svelteWorker from './sveltekit-worker.js';

export default {
  fetch(request, env, ctx) {
    return svelteWorker.fetch(request, env, ctx);
  }
};
`;

await writeFile(out, content);
console.log(`wrote ${out}`);
```

Task 5 extends this wrapper to export `scheduled` and `queue`; Task 1 only needs `pnpm build` to succeed with the already-declared build script.

- [ ] **Step 6: Verify project setup**

Run:

```bash
pnpm install
pnpm check
pnpm build
```

Expected:

```text
pnpm check exits 0
pnpm build exits 0 and writes .svelte-kit/cloudflare/worker.js
```

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml svelte.config.js vite.config.ts tsconfig.json wrangler.toml .gitignore .dev.vars.example scripts/write-worker-wrapper.ts src/app.html src/app.css src/routes
git commit -m "chore: scaffold creator dashboard app"
```

### Task 2: Add domain types, identities, source registry skeleton

**Files:**
- Create: `src/app.d.ts`
- Create: `src/lib/identities.ts`
- Create: `src/lib/identities.test.ts`
- Create: `src/lib/types/domain.ts`
- Create: `src/lib/types/orchestration.ts`
- Create: `src/lib/sources/registry.ts`
- Create: `src/lib/sources/registry.test.ts`

- [ ] **Step 1: Add typed bindings and shared types**

`src/app.d.ts`:

```ts
import type { JobMsg } from '$lib/types/orchestration';

declare global {
  namespace App {
    interface Platform {
      env: Env;
      cf?: IncomingRequestCfProperties;
      ctx: ExecutionContext;
    }
  }

  interface Env {
    DB: D1Database;
    FETCHER_QUEUE: Queue<JobMsg>;
    GITHUB_PAT: string;
    STEAM_WEB_API_KEY: string;
    GOOGLE_OAUTH_CLIENT_ID: string;
    GOOGLE_OAUTH_CLIENT_SECRET: string;
    GOOGLE_OAUTH_REFRESH_TOKEN: string;
    GOOGLE_SERVICE_ACCOUNT: string;
    GSC_PROPERTIES: string;
    GA4_PROPERTY_ID: string;
    BING_WEBMASTER_API_KEY: string;
    BING_PROPERTIES: string;
    CF_API_TOKEN: string;
    CF_ACCOUNT_ID: string;
    CF_ANALYTICS_SITE_TAGS: string;
    DISCORD_DIGEST_WEBHOOK: string;
    DISCORD_ALERTS_WEBHOOK: string;
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD: string;
  }
}

export {};
```

`src/lib/types/orchestration.ts`:

```ts
export type JobMsg = {
  source_id: string;
  dispatch_ts: number;
  force: boolean;
};
```

`src/lib/types/domain.ts`:

```ts
import type { z } from 'zod';
import type { Identity } from '$lib/identities';
import type { SourceDef } from '$lib/sources/registry';

export type JsonRecord = Record<string, string | number | boolean | null>;

export type MetricPoint = {
  source_id: string;
  metric: string;
  ts: number;
  value: number;
  dimensions: JsonRecord | null;
};

export type EventRow = {
  source_id: string;
  external_id: string;
  ts: number;
  kind: string;
  author: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
};

export type FetcherInput = { source: SourceDef; env: Env; now: number };
export type FetcherOutput = { metric_points: MetricPoint[]; events: EventRow[] };
export type Fetcher = (input: FetcherInput) => Promise<FetcherOutput>;
export type SourceCategory = 'platform' | 'analytics' | 'event_feed';
export type IdentityFilter = Identity | 'all';
export type ZodInfer<T extends z.ZodTypeAny> = z.infer<T>;
```

- [ ] **Step 2: Add identities**

`src/lib/identities.ts`:

```ts
import { z } from 'zod';

export const identities = ['glockyco', 'WoW_Much'] as const;
export type Identity = (typeof identities)[number];
export const Identity = z.enum(identities);

export const identityMeta: Record<Identity, { displayName: string; description: string; colorVar: string }> = {
  glockyco: {
    displayName: 'glockyco',
    description: 'Professional / academic identity',
    colorVar: 'var(--color-glockyco)'
  },
  WoW_Much: {
    displayName: 'WoW_Much',
    description: 'Gaming / mods identity',
    colorVar: 'var(--color-wowmuch)'
  }
};
```

- [ ] **Step 3: Add initial empty source registry**

`src/lib/sources/registry.ts`:

```ts
import { z } from 'zod';
import { Identity } from '$lib/identities';
import type { Fetcher, SourceCategory } from '$lib/types/domain';

export const SourceDef = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  identity: Identity,
  category: z.enum(['platform', 'analytics', 'event_feed']),
  cadenceHours: z.number().int().positive(),
  fetcher: z.custom<Fetcher>((value) => typeof value === 'function'),
  config: z.record(z.string(), z.unknown()).default({})
});

export type SourceDef = z.infer<typeof SourceDef> & { category: SourceCategory };

export const sources: SourceDef[] = z.array(SourceDef).parse([]);

export function getSource(sourceId: string): SourceDef | undefined {
  return sources.find((source) => source.id === sourceId);
}
```

- [ ] **Step 4: Add focused tests**

`src/lib/identities.test.ts` assertions:

```ts
import { describe, expect, it } from 'vitest';
import { Identity, identities, identityMeta } from './identities';

describe('identities', () => {
  it('contains the two approved creator identities', () => {
    expect(identities).toEqual(['glockyco', 'WoW_Much']);
    expect(identityMeta.glockyco.displayName).toBe('glockyco');
    expect(identityMeta.WoW_Much.displayName).toBe('WoW_Much');
  });

  it('rejects unknown identities', () => {
    expect(() => Identity.parse('someone_else')).toThrow();
  });
});
```

`src/lib/sources/registry.test.ts` assertions:

```ts
import { describe, expect, it } from 'vitest';
import { SourceDef, sources } from './registry';

const fetcher = async () => ({ metric_points: [], events: [] });

describe('source registry', () => {
  it('starts empty until real connectors are enabled in Phase 3', () => {
    expect(sources).toEqual([]);
  });

  it('accepts a valid source shape', () => {
    expect(
      SourceDef.parse({
        id: 'test-source',
        name: 'Test Source',
        identity: 'glockyco',
        category: 'platform',
        cadenceHours: 1,
        fetcher,
        config: {}
      }).id
    ).toBe('test-source');
  });

  it('rejects invalid identity, category, cadence, and fetcher', () => {
    expect(() => SourceDef.parse({ id: 'x', name: 'x', identity: 'bad', category: 'platform', cadenceHours: 1, fetcher })).toThrow();
    expect(() => SourceDef.parse({ id: 'x', name: 'x', identity: 'glockyco', category: 'bad', cadenceHours: 1, fetcher })).toThrow();
    expect(() => SourceDef.parse({ id: 'x', name: 'x', identity: 'glockyco', category: 'platform', cadenceHours: 0, fetcher })).toThrow();
    expect(() => SourceDef.parse({ id: 'x', name: 'x', identity: 'glockyco', category: 'platform', cadenceHours: 1, fetcher: 'nope' })).toThrow();
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/lib/identities.test.ts src/lib/sources/registry.test.ts
```

Expected:

```text
2 test files passed
```

- [ ] **Step 6: Commit**

```bash
git add src/app.d.ts src/lib/identities.ts src/lib/identities.test.ts src/lib/types src/lib/sources
git commit -m "feat: add identities and source registry skeleton"
```

### Task 3: Add initial D1 schema migration

**Files:**
- Create: `migrations/0001_initial_schema.sql`
- Create: `src/lib/server/db/schema.test.ts`

- [ ] **Step 1: Add full initial migration**

`migrations/0001_initial_schema.sql`:

```sql
CREATE TABLE metric_points (
  source_id  TEXT    NOT NULL,
  metric     TEXT    NOT NULL,
  ts         INTEGER NOT NULL,
  value      REAL    NOT NULL,
  dimensions TEXT,
  PRIMARY KEY (source_id, metric, ts, dimensions)
);
CREATE INDEX idx_mp_source_metric_ts ON metric_points(source_id, metric, ts);
CREATE INDEX idx_mp_ts ON metric_points(ts);

CREATE TABLE events (
  source_id   TEXT    NOT NULL,
  external_id TEXT    NOT NULL,
  ts          INTEGER NOT NULL,
  kind        TEXT    NOT NULL,
  author      TEXT,
  title       TEXT,
  body        TEXT,
  url         TEXT,
  metadata    TEXT,
  PRIMARY KEY (source_id, external_id)
);
CREATE INDEX idx_ev_source_ts ON events(source_id, ts DESC);
CREATE INDEX idx_ev_ts ON events(ts DESC);
CREATE INDEX idx_ev_kind_ts ON events(kind, ts DESC);

CREATE TABLE fetcher_runs (
  source_id            TEXT    PRIMARY KEY,
  last_run_at          INTEGER NOT NULL,
  last_success_at      INTEGER,
  last_status          TEXT    NOT NULL,
  last_error           TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE fetcher_failures (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id     TEXT    NOT NULL,
  ts            INTEGER NOT NULL,
  tier          TEXT    NOT NULL,
  status_code   INTEGER,
  error_message TEXT    NOT NULL
);
CREATE INDEX idx_ff_ts ON fetcher_failures(ts DESC);
CREATE INDEX idx_ff_source_ts ON fetcher_failures(source_id, ts DESC);

CREATE TABLE alerts_sent (
  alert_key TEXT PRIMARY KEY,
  sent_at   INTEGER NOT NULL
);

CREATE TABLE posts_index (
  slug         TEXT    PRIMARY KEY,
  posted_at    INTEGER NOT NULL,
  author       TEXT    NOT NULL,
  platform     TEXT    NOT NULL,
  url          TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  tags         TEXT    NOT NULL,
  body_excerpt TEXT,
  body_hash    TEXT    NOT NULL
);
CREATE INDEX idx_posts_posted_at ON posts_index(posted_at DESC);
CREATE INDEX idx_posts_author_ts ON posts_index(author, posted_at DESC);

CREATE TABLE posts_sources (
  slug      TEXT NOT NULL,
  source_id TEXT NOT NULL,
  PRIMARY KEY (slug, source_id)
);
CREATE INDEX idx_ps_source ON posts_sources(source_id);
```

- [ ] **Step 2: Verify migration locally**

Run:

```bash
pnpm migrate:local
pnpm exec wrangler d1 execute creator-dashboard --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
pnpm exec wrangler d1 execute creator-dashboard --local --command "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"
```

Expected table names include:

```text
alerts_sent
events
fetcher_failures
fetcher_runs
metric_points
posts_index
posts_sources
```

Expected index names include:

```text
idx_ev_kind_ts
idx_ev_source_ts
idx_ev_ts
idx_ff_source_ts
idx_ff_ts
idx_mp_source_metric_ts
idx_mp_ts
idx_posts_author_ts
idx_posts_posted_at
idx_ps_source
```

- [ ] **Step 3: Add schema replay test**

`src/lib/server/db/schema.test.ts` should read the migration SQL, apply it to an in-memory SQLite/D1-compatible harness chosen during implementation, and assert the table/index names above. If using Wrangler local D1 in tests is too heavy, use `better-sqlite3` only as a dev dependency after explicitly adding it to `package.json` and documenting that the migration SQL must remain SQLite-compatible.

- [ ] **Step 4: Run targeted verification**

```bash
pnpm vitest run src/lib/server/db/schema.test.ts
```

Expected:

```text
1 test file passed
```

- [ ] **Step 5: Commit**

```bash
git add migrations/0001_initial_schema.sql src/lib/server/db/schema.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add initial d1 schema"
```

### Task 4: Add Cloudflare Access JWT verification

**Files:**
- Create: `src/lib/server/auth/access.ts`
- Create: `src/lib/server/auth/access.test.ts`
- Create: `src/hooks.server.ts`

- [ ] **Step 1: Write failing tests**

`src/lib/server/auth/access.test.ts` must cover:

```ts
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { assertAccessJwt } from './access';

const env = { ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', ACCESS_AUD: 'aud-test' } as Env;

async function signedToken(overrides: { aud?: string; iss?: string; exp?: number } = {}) {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] }))));
  const token = await new SignJWT({ email: 'johann@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(overrides.iss ?? 'https://team.cloudflareaccess.com')
    .setAudience(overrides.aud ?? 'aud-test')
    .setExpirationTime(overrides.exp ?? Math.floor(Date.now() / 1000) + 300)
    .sign(privateKey);
  return token;
}

describe('assertAccessJwt', () => {
  it('accepts a valid Access JWT', async () => {
    const token = await signedToken();
    const request = new Request('https://dashboard.glockyco.com/', { headers: { 'Cf-Access-Jwt-Assertion': token } });
    await expect(assertAccessJwt(request, env)).resolves.toMatchObject({ email: 'johann@example.com' });
  });

  it('rejects missing, expired, wrong audience, wrong issuer, and malformed tokens', async () => {
    await expect(assertAccessJwt(new Request('https://dashboard.glockyco.com/'), env)).rejects.toMatchObject({ status: 401 });
    await expect(assertAccessJwt(new Request('https://dashboard.glockyco.com/', { headers: { 'Cf-Access-Jwt-Assertion': await signedToken({ exp: 1 }) } }), env)).rejects.toMatchObject({ status: 401 });
    await expect(assertAccessJwt(new Request('https://dashboard.glockyco.com/', { headers: { 'Cf-Access-Jwt-Assertion': await signedToken({ aud: 'wrong' }) } }), env)).rejects.toMatchObject({ status: 401 });
    await expect(assertAccessJwt(new Request('https://dashboard.glockyco.com/', { headers: { 'Cf-Access-Jwt-Assertion': await signedToken({ iss: 'https://evil.example' }) } }), env)).rejects.toMatchObject({ status: 401 });
    await expect(assertAccessJwt(new Request('https://dashboard.glockyco.com/', { headers: { 'Cf-Access-Jwt-Assertion': 'not-a-jwt' } }), env)).rejects.toMatchObject({ status: 401 });
  });
});
```

- [ ] **Step 2: Implement verification**

`src/lib/server/auth/access.ts`:

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export class AuthError extends Error {
  status = 401;
}

export type AccessUser = {
  email: string | null;
  claims: Record<string, unknown>;
};

export async function assertAccessJwt(request: Request, env: Pick<Env, 'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUD'>): Promise<AccessUser> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new AuthError('missing Access JWT');

  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  let jwks = jwksByDomain.get(env.ACCESS_TEAM_DOMAIN);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksByDomain.set(env.ACCESS_TEAM_DOMAIN, jwks);
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD
    });
    return { email: typeof payload.email === 'string' ? payload.email : null, claims: payload as Record<string, unknown> };
  } catch (cause) {
    throw new AuthError('invalid Access JWT', { cause });
  }
}
```

`src/hooks.server.ts`:

```ts
import { error, type Handle } from '@sveltejs/kit';
import { assertAccessJwt, AuthError } from '$lib/server/auth/access';

export const handle: Handle = async ({ event, resolve }) => {
  try {
    if (!event.platform?.env) throw error(500, 'Cloudflare platform env missing');
    await assertAccessJwt(event.request, event.platform.env);
    return resolve(event);
  } catch (err) {
    if (err instanceof AuthError) throw error(401, 'Unauthorized');
    throw err;
  }
};
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run src/lib/server/auth/access.test.ts
```

Expected:

```text
1 test file passed
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/auth/access.ts src/lib/server/auth/access.test.ts src/hooks.server.ts
git commit -m "feat: verify cloudflare access jwt"
```

### Task 5: Add Worker wrapper for fetch, scheduled, and queue

**Files:**
- Create: `src/lib/server/worker/scheduled.ts`
- Create: `src/lib/server/worker/queue.ts`
- Create: `src/worker.ts`
- Modify: `scripts/write-worker-wrapper.ts`
- Modify: `package.json`
- Modify: `wrangler.toml`

- [ ] **Step 1: Add source-controlled handler modules**

`src/lib/server/worker/scheduled.ts`:

```ts
export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log(JSON.stringify({ level: 'info', message: 'scheduled handler reached', cron: controller.cron, ts: new Date().toISOString() }));
}
```

`src/lib/server/worker/queue.ts`:

```ts
import type { JobMsg } from '$lib/types/orchestration';

export async function queue(batch: MessageBatch<JobMsg>, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log(JSON.stringify({ level: 'info', message: 'queue handler reached', queue: batch.queue, messages: batch.messages.length, ts: new Date().toISOString() }));
  batch.ackAll();
}
```

`src/worker.ts`:

```ts
import { scheduled } from '$lib/server/worker/scheduled';
import { queue } from '$lib/server/worker/queue';

export { scheduled, queue };
```

- [ ] **Step 2: Generate wrapper after SvelteKit build**

`scripts/write-worker-wrapper.ts`:

```ts
import { rename, writeFile } from 'node:fs/promises';

const out = '.svelte-kit/cloudflare/worker.js';
const svelteWorkerOut = '.svelte-kit/cloudflare/sveltekit-worker.js';

await rename(out, svelteWorkerOut);

const content = `import svelteWorker from './sveltekit-worker.js';
import { scheduled, queue } from '../../src/worker.ts';

export default {
  fetch(request, env, ctx) {
    return svelteWorker.fetch(request, env, ctx);
  },
  scheduled,
  queue
};
`;

await writeFile(out, content);
console.log(`wrote ${out}`);
```

If Wrangler cannot import `../../src/worker.ts` from built output, replace this with a Vite library build of `src/worker.ts` into `.svelte-kit/cloudflare/worker-handlers.js`, then import that compiled JS file. The acceptance condition is a locally proven Worker with all three handlers, not the first wrapper approach.

- [ ] **Step 3: Verify scheduled handler locally**

Run:

```bash
pnpm build
pnpm exec wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

Expected Worker log includes:

```json
{"level":"info","message":"scheduled handler reached","cron":"0 * * * *"}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/worker src/worker.ts scripts/write-worker-wrapper.ts package.json wrangler.toml
git commit -m "feat: add cloudflare worker handler wrapper"
```

---

**Execution-order correction discovered during implementation:** Task 8 (shared connector contract, especially `FetchError`) must be completed before Task 6, because orchestration error classification imports and tests against `FetchError`. This does not enable any production sources early; the source registry remains empty until the Tier 1 connector task.


**Second execution-order correction discovered during implementation:** Task 6 also needs the alert dedupe and DLQ primitives that were originally listed in Task 7, because `consumer.ts` calls `maybeSendAlert()` for permanent failures and `worker/queue.ts` dispatches DLQ batches. Implement `src/lib/server/alerts/discord.ts`, `src/lib/server/alerts/dedup.ts`, and `src/lib/server/orchestration/dlq.ts` with tests as part of orchestration, then Task 7 focuses on manual refresh and Health UI.
## Phase 2: Orchestration core

### Task 6: Add dispatcher, queue consumer, persistence, and error classification

**Files:**
- Create: `src/lib/server/log.ts`
- Create: `src/lib/server/orchestration/errors.ts`
- Create: `src/lib/server/orchestration/persist.ts`
- Create: `src/lib/server/orchestration/dispatcher.ts`
- Create: `src/lib/server/orchestration/consumer.ts`
- Create: `src/lib/server/orchestration/errors.test.ts`
- Create: `src/lib/server/orchestration/persist.test.ts`
- Create: `src/lib/server/orchestration/dispatcher.test.ts`
- Create: `src/lib/server/orchestration/consumer.test.ts`
- Modify: `src/lib/server/worker/scheduled.ts`
- Modify: `src/lib/server/worker/queue.ts`

- [ ] **Step 1: Add structured log helper**

`src/lib/server/log.ts`:

```ts
export function log(level: 'info' | 'warn' | 'error', message: string, ctx: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level, message, ts: new Date().toISOString(), ...ctx }));
}
```

- [ ] **Step 2: Implement error classification**

`src/lib/server/orchestration/errors.ts`:

```ts
import { z } from 'zod';
import { FetchError } from '$lib/connectors/http';

export type FailureTier = 'transient' | 'rate_limited' | 'permanent';
export type Failure = { tier: FailureTier; statusCode: number | null; retryAfterSeconds: number | null; errorClass: string };

export function parseRetryAfter(headers: Headers): number | null {
  const value = headers.get('Retry-After');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.floor(seconds);
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
  return null;
}

export function classify(err: unknown): Failure {
  if (err instanceof z.ZodError) return { tier: 'permanent', statusCode: null, retryAfterSeconds: null, errorClass: 'schema_drift' };
  if (err instanceof FetchError) {
    if (err.status === 429) return { tier: 'rate_limited', statusCode: 429, retryAfterSeconds: parseRetryAfter(err.headers) ?? 600, errorClass: 'rate_limited' };
    if (err.status === 401 || err.status === 403) return { tier: 'permanent', statusCode: err.status, retryAfterSeconds: null, errorClass: 'auth_dead' };
    if (err.status === 404) return { tier: 'permanent', statusCode: 404, retryAfterSeconds: null, errorClass: 'not_found' };
    if (err.status >= 500) return { tier: 'transient', statusCode: err.status, retryAfterSeconds: 300, errorClass: 'upstream_5xx' };
  }
  return { tier: 'transient', statusCode: null, retryAfterSeconds: 300, errorClass: 'network_or_unknown' };
}
```

- [ ] **Step 3: Implement success persistence**

`src/lib/server/orchestration/persist.ts`:

```ts
import type { FetcherOutput } from '$lib/types/domain';

export function successStatements(db: D1Database, sourceId: string, now: number, output: FetcherOutput): D1PreparedStatement[] {
  return [
    ...output.metric_points.map((point) =>
      db.prepare('INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions) VALUES (?, ?, ?, ?, ?)')
        .bind(point.source_id, point.metric, point.ts, point.value, point.dimensions ? JSON.stringify(point.dimensions) : null)
    ),
    ...output.events.map((event) =>
      db.prepare('INSERT OR IGNORE INTO events (source_id, external_id, ts, kind, author, title, body, url, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(event.source_id, event.external_id, event.ts, event.kind, event.author, event.title, event.body, event.url, event.metadata ? JSON.stringify(event.metadata) : null)
    ),
    db.prepare(`
      INSERT INTO fetcher_runs (source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures)
      VALUES (?, ?, ?, 'success', NULL, 0)
      ON CONFLICT(source_id) DO UPDATE SET
        last_run_at = excluded.last_run_at,
        last_success_at = excluded.last_success_at,
        last_status = 'success',
        last_error = NULL,
        consecutive_failures = 0
    `).bind(sourceId, now, now)
  ];
}
```

- [ ] **Step 4: Implement dispatcher**

`src/lib/server/orchestration/dispatcher.ts`:

```ts
import { sources } from '$lib/sources/registry';
import type { JobMsg } from '$lib/types/orchestration';
import { log } from '$lib/server/log';

export async function dispatchDueSources(env: Env, now = Date.now()): Promise<number> {
  const messages = sources.map((source) => ({ body: { source_id: source.id, dispatch_ts: now, force: false } satisfies JobMsg }));
  if (messages.length > 0) await env.FETCHER_QUEUE.sendBatch(messages);
  log('info', 'dispatched source jobs', { enqueued: messages.length });
  return messages.length;
}
```

- [ ] **Step 5: Implement consumer with cadence gate**

`src/lib/server/orchestration/consumer.ts`:

```ts
import { getSource } from '$lib/sources/registry';
import type { JobMsg } from '$lib/types/orchestration';
import { maybeSendAlert } from '$lib/server/alerts/dedup';
import { log } from '$lib/server/log';
import { classify } from './errors';
import { successStatements } from './persist';

export async function consumeMessage(message: Message<JobMsg>, env: Env, now = Date.now()): Promise<void> {
  const { source_id, force } = message.body;
  const source = getSource(source_id);
  if (!source) {
    log('warn', 'dropping unknown source job', { source_id });
    message.ack();
    return;
  }

  if (!force) {
    const run = await env.DB.prepare('SELECT last_run_at FROM fetcher_runs WHERE source_id = ?').bind(source_id).first<{ last_run_at: number }>();
    const cadenceMs = source.cadenceHours * 3_600_000;
    if (run && now - run.last_run_at < cadenceMs - 300_000) {
      message.ack();
      return;
    }
  }

  try {
    const output = await source.fetcher({ source, env, now });
    await env.DB.batch(successStatements(env.DB, source_id, now, output));
    log('info', 'source fetch succeeded', { source_id, metric_points: output.metric_points.length, events: output.events.length });
    message.ack();
  } catch (err) {
    const failure = classify(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message) VALUES (?, ?, ?, ?, ?)')
        .bind(source_id, now, failure.tier, failure.statusCode, errorMessage),
      env.DB.prepare(`
        INSERT INTO fetcher_runs (source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures)
        VALUES (?, ?, NULL, ?, ?, 1)
        ON CONFLICT(source_id) DO UPDATE SET
          last_run_at = excluded.last_run_at,
          last_status = excluded.last_status,
          last_error = excluded.last_error,
          consecutive_failures = fetcher_runs.consecutive_failures + 1
      `).bind(source_id, now, `${failure.tier}_failure`, errorMessage)
    ]);

    if (failure.tier === 'permanent') {
      await maybeSendAlert(env, source_id, 'permanent', failure.errorClass, errorMessage);
      message.ack();
      return;
    }

    message.retry({ delaySeconds: failure.retryAfterSeconds ?? 300 });
  }
}
```

- [ ] **Step 6: Wire handlers**

`src/lib/server/worker/scheduled.ts`:

```ts
import { dispatchDueSources } from '$lib/server/orchestration/dispatcher';

export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  if (controller.cron === '0 * * * *') {
    await dispatchDueSources(env, Date.now());
  }
}
```

`src/lib/server/worker/queue.ts`:

```ts
import type { JobMsg } from '$lib/types/orchestration';
import { consumeDlqMessage } from '$lib/server/orchestration/dlq';
import { consumeMessage } from '$lib/server/orchestration/consumer';

export async function queue(batch: MessageBatch<JobMsg>, env: Env, ctx: ExecutionContext): Promise<void> {
  for (const message of batch.messages) {
    if (batch.queue === 'creator-dashboard-fetcher-dlq') await consumeDlqMessage(message, env);
    else await consumeMessage(message, env);
  }
}
```

- [ ] **Step 7: Run targeted tests**

```bash
pnpm vitest run src/lib/server/orchestration/errors.test.ts src/lib/server/orchestration/persist.test.ts src/lib/server/orchestration/dispatcher.test.ts src/lib/server/orchestration/consumer.test.ts
```

Expected:

```text
4 test files passed
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/log.ts src/lib/server/orchestration src/lib/server/worker
git commit -m "feat: add queue orchestration core"
```

### Task 7: Add alert dedupe, DLQ handling, manual refresh, and Health page

**Files:**
- Create: `src/lib/server/alerts/discord.ts`
- Create: `src/lib/server/alerts/dedup.ts`
- Create: `src/lib/server/alerts/dedup.test.ts`
- Create: `src/lib/server/orchestration/dlq.ts`
- Create: `src/lib/server/orchestration/dlq.test.ts`
- Create: `src/routes/api/refresh/[source_id]/+server.ts`
- Create: `src/routes/api/refresh/[source_id]/server.test.ts`
- Create: `src/lib/server/health/queries.ts`
- Create: `src/lib/server/health/queries.test.ts`
- Create: `src/routes/health/+page.server.ts`
- Create: `src/routes/health/+page.svelte`

- [ ] **Step 1: Implement Discord posting and alert dedupe**

`src/lib/server/alerts/discord.ts`:

```ts
export async function postDiscord(webhook: string, content: string): Promise<void> {
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (!response.ok) throw new Error(`Discord webhook failed: ${response.status}`);
}
```

`src/lib/server/alerts/dedup.ts`:

```ts
import { postDiscord } from './discord';

export async function maybeSendAlert(env: Env, sourceId: string, tier: 'permanent' | 'dlq', errorClass: string, message: string, now = Date.now()): Promise<boolean> {
  const alertKey = `${tier}:${sourceId}:${errorClass}`;
  const existing = await env.DB.prepare('SELECT sent_at FROM alerts_sent WHERE alert_key = ?').bind(alertKey).first<{ sent_at: number }>();
  if (existing && now - existing.sent_at < 24 * 3_600_000) return false;

  await postDiscord(env.DISCORD_ALERTS_WEBHOOK, `creator-dashboard ${tier} failure: ${sourceId} (${errorClass})\n${message}`);
  await env.DB.prepare('INSERT OR REPLACE INTO alerts_sent (alert_key, sent_at) VALUES (?, ?)').bind(alertKey, now).run();
  return true;
}
```

- [ ] **Step 2: Implement DLQ consumer**

`src/lib/server/orchestration/dlq.ts`:

```ts
import type { JobMsg } from '$lib/types/orchestration';
import { maybeSendAlert } from '$lib/server/alerts/dedup';

export async function consumeDlqMessage(message: Message<JobMsg>, env: Env, now = Date.now()): Promise<void> {
  const sourceId = message.body.source_id;
  await env.DB.prepare('INSERT INTO fetcher_failures (source_id, ts, tier, status_code, error_message) VALUES (?, ?, ?, ?, ?)')
    .bind(sourceId, now, 'dlq', null, 'Exhausted retries')
    .run();
  await maybeSendAlert(env, sourceId, 'dlq', 'exhausted_retries', 'Failed after 5 retries', now);
  message.ack();
}
```

- [ ] **Step 3: Implement manual refresh API**

`src/routes/api/refresh/[source_id]/+server.ts`:

```ts
import { json, error } from '@sveltejs/kit';
import { getSource } from '$lib/sources/registry';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, platform }) => {
  const source = getSource(params.source_id);
  if (!source) throw error(404, 'unknown source');
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');

  await platform.env.FETCHER_QUEUE.send({
    source_id: source.id,
    dispatch_ts: Date.now(),
    force: true
  });

  return json({ queued: true });
};
```

- [ ] **Step 4: Add Health queries and page**

`src/lib/server/health/queries.ts`:

```ts
export async function getHealthSnapshot(db: D1Database) {
  const [runs, failures, alerts] = await Promise.all([
    db.prepare('SELECT source_id, last_run_at, last_success_at, last_status, last_error, consecutive_failures FROM fetcher_runs ORDER BY source_id').all(),
    db.prepare('SELECT id, source_id, ts, tier, status_code, error_message FROM fetcher_failures ORDER BY ts DESC LIMIT 100').all(),
    db.prepare('SELECT alert_key, sent_at FROM alerts_sent ORDER BY sent_at DESC LIMIT 100').all()
  ]);
  return { runs: runs.results, failures: failures.results, alerts: alerts.results };
}
```

`src/routes/health/+page.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { getHealthSnapshot } from '$lib/server/health/queries';

export const load = async ({ platform }) => {
  if (!platform?.env) throw error(500, 'Cloudflare platform env missing');
  return getHealthSnapshot(platform.env.DB);
};
```

`src/routes/health/+page.svelte` renders three tables: fetcher runs, recent failures, and alert log. Empty states must say `No fetcher runs yet.`, `No recent failures.`, and `No alerts sent yet.`

- [ ] **Step 5: Run targeted tests**

```bash
pnpm vitest run src/lib/server/alerts/dedup.test.ts src/lib/server/orchestration/dlq.test.ts src/routes/api/refresh/[source_id]/server.test.ts src/lib/server/health/queries.test.ts
```

Expected:

```text
4 test files passed
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/alerts src/lib/server/orchestration/dlq.ts src/routes/api/refresh src/lib/server/health src/routes/health
git commit -m "feat: add orchestration health and alerts"
```

---

## Phase 3: Tier 1 connectors and first live collection

### Task 8: Add connector shared contract, HTTP boundary, auth helpers, and README

**Files:**
- Create: `src/lib/connectors/types.ts`
- Create: `src/lib/connectors/http.ts`
- Create: `src/lib/connectors/http.test.ts`
- Create: `src/lib/connectors/errors.ts`
- Create: `src/lib/connectors/index.ts`
- Create: `src/lib/connectors/README.md`
- Create: `src/lib/connectors/auth/github.ts`
- Create: `src/lib/connectors/auth/steam.ts`
- Create: `src/lib/connectors/auth/cloudflare.ts`
- Create: `src/lib/connectors/auth/bing.ts`
- Create: `src/lib/connectors/auth/google.ts`
- Create: `src/lib/connectors/auth/google.test.ts`

- [ ] **Step 1: Add connector types re-exporting domain contract**

`src/lib/connectors/types.ts`:

```ts
export type { EventRow as ConnectorEvent, Fetcher, FetcherInput, FetcherOutput, MetricPoint } from '$lib/types/domain';
```

- [ ] **Step 2: Implement FetchError and fetchJson**

`src/lib/connectors/http.ts`:

```ts
import type { z } from 'zod';

export class FetchError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers: Headers = new Headers()
  ) {
    super(message);
  }
}

type FetchJsonOptions<T> = RequestInit & {
  timeoutMs?: number;
  schema?: z.ZodType<T>;
};

export async function fetchJson<T>(url: string | URL, options: FetchJsonOptions<T> = {}): Promise<T> {
  const { timeoutMs = 15_000, schema, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new FetchError(response.status, text || response.statusText, response.headers);
    let json: unknown;
    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch (cause) {
      throw new FetchError(200, 'invalid JSON response', response.headers);
    }
    return schema ? schema.parse(json) : (json as T);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 3: Add auth helpers**

`src/lib/connectors/auth/github.ts`:

```ts
export const githubHeaders = (env: Pick<Env, 'GITHUB_PAT'>) => ({
  Authorization: `Bearer ${env.GITHUB_PAT}`,
  'Content-Type': 'application/json',
  'User-Agent': 'creator-dashboard/1.0'
});
```

`src/lib/connectors/auth/steam.ts`:

```ts
export function withSteamKey(url: URL, env: Pick<Env, 'STEAM_WEB_API_KEY'>): URL {
  url.searchParams.set('key', env.STEAM_WEB_API_KEY);
  return url;
}
```

`src/lib/connectors/auth/cloudflare.ts`:

```ts
export const cfHeaders = (env: Pick<Env, 'CF_API_TOKEN'>) => ({
  Authorization: `Bearer ${env.CF_API_TOKEN}`,
  'Content-Type': 'application/json'
});
```

`src/lib/connectors/auth/bing.ts`:

```ts
export function withBingKey(url: URL, env: Pick<Env, 'BING_WEBMASTER_API_KEY'>): URL {
  url.searchParams.set('apikey', env.BING_WEBMASTER_API_KEY);
  return url;
}
```

`src/lib/connectors/auth/google.ts` exposes two cached token paths: `getGoogleAccessToken(env, scopes)` for service-account JWT bearer auth and `getGoogleOAuthAccessToken(env)` for refresh-token auth. GSC uses OAuth because Google's service-account permission grant path is currently broken. GA4 should now be tackled before deploy readiness; prefer OAuth with a refresh token reissued for both `webmasters.readonly` and `analytics.readonly` unless live GA4 setup proves the service-account path works cleanly.

- [ ] **Step 4: Document connector invariants**

`src/lib/connectors/README.md`:

```markdown
# Connector rules

- Connectors are pure: HTTP response to Zod parse to typed rows.
- Connectors never read or write D1.
- Connectors never log secrets or raw upstream responses.
- Connectors use sequential awaits. Do not use Promise.all inside connector modules.
- Connectors re-emit historical rows freely; D1 INSERT OR IGNORE handles idempotency.
- Connectors parameterize `source.id`; never hardcode a source ID inside a fetcher.
- Unit tests use checked-in fixtures plus synthetic schema-drift and auth-error responses.
```

- [ ] **Step 5: Verify shared connector boundary**

```bash
pnpm vitest run src/lib/connectors/http.test.ts src/lib/connectors/auth/google.test.ts
```

Expected:

```text
2 test files passed
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/connectors
git commit -m "feat: add connector contract and http boundary"
```

### Task 9: Implement Tier 1 connectors and enable seven Tier 1 sources

**Files:**
- Create/modify: `src/lib/connectors/fetchers/index.ts`
- Create: `src/lib/connectors/fetchers/github.ts`
- Create: `src/lib/connectors/fetchers/github.test.ts`
- Create: `src/lib/connectors/fetchers/github.fixture.json`
- Create: `src/lib/connectors/fetchers/steam-guide.ts`
- Create: `src/lib/connectors/fetchers/steam-guide.test.ts`
- Create: `src/lib/connectors/fetchers/steam-guide.fixture.json`
- Create: `src/lib/connectors/fetchers/steam-reviews.ts`
- Create: `src/lib/connectors/fetchers/steam-reviews.test.ts`
- Create: `src/lib/connectors/fetchers/steam-reviews.fixture.json`
- Create: `src/lib/connectors/fetchers/thunderstore-team.ts`
- Create: `src/lib/connectors/fetchers/thunderstore-team.test.ts`
- Create: `src/lib/connectors/fetchers/thunderstore-team.fixture.json`
- Create: `src/lib/connectors/fetchers/mediawiki-recent-changes.ts`
- Create: `src/lib/connectors/fetchers/mediawiki-recent-changes.test.ts`
- Create: `src/lib/connectors/fetchers/mediawiki-recent-changes.fixture.json`
- Modify: `src/lib/sources/registry.ts`
- Modify: `src/lib/sources/registry.test.ts`

- [ ] **Step 1: Add fetcher exports**

`src/lib/connectors/fetchers/index.ts`:

```ts
export { fetchGithub as github } from './github';
export { fetchSteamGuide as steamGuide } from './steam-guide';
export { fetchSteamReviews as steamReviews } from './steam-reviews';
export { fetchThunderstoreTeam as thunderstoreTeam } from './thunderstore-team';
export { fetchMediaWikiRecentChanges as mediaWikiRecentChanges } from './mediawiki-recent-changes';
```

- [ ] **Step 2: Implement GitHub connector metrics**

`fetchGithub()` emits:

```ts
[
  { metric: 'followers', dimensions: null },
  { metric: 'total_stars', dimensions: null },
  { metric: 'public_repos', dimensions: null },
  { metric: 'contributions', dimensions: null },
  { metric: 'repo_stars', dimensions: { repo: string, archived: 'true' | 'false' } }
]
```

It emits `events: []`. Do not add recent activity events.

- [ ] **Step 3: Implement Steam Guide connector metrics**

`fetchSteamGuide()` emits:

```ts
[
  { metric: 'views', dimensions: null },
  { metric: 'rating', dimensions: null },
  { metric: 'ratings', dimensions: null }
]
```

It supports source configs:

```ts
{ publishedfileid: '3500398991' }
{ publishedfileid: '3616580411' }
```

- [ ] **Step 4: Implement Steam Reviews connector events**

`fetchSteamReviews()` emits events with:

```ts
{
  kind: 'review',
  external_id: upstreamRecommendationId,
  author: redactedOrDisplayAuthor,
  title: votedUp ? 'Positive review' : 'Negative review',
  body: reviewText,
  url: upstreamReviewUrlOrNull,
  metadata: {
    voted_up,
    votes_up,
    weighted_vote_score,
    comment_count,
    playtime_forever,
    playtime_at_review,
    language,
    steam_purchase,
    received_for_free
  }
}
```

If `query_summary` is stable in the fixture, also emit metrics `review_total`, `review_positive`, `review_negative`, `review_score`.

- [ ] **Step 5: Implement Thunderstore connector metrics**

`fetchThunderstoreTeam()` emits:

```ts
[
  { metric: 'total_downloads', dimensions: null },
  { metric: 'package_count', dimensions: null },
  { metric: 'package_downloads', dimensions: { package: string } }
]
```

- [ ] **Step 6: Implement MediaWiki recent changes events**

`fetchMediaWikiRecentChanges()` emits events with:

```ts
{
  kind: 'wiki_edit',
  external_id: String(rcid),
  author: user,
  title: pageTitle,
  body: commentOrSummary,
  url: revisionOrPageUrl,
  metadata: { type, revid, old_revid, namespace, minor, bot, size_delta }
}
```

- [ ] **Step 7: Enable Tier 1 source registry**

`src/lib/sources/registry.ts` should import `* as fetchers from '$lib/connectors/fetchers'` and initially contain these Tier 1 source entries. Analytics entries are added in Task 16 and currently include parallel AK workers.dev + `compendiums.org` search sources.

```ts
export const sources: SourceDef[] = z.array(SourceDef).parse([
  { id: 'github-glockyco', identity: 'glockyco', name: 'GitHub @glockyco', category: 'platform', cadenceHours: 1, fetcher: fetchers.github, config: {} },
  { id: 'steam-guide-erenshor', identity: 'WoW_Much', name: 'Steam Guide: Erenshor Maps', category: 'platform', cadenceHours: 1, fetcher: fetchers.steamGuide, config: { publishedfileid: '3500398991' } },
  { id: 'steam-guide-ak', identity: 'WoW_Much', name: 'Steam Guide: AK Compendium', category: 'platform', cadenceHours: 1, fetcher: fetchers.steamGuide, config: { publishedfileid: '3616580411' } },
  { id: 'steam-reviews-erenshor', identity: 'WoW_Much', name: 'Steam Reviews: Erenshor', category: 'event_feed', cadenceHours: 1, fetcher: fetchers.steamReviews, config: { appid: '2382520' } },
  { id: 'steam-reviews-ak', identity: 'WoW_Much', name: 'Steam Reviews: Ancient Kingdoms', category: 'event_feed', cadenceHours: 1, fetcher: fetchers.steamReviews, config: { appid: '2241380' } },
  { id: 'thunderstore-wowmuch', identity: 'WoW_Much', name: 'Thunderstore: WoW_Much', category: 'platform', cadenceHours: 1, fetcher: fetchers.thunderstoreTeam, config: { namespace: 'WoW_Much', community: 'erenshor' } },
  { id: 'erenshor-wiki-recent', identity: 'WoW_Much', name: 'Erenshor Wiki: Recent Changes', category: 'event_feed', cadenceHours: 1, fetcher: fetchers.mediaWikiRecentChanges, config: { wiki: 'erenshor.wiki.gg' } }
]);
```

- [ ] **Step 8: Run connector tests**

```bash
pnpm vitest run src/lib/connectors/fetchers/github.test.ts src/lib/connectors/fetchers/steam-guide.test.ts src/lib/connectors/fetchers/steam-reviews.test.ts src/lib/connectors/fetchers/thunderstore-team.test.ts src/lib/connectors/fetchers/mediawiki-recent-changes.test.ts src/lib/sources/registry.test.ts
```

Expected:

```text
6 test files passed
```

- [ ] **Step 9: Local orchestration smoke boundary**

Do not run `pnpm exec wrangler dev --test-scheduled` as an automated Tier 1 smoke while the same `wrangler.toml` has active queue consumers. Local Wrangler consumes queued messages immediately, so a scheduled smoke would execute live Tier 1 connectors and can trigger permanent-failure Discord alerts when `.dev.vars` secrets are absent. For this task, verify scheduled dispatch with unit coverage plus `pnpm build`; defer live local queue smoke until real `.dev.vars` secrets are present and the run is an explicit manual decision.

- [ ] **Step 10: Commit**

```bash
git add src/lib/connectors/fetchers src/lib/sources/registry.ts src/lib/sources/registry.test.ts docs/superpowers/plans/2026-05-04-creator-dashboard-implementation.md
git commit -m "feat: add tier one source connectors"
```

### Task 10: Add fixture capture script

**Files:**
- Create: `scripts/capture-fixture.ts`
- Create: `scripts/capture-fixture.test.ts`

- [ ] **Step 1: Implement capture script behavior**

`capture-fixture.ts` accepts:

```text
node --experimental-strip-types scripts/capture-fixture.ts github
node --experimental-strip-types scripts/capture-fixture.ts steam-guide --source-id steam-guide-erenshor
node --experimental-strip-types scripts/capture-fixture.ts steam-reviews --source-id steam-reviews-erenshor
node --experimental-strip-types scripts/capture-fixture.ts thunderstore-team --source-id thunderstore-wowmuch
node --experimental-strip-types scripts/capture-fixture.ts mediawiki-recent-changes --source-id erenshor-wiki-recent
```

It must redact:

```ts
const redactionPatterns = [
  /ghp_[A-Za-z0-9_]+/g,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /\b7656119\d{10}\b/g,
  /Bearer\s+[A-Za-z0-9._-]+/g
];
```

- [ ] **Step 2: Verify script tests**

```bash
pnpm vitest run scripts/capture-fixture.test.ts
```

Expected:

```text
1 test file passed
```

- [ ] **Step 3: Commit**

```bash
git add scripts/capture-fixture.ts scripts/capture-fixture.test.ts
git commit -m "test: add connector fixture capture utility"
```

---

## Phase 4: Dashboard UI and source drill-down

### Task 11: Add dashboard query layer and metric registry

**Files:**
- Create: `src/lib/sources/metrics.ts`
- Create: `src/lib/sources/metrics.test.ts`
- Create: `src/lib/dashboard/types.ts`
- Create: `src/lib/server/dashboard.ts`
- Create: `src/lib/server/dashboard.test.ts`
- Modify: `src/routes/+page.server.ts`

- [ ] **Step 1: Define metric registry**

`src/lib/sources/metrics.ts`:

```ts
export const sourceMetrics: Record<string, { primary: string[]; sparkline: string; eventKind?: string }> = {
  'github-glockyco': { primary: ['followers', 'total_stars', 'public_repos'], sparkline: 'contributions' },
  'steam-guide-erenshor': { primary: ['views', 'rating', 'ratings'], sparkline: 'views' },
  'steam-guide-ak': { primary: ['views', 'rating', 'ratings'], sparkline: 'views' },
  'steam-reviews-erenshor': { primary: ['review_total', 'review_positive', 'review_negative'], sparkline: 'review_total', eventKind: 'review' },
  'steam-reviews-ak': { primary: ['review_total', 'review_positive', 'review_negative'], sparkline: 'review_total', eventKind: 'review' },
  'thunderstore-wowmuch': { primary: ['total_downloads', 'package_count'], sparkline: 'total_downloads' },
  'erenshor-wiki-recent': { primary: ['wiki_change_count'], sparkline: 'wiki_change_count', eventKind: 'wiki_edit' }
};
```

Current analytics metrics are also present for all enabled GSC, Bing, and Cloudflare Analytics source IDs, including `gsc-ak-compendium-org` and `bing-ak-compendium-org`.

- [ ] **Step 2: Define tile snapshot type**

`src/lib/dashboard/types.ts`:

```ts
import type { SourceDef } from '$lib/sources/registry';

export type SparkPoint = { ts: number; value: number };
export type LatestMetric = { metric: string; value: number | null; previousValue: number | null; delta: number | null };
export type LatestEvent = { ts: number; kind: string; title: string | null; author: string | null; url: string | null };
export type FetcherStatus = { last_run_at: number | null; last_success_at: number | null; last_status: string | null; last_error: string | null; consecutive_failures: number };
export type TileSnapshot = { source: Omit<SourceDef, 'fetcher'>; metrics: LatestMetric[]; sparkline: SparkPoint[]; latestEvents: LatestEvent[]; status: FetcherStatus };
```

- [ ] **Step 3: Implement `getDashboardSnapshots(db, filters)`**

It reads:

```sql
SELECT source_id, metric, ts, value, dimensions
FROM metric_points
WHERE source_id = ? AND metric = ? AND ts >= ?
ORDER BY ts ASC
```

and:

```sql
SELECT source_id, external_id, ts, kind, author, title, url
FROM events
WHERE source_id = ?
ORDER BY ts DESC
LIMIT 3
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/lib/sources/metrics.test.ts src/lib/server/dashboard.test.ts
```

Expected:

```text
2 test files passed
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/sources/metrics.ts src/lib/sources/metrics.test.ts src/lib/dashboard src/lib/server/dashboard.ts src/lib/server/dashboard.test.ts src/routes/+page.server.ts
git commit -m "feat: add dashboard query model"
```

### Task 12: Add dashboard UI shell, tiles, identity tabs, and refresh polling

**Files:**
- Create: `src/lib/ui/AppShell.svelte`
- Create: `src/lib/ui/HeaderBar.svelte`
- Create: `src/lib/ui/SidebarNav.svelte`
- Create: `src/lib/ui/IdentityTabs.svelte`
- Create: `src/lib/ui/DateRangePicker.svelte`
- Create: `src/lib/ui/url-state.ts`
- Create: `src/lib/ui/url-state.test.ts`
- Create: `src/lib/components/dashboard/SourceTile.svelte`
- Create: `src/lib/components/dashboard/PlatformTileBody.svelte`
- Create: `src/lib/components/dashboard/AnalyticsTileBody.svelte`
- Create: `src/lib/components/dashboard/EventFeedTileBody.svelte`
- Create: `src/lib/components/dashboard/Sparkline.svelte`
- Create: `src/lib/components/dashboard/ManualRefreshButton.svelte`
- Create: `src/routes/api/sources/[source_id]/status/+server.ts`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`
- Pending after auth test harness: `e2e/dashboard-shell.spec.ts`
- Pending after auth test harness: `e2e/dashboard-tiles.spec.ts`

- [ ] **Step 1: Implement URL state helpers**

`src/lib/ui/url-state.ts`:

```ts
import { Identity } from '$lib/identities';
import type { IdentityFilter } from '$lib/types/domain';

export function parseIdentityParam(value: string | null): IdentityFilter {
  if (!value || value === 'all') return 'all';
  return Identity.parse(value);
}

export function setSearchParam(url: URL, key: string, value: string | null): string {
  const next = new URL(url);
  if (value === null || value === '' || value === 'all') next.searchParams.delete(key);
  else next.searchParams.set(key, value);
  return `${next.pathname}${next.search}`;
}
```

- [ ] **Step 2: Implement status polling endpoint**

`src/routes/api/sources/[source_id]/status/+server.ts` returns:

```ts
{
  last_run_at: number | null,
  last_success_at: number | null,
  last_status: string | null,
  last_error: string | null,
  consecutive_failures: number
}
```

- [ ] **Step 3: Implement tile components**

`ManualRefreshButton.svelte` must call:

```ts
await fetch(`/api/refresh/${sourceId}`, {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'X-Requested-With': 'XMLHttpRequest' }
});
```

Then poll `/api/sources/${sourceId}/status` every 2 seconds for 30 seconds.

- [ ] **Step 4: Verify UI state and dashboard build**

Per the Task 12 execution decision, do not add an auth bypass or local Access/JWKS harness in this task. Leave dashboard Playwright specs pending until an auth-capable e2e harness is explicitly added. Verify the URL-state behavior and compiled dashboard instead:

```bash
pnpm vitest run src/lib/ui/url-state.test.ts
pnpm check
pnpm build
```

Expected:

```text
url-state tests pass
Svelte check exits 0
build exits 0
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui src/lib/components/dashboard src/routes/+layout.svelte src/routes/+page.svelte src/routes/api/sources docs/superpowers/plans/2026-05-04-creator-dashboard-implementation.md docs/superpowers/specs/2026-05-04-creator-dashboard-design.md
git commit -m "feat: add dashboard tiles and navigation"
```

### Task 13: Add per-source drill-down route

**Files:**
- Create: `src/lib/server/source-detail.ts`
- Create: `src/lib/server/source-detail.test.ts`
- Create: `src/routes/sources/[id]/+page.server.ts`
- Create: `src/routes/sources/[id]/+page.svelte`
- Create: `src/routes/api/sources/[source_id]/events/+server.ts`
- Create: `src/lib/components/sources/SourceHeader.svelte`
- Create: `src/lib/components/sources/MetricPanel.svelte`
- Create: `src/lib/components/sources/EventsFeed.svelte`
- Create: `src/lib/components/sources/LinkedPosts.svelte`
- Create: `src/lib/components/sources/ContributionHeatmap.svelte`
- Pending after auth test harness: `e2e/source-detail.spec.ts`

- [ ] **Step 1: Implement source detail queries**

`getSourceDetail(db, sourceId, range)` returns source metadata, metric history, secondary metrics, linked posts from `posts_sources`, and first page of events.

- [ ] **Step 2: Implement route load and pagination API**

Unknown source IDs must throw 404. Events endpoint accepts `cursor` and `kind`; it never mutates state.

- [ ] **Step 3: Implement components**

Use `ContributionHeatmap` only for `github-glockyco` and metric `contributions`; use generic metric panels for all other sources.

- [ ] **Step 4: Verify**

Per the Task 12 execution decision, do not add an auth bypass or local Access/JWKS harness in this task. Leave source-detail Playwright specs pending until an auth-capable e2e harness is explicitly added. Verify the source-detail query/API behavior and compiled routes instead:

```bash
pnpm vitest run src/lib/server/source-detail.test.ts src/routes/api/sources/[source_id]/events/server.test.ts
pnpm check
pnpm build
```

Expected:

```text
source detail and events endpoint tests pass
Svelte check exits 0
build exits 0
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/source-detail.ts src/lib/server/source-detail.test.ts src/routes/sources src/routes/api/sources/[source_id]/events src/lib/components/sources src/lib/components/dashboard/SourceTile.svelte docs/superpowers/plans/2026-05-04-creator-dashboard-implementation.md
git commit -m "feat: add source detail pages"
```

---

## Phase 5: Posts subsystem

### Task 14: Add posts schema, normalizer, runtime loader, and sync script

**Files:**
- Create: `posts/.gitkeep`
- Create: `src/lib/posts/schema.ts`
- Create: `src/lib/posts/normalize.ts`
- Create: `src/lib/posts/loader.ts`
- Create: `src/lib/posts/schema.test.ts`
- Create: `src/lib/posts/loader.test.ts`
- Create: `src/lib/posts/__fixtures__/valid-post.md`
- Create: `src/lib/posts/__fixtures__/unknown-source.md`
- Create: `scripts/sync-posts.ts`
- Create: `scripts/sync-posts.test.ts`

- [ ] **Step 1: Add shared schema**

`src/lib/posts/schema.ts`:

```ts
import { z } from 'zod';
import { Identity } from '$lib/identities';

export const PostFrontmatter = z.object({
  posted_at: z.string().datetime(),
  author: Identity,
  platform: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
  related_sources: z.array(z.string()).default([])
});

export type PostFrontmatter = z.infer<typeof PostFrontmatter>;
```

- [ ] **Step 2: Add normalizer**

`src/lib/posts/normalize.ts` takes `{ path, markdown, knownSourceIds }`, parses gray-matter, validates frontmatter, validates every related source, returns:

```ts
{
  slug: string,
  posted_at_ms: number,
  author: 'glockyco' | 'WoW_Much',
  platform: string,
  url: string,
  title: string,
  tags: string[],
  related_sources: string[],
  body: string,
  body_excerpt: string
}
```

Runtime normalization is Worker-safe and does not import Node built-ins. `body_hash` is added by the Node-only sync script from the normalized body.

- [ ] **Step 3: Add runtime loader**

`src/lib/posts/loader.ts` uses:

```ts
const raw = import.meta.glob('/posts/*.md', { eager: true, query: '?raw', import: 'default' });
```

Then calls the shared normalizer and sorts by `posted_at_ms` descending.

- [ ] **Step 4: Add sync script**

`scripts/sync-posts.ts` reads files from `posts/`, calls the same normalizer, writes generated SQL shaped as:

```sql
BEGIN;
DELETE FROM posts_sources;
DELETE FROM posts_index;
INSERT INTO posts_index (slug, posted_at, author, platform, url, title, tags, body_excerpt, body_hash)
VALUES ('2026-04-12-wow-much-040-release', 1775952000000, 'WoW_Much', 'Steam', 'https://example.invalid/post', 'WoW_Much 0.4.0 release', '["release"]', 'Release notes excerpt', 'sha256hex');
INSERT INTO posts_sources (slug, source_id)
VALUES ('2026-04-12-wow-much-040-release', 'thunderstore-wowmuch');
COMMIT;
```

Execute remote sync with:

```bash
pnpm exec wrangler d1 execute creator-dashboard --remote --file .tmp/sync-posts.sql
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run src/lib/posts/schema.test.ts src/lib/posts/loader.test.ts scripts/sync-posts.test.ts
```

Expected:

```text
3 test files passed
```

- [ ] **Step 6: Commit**

```bash
git add posts src/lib/posts scripts/sync-posts.ts scripts/sync-posts.test.ts
git commit -m "feat: add posts metadata sync"
```

### Task 15: Add posts list, detail, markdown body, and performance panel

**Files:**
- Create: `src/lib/server/posts.ts`
- Create: `src/lib/server/posts.test.ts`
- Create: `src/routes/posts/+page.server.ts`
- Create: `src/routes/posts/+page.svelte`
- Create: `src/routes/posts/[slug]/+page.server.ts`
- Create: `src/routes/posts/[slug]/+page.svelte`
- Create: `src/lib/components/posts/PostsFilterBar.svelte`
- Create: `src/lib/components/posts/PostsList.svelte`
- Create: `src/lib/components/posts/PostHeader.svelte`
- Create: `src/lib/components/posts/MarkdownBody.svelte`
- Create: `src/lib/components/posts/PerformancePanel.svelte`
- Pending after auth test harness: `e2e/posts.spec.ts`

- [ ] **Step 1: Implement server queries**

`src/lib/server/posts.ts` exports:

```ts
export async function listPosts(db: D1Database, filters: { author?: string; tag?: string; related_source?: string }) { /* query posts_index/posts_sources */ }
export async function getPostPerformance(db: D1Database, slug: string) { /* before/after metric windows for related sources */ }
```

Performance SQL uses `posts_index` + `posts_sources` and correlated `metric_points` subqueries for a before/after window around `posted_at`.

- [ ] **Step 2: Implement routes**

`/posts` supports query params `author`, `tag`, `related_source`. `/posts/[slug]` loads the body from runtime loader and 404s unknown slugs.

- [ ] **Step 3: Implement UI components**

Desktop `/posts` may be a table; below `md`, render card layout. `MarkdownBody` renders markdown safely; if using a markdown renderer dependency, add it deliberately and test that raw HTML is escaped or sanitized.

- [ ] **Step 4: Verify**

Per the Task 12 execution decision, do not add an auth bypass or local Access/JWKS harness in this task. Leave posts Playwright specs pending until an auth-capable e2e harness is explicitly added. Verify posts queries, shared post metadata code, and compiled routes instead:

```bash
pnpm vitest run src/lib/server/posts.test.ts src/lib/posts/schema.test.ts src/lib/posts/loader.test.ts scripts/sync-posts.test.ts
pnpm check
pnpm build
```

Expected:

```text
posts query and metadata tests pass
Svelte check exits 0
build exits 0
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/posts.ts src/lib/server/posts.test.ts src/routes/posts src/lib/components/posts docs/superpowers/plans/2026-05-04-creator-dashboard-implementation.md
git commit -m "feat: add posts pages"
```

---

## Phase 6: Tier 2 authenticated analytics connectors

### Task 16: Add analytics source registry entries and authenticated connectors

**Files:**
- Modify: `src/lib/connectors/fetchers/index.ts`
- Create: `src/lib/connectors/fetchers/gsc.ts`
- Create: `src/lib/connectors/fetchers/gsc.test.ts`
- Create: `src/lib/connectors/fetchers/gsc.fixture.json`
- Create: `src/lib/connectors/fetchers/bing-webmaster.ts`
- Create: `src/lib/connectors/fetchers/bing-webmaster.test.ts`
- Create: `src/lib/connectors/fetchers/bing-webmaster.fixture.json`
- Create: `src/lib/connectors/fetchers/cf-analytics.ts`
- Create: `src/lib/connectors/fetchers/cf-analytics.test.ts`
- Create: `src/lib/connectors/fetchers/cf-analytics.fixture.json`
- Create: `src/lib/connectors/fetchers/ga4.ts`
- Create: `src/lib/connectors/fetchers/ga4.test.ts`
- Create: `src/lib/connectors/fetchers/ga4.fixture.json`
- Modify: `src/lib/sources/registry.ts`
- Modify: `src/lib/sources/metrics.ts`

- [ ] **Step 1: Export analytics fetchers**

```ts
export { fetchGsc as gsc } from './gsc';
export { fetchBingWebmaster as bingWebmaster } from './bing-webmaster';
export { fetchCfAnalytics as cfAnalytics } from './cf-analytics';
export { fetchGa4 as ga4 } from './ga4';
```

- [ ] **Step 2: Implement GSC connector**

Source IDs:

```text
gsc-glockyco-com -> sc-domain:glockyco.com
gsc-ak-compendium -> https://ancient-kingdoms-compendium.wowmuch1.workers.dev/
gsc-ak-compendium-org -> sc-domain:ancient-kingdoms.compendiums.org
gsc-erenshor-maps -> https://erenshor-maps.wowmuch1.workers.dev/
```

Metrics:

```text
clicks
impressions
ctr
position
```

Dimensions for breakdown rows:

```ts
{ query: string, page: string }
```

- [ ] **Step 3: Implement Bing Webmaster connector**

Source IDs:

```text
bing-glockyco-com -> https://glockyco.com/
bing-ak-compendium -> https://ancient-kingdoms-compendium.wowmuch1.workers.dev/
bing-ak-compendium-org -> https://ancient-kingdoms.compendiums.org/
bing-erenshor-maps -> https://erenshor-maps.wowmuch1.workers.dev/
```

Metrics match GSC: `clicks`, `impressions`, `ctr`, `position`.

- [ ] **Step 4: Implement Cloudflare Web Analytics connector**

Source IDs:

```text
cf-analytics-glockyco-com
cf-analytics-ak-compendium
cf-analytics-erenshor-maps
```

Read `CF_ACCOUNT_ID` plus `CF_ANALYTICS_SITE_TAGS` as configuration. The GraphQL query must filter `viewer.accounts(filter: { accountTag: $accountTag })`; unfiltered account queries can fail with `not authorized for that account` for `cfut_` user tokens even when the token row says "All accounts".

```json
{
  "cf-analytics-glockyco-com": "<paste glockyco.com Web Analytics site_tag from Cloudflare>",
  "cf-analytics-ak-compendium": "<paste AK Compendium Web Analytics site_tag from Cloudflare>",
  "cf-analytics-erenshor-maps": "<paste Erenshor Maps Web Analytics site_tag from Cloudflare>"
}
```

Metrics: `visits`, `pageviews`. Add `{ path }` dimensions only if fixture confirms stable path breakdown.

- [ ] **Step 5: Implement GA4 connector behind config gate**

Metrics: `active_users`, `sessions`, `views`, `event_count`.

Do not enable the `ga4` source in the registry until `GA4_PROPERTY_ID` is present in environment and the intended property scope is confirmed. The connector and tests can exist before live enablement.

- [ ] **Step 6: Enable analytics registry entries**

Add all non-GA4 analytics entries to `sources`. Add `ga4` only once the property ID exists.

- [ ] **Step 7: Run connector tests**

```bash
pnpm vitest run src/lib/connectors/fetchers/gsc.test.ts src/lib/connectors/fetchers/bing-webmaster.test.ts src/lib/connectors/fetchers/cf-analytics.test.ts src/lib/connectors/fetchers/ga4.test.ts src/lib/sources/registry.test.ts src/lib/sources/metrics.test.ts
```

Expected:

```text
6 test files passed
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/connectors/fetchers src/lib/sources/registry.ts src/lib/sources/metrics.ts
git commit -m "feat: add authenticated analytics connectors"
```

---

## Phase 7: Analytics backfill

### Task 17: Add shared backfill utilities

**Files:**
- Create: `scripts/backfill/lib/env.ts`
- Create: `scripts/backfill/lib/sql.ts`
- Create: `scripts/backfill/lib/windows.ts`
- Create: `scripts/backfill/lib/run.ts`
- Create: `scripts/backfill/lib/sql.test.ts`
- Create: `scripts/backfill/lib/windows.test.ts`

- [ ] **Step 1: Implement environment loading**

`env.ts` reads local process env names matching Worker secrets:

```ts
const required = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN', 'GSC_PROPERTIES', 'BING_WEBMASTER_API_KEY', 'BING_PROPERTIES', 'CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CF_ANALYTICS_SITE_TAGS'];
```

Include `GA4_PROPERTY_ID` only for GA4 backfill.

- [ ] **Step 2: Implement SQL generation**

`sql.ts` exports:

```ts
export function metricInsertSql(rows: MetricPoint[]): string;
export function transaction(chunks: string[]): string;
```

Generated SQL must use `INSERT OR IGNORE INTO metric_points (source_id, metric, ts, value, dimensions)` and escape string values.

- [ ] **Step 3: Implement windows**

`windows.ts` exports day/month windows for:

```text
GSC: 16 months
GA4: 14 months
Bing: returned upstream range
CF: 6 months by default
```

- [ ] **Step 4: Verify**

```bash
pnpm vitest run scripts/backfill/lib/sql.test.ts scripts/backfill/lib/windows.test.ts
```

Expected:

```text
2 test files passed
```

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill/lib
git commit -m "feat: add analytics backfill utilities"
```

### Task 18: Add analytics backfill scripts

**Files:**
- Create: `scripts/backfill-gsc.ts`
- Create: `scripts/backfill-gsc.test.ts`
- Create: `scripts/backfill-ga4.ts`
- Create: `scripts/backfill-ga4.test.ts`
- Create: `scripts/backfill-bing.ts`
- Create: `scripts/backfill-bing.test.ts`
- Create: `scripts/backfill-cf.ts`
- Create: `scripts/backfill-cf.test.ts`
- Modify: `src/lib/connectors/fetchers/gsc.ts`
- Modify: `src/lib/connectors/fetchers/ga4.ts`
- Modify: `src/lib/connectors/fetchers/bing-webmaster.ts`
- Modify: `src/lib/connectors/fetchers/cf-analytics.ts`
- Create: `src/lib/sources/registry-data.ts`
- Modify: `src/lib/sources/registry.ts`
- Modify: `src/lib/connectors/http.ts`
- Modify: `scripts/backfill/lib/run.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify tests for those connector date-range helpers as needed.

- [ ] **Step 1: Implement backfill scripts with dry-run output**

Each script supports:

```text
--dry-run --out .tmp/backfill-<source>.sql
--execute-remote
```

`--dry-run` writes SQL only. `--execute-remote` runs:

```bash
pnpm exec wrangler d1 execute creator-dashboard --remote --file <generated.sql>
```

- [ ] **Step 2: Use connector modules, not duplicated parsing**

Each script calls the relevant connector date-range helper. Task 18 adds those helper exports where the scheduled connector currently only supports "yesterday", and keeps response schemas and metric mapping shared in the connector module. Scripts convert rows to SQL batches of roughly 500 rows per transaction.

- [ ] **Step 3: Verify script tests and dry-runs**

```bash
pnpm vitest run scripts/backfill-gsc.test.ts scripts/backfill-ga4.test.ts scripts/backfill-bing.test.ts scripts/backfill-cf.test.ts
node --experimental-strip-types scripts/backfill-gsc.ts --dry-run --out .tmp/backfill-gsc.sql
node --experimental-strip-types scripts/backfill-bing.ts --dry-run --out .tmp/backfill-bing.sql
node --experimental-strip-types scripts/backfill-cf.ts --dry-run --out .tmp/backfill-cf.sql
node --experimental-strip-types scripts/backfill-ga4.ts --dry-run --out .tmp/backfill-ga4.sql
```

Expected:

```text
4 test files passed
.tmp/backfill-*.sql files contain only INSERT OR IGNORE statements inside transactions
```

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-*.ts scripts/backfill-*.test.ts
git commit -m "feat: add analytics backfill scripts"
```

---

## Phase 8: Timeline, digest, settings, mobile polish

### Task 19: Add timeline correlation view

**Files:**
- Create: `src/lib/timeline/schema.ts`
- Create: `src/lib/timeline/schema.test.ts`
- Create: `src/lib/server/timeline.ts`
- Create: `src/lib/server/timeline.test.ts`
- Create: `src/lib/timeline/domain.svelte.ts`
- Create: `src/lib/components/timeline/TimelineFilterBar.svelte`
- Create: `src/lib/components/timeline/OverlayToggleGroup.svelte`
- Create: `src/lib/components/timeline/TimelineChart.svelte`
- Create: `src/lib/components/timeline/TimelineEventLog.svelte`
- Create: `src/routes/timeline/+page.server.ts`
- Create: `src/routes/timeline/+page.svelte`
- Create: `e2e/timeline.spec.ts`
- Modify: `scripts/e2e-server.ts`

- [ ] **Step 1: Validate URL filters**

`schema.ts` validates:

```text
since: YYYY-MM-DD
until: YYYY-MM-DD
sources: comma-separated source IDs
overlay: posts,events or one of those
```

- [ ] **Step 2: Implement server reads**

`timeline.ts` performs three reads:

```sql
SELECT source_id, metric, ts, value, dimensions FROM metric_points WHERE source_id IN (?1, ?2) AND ts BETWEEN ?3 AND ?4 ORDER BY ts;
SELECT source_id, external_id, ts, kind, title, body, url FROM events WHERE source_id IN (?1, ?2) AND ts BETWEEN ?3 AND ?4 ORDER BY ts;
SELECT p.slug, p.posted_at, p.author, p.title, p.url, ps.source_id FROM posts_index p JOIN posts_sources ps ON ps.slug = p.slug WHERE ps.source_id IN (?1, ?2) AND p.posted_at BETWEEN ?3 AND ?4 ORDER BY p.posted_at;
```

- [ ] **Step 3: Render client-side Plot charts**

`TimelineChart.svelte` imports `@observablehq/plot` in browser code and renders into a bind:this container. Event markers use `var(--color-event)`, post markers use `var(--color-post)`. Do not add pinch zoom; use filter controls.

- [ ] **Step 4: Verify**

```bash
pnpm vitest run src/lib/timeline/schema.test.ts src/lib/server/timeline.test.ts
pnpm playwright test e2e/timeline.spec.ts --project=chromium
```

Expected:

```text
timeline filters and D1 query tests pass
Playwright confirms metric line, event marker, post marker, and chronological log render from seeded data
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline src/lib/server/timeline.ts src/lib/server/timeline.test.ts src/lib/components/timeline src/routes/timeline e2e/timeline.spec.ts scripts/e2e-server.ts
git commit -m "feat: add timeline correlation view"
```

### Task 19.5: Add real-world connector smoke verification

**Reason:** Unit tests and fixture tests verify parser intent, but they do not prove current upstream schemas, URLs, credentials, or runtime imports work. Before adding digest logic, add a live smoke harness and run public sources.

**Files:**
- Create: `scripts/smoke-connectors.ts`
- Create: `scripts/smoke-connectors.test.ts`
- Modify: `package.json`
- Modify live-drifted public connectors/tests as smoke evidence requires.

- [x] **Step 1: Add smoke harness**

`scripts/smoke-connectors.ts` loads the real source registry through Vite SSR, reads `.dev.vars` plus process env, runs selected source fetchers sequentially, prints sanitized metric/event counts and small samples, and never writes D1, sends queue jobs, or alerts.

Commands:

```bash
pnpm smoke:public
pnpm smoke:authenticated
pnpm smoke:connectors -- --source github-glockyco --strict
```

- [x] **Step 2: Run real public smoke and fix observed schema drift**

Run `pnpm smoke:public`. If a public connector fails against live upstream JSON, add a targeted failing fixture test for that live shape, fix the connector schema/mapping, and rerun smoke.

Observed first smoke drift:
- Steam reviews can return `weighted_vote_score` as either number or string.
- Thunderstore `/api/experimental/package/` is paginated and uses `total_downloads`; community-scoped v1 package lists remain more suitable for team aggregate metrics.
- MediaWiki flag fields can be empty strings when flags are present.
- Steam guide stats moved to `IPublishedFileService/GetDetails/v1` (GET, key required, `includevotes=true`); the legacy `ISteamRemoteStorage/GetPublishedFileDetails/v1` is POST-only and returns `result: k_EResultFileNotFound` for current guide IDs.
- GSC migrated off service-account auth: Google's "Add user" UI and Site Verification -> Search Console permission propagation are both broken (acknowledged April 23, 2026; no fix as of May 1, 2026). Switched to OAuth refresh-token flow bound to `jaichberg@gmail.com`, who is already verified owner of all three GSC properties. Connector also moved from `https://www.googleapis.com/webmasters/v3/...` to `https://searchconsole.googleapis.com/webmasters/v3/...` and now passes `dataState: 'all'` for fresh/unfinalized data. Service-account credential retained for future GA4 use.
- Cloudflare Web Analytics GraphQL needs `accounts(filter: {accountTag: $accountTag})` even when the API token is scoped "All accounts". `cfut_` user tokens evaluate per-account authz at query time, so the unfiltered `viewer { accounts { ... } }` shape returns `not authorized for that account` when any account in the user's set is unreachable. Connector now reads `CF_ACCOUNT_ID` and passes it as the `$accountTag` variable.

- [x] **Step 3: Verify and commit**

```bash
pnpm vitest run scripts/smoke-connectors.test.ts src/lib/connectors/fetchers/steam-reviews.test.ts src/lib/connectors/fetchers/thunderstore-team.test.ts src/lib/connectors/fetchers/mediawiki-recent-changes.test.ts
pnpm smoke:public
pnpm smoke:authenticated
pnpm check
git add package.json scripts/smoke-connectors.ts scripts/smoke-connectors.test.ts src/lib/connectors/fetchers/steam-reviews.ts src/lib/connectors/fetchers/steam-reviews.test.ts src/lib/connectors/fetchers/thunderstore-team.ts src/lib/connectors/fetchers/thunderstore-team.test.ts src/lib/connectors/fetchers/mediawiki-recent-changes.ts src/lib/connectors/fetchers/mediawiki-recent-changes.test.ts docs/superpowers
git commit -m "test: add real connector smoke checks"
```



### Task 20: Add daily digest with Vienna guard and dedupe

**Files:**
- Create: `src/lib/digest/vienna.ts`
- Create: `src/lib/digest/vienna.test.ts`
- Create: `src/lib/digest/query.ts`
- Create: `src/lib/digest/query.test.ts`
- Create: `src/lib/digest/format.ts`
- Create: `src/lib/digest/format.test.ts`
- Create: `src/lib/digest/send.ts`
- Create: `src/lib/digest/send.test.ts`
- Create: `src/lib/server/worker/scheduled.test.ts`
- Modify: `src/lib/server/worker/scheduled.ts`

- [x] **Step 1: Confirm digest dedupe table exists**

`migrations/0001_initial_schema.sql` already creates `digest_sent (digest_date TEXT PRIMARY KEY, sent_at INTEGER NOT NULL)`. Do not add a second migration for this table.

- [x] **Step 2: Implement Vienna guard**

`src/lib/digest/vienna.ts`:

```ts
export function viennaDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isViennaDigestHour(now: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Vienna', hour: 'numeric', hour12: false }).format(now));
  return hour === 6;
}
```

- [x] **Step 3: Implement digest query and format**

`query.ts` reads scalar metric rows (`dimensions IS NULL`), event rows, posts, fetcher runs, and failures over the half-open rolling window `now - 24h <= ts < now`. `format.ts` produces rich Discord embeds in this order: `glockyco`, `WoW_Much`, `Posts`, `Health`. Do not use emoji in code comments or commit messages; digest message content uses plain text plus Discord embeds.

- [x] **Step 4: Wire scheduled handler**

For cron `0 4,5 * * *`:

```ts
if (controller.cron === '0 4,5 * * *') {
  await maybeDailyDigest(env, new Date());
}
```

`maybeDailyDigest` checks `isViennaDigestHour`, then `digest_sent`, then posts Discord, then inserts `digest_sent`.

- [x] **Step 5: Verify**

```bash
pnpm vitest run src/lib/digest/vienna.test.ts src/lib/digest/query.test.ts src/lib/digest/format.test.ts src/lib/digest/send.test.ts src/lib/server/worker/scheduled.test.ts
```

Expected:

```text
DST summer and winter tests pass
digest dedupe test proves one send per Vienna date
```

- [x] **Step 6: Commit**

```bash
git add src/lib/digest src/lib/server/worker/scheduled.ts
git commit -m "feat: add daily digest"
```

### Task 21: Add Settings page and mobile refinement

**Files:**
- Create: `src/lib/settings/schema.ts`
- Create: `src/lib/settings/store.svelte.ts`
- Create: `src/lib/settings/settings.test.ts`
- Create: `src/routes/settings/+page.svelte`
- Create: `src/lib/components/settings/SettingsForm.svelte`
- Create: `src/lib/components/settings/ThemeToggle.svelte`
- Create: `src/lib/components/settings/DefaultDateRangeSelect.svelte`
- Create: `src/lib/components/settings/IdentityColorInputs.svelte`
- Modify: `src/app.html`
- Modify: `src/app.css`
- Modify: `src/lib/ui/AppShell.svelte`
- Modify: `src/lib/ui/SidebarNav.svelte`
- Modify: `src/lib/components/dashboard/SourceTile.svelte`
- Modify: `src/lib/components/posts/PostsList.svelte`
- Modify: `src/lib/components/timeline/TimelineChart.svelte`
- Create: `e2e/settings.spec.ts`
- Create: `e2e/mobile.spec.ts`

- [x] **Step 1: Add client settings schema**

Settings shape:

```ts
{
  theme: 'dark' | 'light' | 'system',
  defaultDateRange: '7d' | '30d' | '90d',
  identityColors: {
    glockyco: string,
    WoW_Much: string
  }
}
```

Defaults:

```ts
{
  theme: 'dark',
  defaultDateRange: '30d',
  identityColors: { glockyco: '#6366f1', WoW_Much: '#f59e0b' }
}
```

- [x] **Step 2: Implement localStorage store**

`store.svelte.ts` validates stored data with Zod, falls back to defaults on invalid storage, sets `color-scheme` and identity CSS custom properties on `<html>`.

- [x] **Step 3: Implement settings UI**

Settings are client-only. Do not add a server load or D1 table for preferences.

- [x] **Step 4: Implement mobile polish**

Required assertions:

```text
sidebar collapses below 768px
tile grid: 1 column base, 2 columns md, 3 columns xl
charts are horizontally scrollable on narrow screens
touch targets for nav, refresh, filters, and settings controls are at least 44px
posts list renders cards below md
```

- [x] **Step 5: Verify**

```bash
pnpm vitest run src/lib/settings/settings.test.ts
pnpm playwright test e2e/settings.spec.ts e2e/mobile.spec.ts --project=chromium
```

Expected:

```text
settings schema/store tests pass
Playwright confirms persisted settings and mobile layout assertions
```

- [x] **Step 6: Commit**

```bash
git add src/lib/settings src/routes/settings src/lib/components/settings src/app.html src/app.css src/lib/ui src/lib/components/dashboard src/lib/components/posts src/lib/components/timeline e2e/settings.spec.ts e2e/mobile.spec.ts
git commit -m "feat: add settings and mobile polish"
```

---

## Final verification before first manual deploy

Run only after deployment-readiness planning and smoke implementation are complete. Do not treat connector smoke as a full deploy smoke; it bypasses queues and D1 writes.

Resource preflight:

```text
wrangler.toml has a real D1 database_id, not the placeholder
remote D1 database exists and migrations are applied
Cloudflare Queues exist: creator-dashboard-fetchers and creator-dashboard-fetcher-dlq
production secrets are present: Access, Discord, GitHub, Steam, Google OAuth, Bing, Cloudflare Analytics
GA4 live integration is complete, or its remaining blocker is explicitly documented with the exact missing Google property/access information
```

Safe local verification order:

```bash
pnpm lint
pnpm check
pnpm vitest run
pnpm build
pnpm smoke:public
pnpm smoke:connectors --source github-glockyco --source gsc-ak-compendium-org --source bing-ak-compendium-org --source cf-analytics-ak-compendium --strict
# Then run the planned local ingest smoke and hourly cron/queue smoke.
```

Deployment order after local smoke is green:

```bash
pnpm migrate:remote
pnpm build
pnpm exec wrangler deploy
pnpm sync-posts
# Then run the planned post-deploy verification script/checklist.
```

Expected:

```text
lint/check/unit tests/build exit 0
connector smoke confirms live upstream auth and schemas for selected sources
local ingest smoke proves a queued/manual source job persists fetcher_runs plus metric/event rows
local hourly cron/queue smoke proves scheduled dispatch enqueues and consumer drains without alerting or DLQ traffic
remote migrations apply cleanly
manual deploy succeeds
post-deploy verification proves dashboard auth, manual refresh, queue consumer persistence, and no unexpected digest/DLQ alerts
```

Manual post-deploy checks:

```bash
pnpm exec wrangler tail creator-dashboard
```

Then visit `https://dashboard.glockyco.com` through Cloudflare Access and confirm:

```text
Access login succeeds with GitHub OAuth
Worker-side JWT verification does not reject the authenticated session
Dashboard, Health, Posts, Timeline, and Settings pages load
Manual refresh enqueues a job
Fetcher run appears in Health after the queue consumer completes
No workers.dev preview URL is reachable because workers_dev=false and preview_urls=false
```

---

## Execution notes for the implementing agent

- If a task requires real secrets, create or update `.dev.vars`; never commit `.dev.vars`.
- If Phase 6 begins before `GA4_PROPERTY_ID` exists, implement and test `ga4.ts` but leave the live `ga4` source disabled in `sources` until the property ID is supplied.
- If the initial Worker wrapper strategy fails under Wrangler, stop and solve that boundary before implementing Phase 2. The single-Worker architecture depends on it.
- If a connector fixture reveals upstream fields differ from the expected schema, update the connector schema and test fixture together; do not weaken the schema to `z.any()`.
- If a UI route needs new data, add a server query function under `src/lib/server/*` first, test it, then render it. Do not query D1 directly inside Svelte components.
