# Creator Dashboard — Design Spec

> **Status:** Working draft, brainstorming in progress (2026-05-04). Uncommitted.
> **Hard gate:** No implementation begins until this spec is approved end-to-end and an implementation plan is written via the `writing-plans` skill.

---

## 0. Overview

A private, single-user "creator dashboard" that aggregates engagement metrics, content events, and the user's own social-media writings across the platforms where the user is active. Replaces a daily manual round-trip through ~10 sites with one unified view, retains historical data so trends emerge, and overlays the user's own posts as time-series markers so cause/effect on engagement is visible.

### 0.1 Identities

The user has two distinct creator personas, both modeled as first-class:

- **`glockyco`** — professional/academic identity (PhD researcher; GitHub @glockyco; johannglock.com / glockyco.com).
- **`WoW_Much`** — gaming/mods identity (Steam Guides, Thunderstore mods, Ancient Kingdoms Compendium site, Erenshor Maps site, Erenshor wiki contributions, Ko-fi).

Sources, posts, dashboard tabs, and digest sections are all keyed by identity. Adding a third identity later is a code change (registry + UI tabs), not a data migration.

### 0.2 Sources tracked (initial set)

| ID                               | Identity   | Category    | Cadence | Notes                                              |
| -------------------------------- | ---------- | ----------- | ------- | -------------------------------------------------- |
| `github-glockyco`                | glockyco   | platform    | 1h      | Followers, total stars, daily contributions grid   |
| `gsc-glockyco-com`               | glockyco   | analytics   | 24h     | `sc-domain:glockyco.com`                           |
| `steam-guide-erenshor`           | WoW_Much   | platform    | 1h      | publishedfileid `3500398991`                       |
| `steam-guide-ak`                 | WoW_Much   | platform    | 1h      | publishedfileid `3616580411`                       |
| `steam-reviews-erenshor`         | WoW_Much   | event_feed  | 1h      | appid `2382520`                                    |
| `steam-reviews-ak`               | WoW_Much   | event_feed  | 1h      | appid `2241380`                                    |
| `thunderstore-wowmuch`           | WoW_Much   | platform    | 1h      | community `erenshor`, namespace `WoW_Much`, multiple packages auto-discovered |
| `erenshor-wiki-recent`           | WoW_Much   | event_feed  | 1h      | MediaWiki recent changes feed                      |
| `gsc-ak-compendium`              | WoW_Much   | analytics   | 24h     | URL-prefix property                                |
| `gsc-erenshor-maps`              | WoW_Much   | analytics   | 24h     | URL-prefix property                                |
| `bing-glockyco-com`              | glockyco   | analytics   | 24h     | `https://glockyco.com/`                            |
| `bing-ak-compendium`             | WoW_Much   | analytics   | 24h     | `https://ancient-kingdoms-compendium.wowmuch1.workers.dev/`  |
| `bing-erenshor-maps`             | WoW_Much   | analytics   | 24h     | `https://erenshor-maps.wowmuch1.workers.dev/`      |
| `cf-analytics-glockyco-com`      | glockyco   | analytics   | 1h      | Auto Web Analytics (proxied zone)                  |
| `cf-analytics-ak-compendium`     | WoW_Much   | analytics   | 1h      | Web Analytics JS snippet (Worker)                  |
| `cf-analytics-erenshor-maps`     | WoW_Much   | analytics   | 1h      | Web Analytics JS snippet (Worker)                  |
| `ga4` (TBD property ID)          | glockyco   | analytics   | 24h     | Property covers ko-fi.com page traffic; identity assignment finalized when property scope is confirmed |

**Out of scope:**

- **Ko-fi direct integration.** No public read API; webhook-only is payment-only. Already covered indirectly via GA4 (Ko-fi page tracking). Dropped to avoid effort/value mismatch.

### 0.3 Non-goals

- Public access. Single-user tool behind auth.
- Real-time alerting on every metric change. A daily digest is enough; immediate alerts only for system health (broken connectors), not engagement deltas.
- Replacing GSC/GA4 dashboards in their own apps. We surface enough to spot trends; deep-dive means clicking through.
- Mobile editorial workflow ("write a post from my phone"). Posts are markdown files in the repo, edited from a workstation.

---

## 1. Foundation

### 1.1 Repository

**`glockyco/creator-dashboard`** — new private GitHub repo, sibling to `personal-website`. Not a submodule.

```
~/Projects/
├── personal-website/        public, static (adapter-static)
├── creator-dashboard/       private, server runtime (adapter-cloudflare)  ← this project
└── ...
```

### 1.2 Stack

| Layer            | Choice                                                  |
| ---------------- | ------------------------------------------------------- |
| Framework        | SvelteKit 2 + Svelte 5 + TypeScript                     |
| Adapter          | `@sveltejs/adapter-cloudflare` (server-rendered Worker) |
| Styling          | Tailwind CSS 4 (zero-config Vite plugin)                |
| Validation       | Zod 4                                                   |
| Markdown parsing | `gray-matter` for frontmatter                           |
| Database         | Cloudflare D1 (SQLite at the edge)                      |
| Orchestration    | Cloudflare Cron Triggers + Cloudflare Queues            |
| Auth             | Cloudflare Access + GitHub OAuth + JWT verify (`jose`)  |
| Charting         | `@observablehq/plot`                                    |
| Build/deploy     | Wrangler                                                |

**Stack rationale (research-validated):**

- **D1 for everything**, not Workers Analytics Engine. WAE has hard 3-month retention and built-in sampling that's wrong for "every measurement is deliberate." At ~5 MB/year, D1's free tier (5 GB) holds ~1000× our annual volume and uses standard SQL (joins, JSON1, full aggregation).
- **Tailwind**, not plain CSS. Dashboard work is dense and variant-heavy (tiles, badges, status pills, sparkline frames). Tailwind's utility-first model fits this better than hand-rolled CSS for a single-purpose tool. Plain CSS shines for editorial sites; this isn't one. (Two of three sibling projects already use Tailwind 4 — familiarity argument supports it.)
- **Cron Trigger → Queues fan-out**, not Workflows. Workflows is sequential and journals every step (1 MiB persisted per step, 30-day retention) — wasted overhead for fire-and-forget hourly fetches. Queues gives per-fetcher retry isolation, configurable backoff up to 24h (perfect for HTTP 429 with `Retry-After`), DLQ, and avoids the 6-concurrent-connections-per-Worker ceiling we'd hit with `Promise.all` in a single handler.
- **Observable Plot** for charts. The correlation view (time-series + post markers + external-event markers + tooltip) reduces to a small `Plot.lineY()` + `Plot.ruleX()` + `Plot.pointer()` composition. Single library covers heatmap (`Plot.cell()` with year facets), bar, sparkline. Rendering is client-side in Svelte components unless a Worker-compatible DOM strategy is explicitly added and tested. Mike Bostock + Observable Inc., ISC.
- **Cloudflare Access**, not Worker-hosted OAuth. Free for ≤50 users (we have 1). GitHub OAuth integration is first-class. Same-origin `fetch()` carries the `CF_Authorization` cookie automatically. JWT validation is ~15 lines with `jose`'s `createRemoteJWKSet` (handles 6-week key rotation transparently). Worker-hosted OAuth (Lucia/Auth.js) would be more code we own and audit, with no payoff at single-user scale.

### 1.3 Deployment

**Single Worker** (`creator-dashboard`) on `dashboard.glockyco.com`, with three roles:

1. SvelteKit HTTP handler (dashboard pages, API endpoints, manual refresh)
2. Scheduled handler (Cron Triggers — hourly dispatcher, daily digest)
3. Queue handler (fetcher-queue + fetcher-dlq consumers)

All HTTP routes are uniformly Access-protected — no public path exclusions.

**`wrangler.toml`** (skeleton):

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
database_id   = "<from `pnpm exec wrangler d1 create creator-dashboard`>"

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

`workers_dev = false` and `preview_urls = false` close off the workers.dev URL so nothing leaks unauthenticated.

The deployed Worker uses a generated wrapper at `.svelte-kit/cloudflare/worker.js`: after SvelteKit builds its adapter output to that path, `scripts/write-worker-wrapper.ts` renames the adapter output to `.svelte-kit/cloudflare/sveltekit-worker.js`, then writes a wrapper that delegates `fetch` to `sveltekit-worker.js` and exports source-controlled `scheduled` / `queue` handlers. This keeps the approved single-Worker architecture while matching Cloudflare's module-worker handler model.

### 1.4 Auth — Cloudflare Access

```
Browser ─[GitHub OAuth via Access]→ CF Access edge ─[CF_Authorization cookie]→ Worker
                                                                          ├─→ JWT verified against JWKS (jose)
                                                                          └─→ user email available in Cf-Access-Authenticated-User-Email header
```

- Free tier (50 users) → 1 user.
- 30-day global session lifetime.
- All dashboard `fetch()` calls send `credentials: 'same-origin'` and `X-Requested-With: XMLHttpRequest` (so expired sessions return 401, not a 302 to the login page that `fetch()` would silently follow).
- Worker validates `Cf-Access-Jwt-Assertion` itself using `jose`'s `createRemoteJWKSet` against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`. Access at the edge isn't enough if any path becomes directly reachable.
- Cron-triggered scheduled events bypass Access automatically (internal).

### 1.5 Secrets (Wrangler `secret put`)

```
GITHUB_PAT                  read:user, public_repo
STEAM_WEB_API_KEY           steamcommunity.com/dev
GOOGLE_OAUTH_CLIENT_ID      OAuth Web client ID, used by GSC (refresh-token flow)
GOOGLE_OAUTH_CLIENT_SECRET  OAuth Web client secret, used by GSC
GOOGLE_OAUTH_REFRESH_TOKEN  Long-lived refresh token for jaichberg@gmail.com (webmasters.readonly)
GOOGLE_SERVICE_ACCOUNT      JSON service-account credential, retained for future GA4 use
GSC_PROPERTIES              JSON list — sites to query (matches registry, redundant guard)
GA4_PROPERTY_ID             single property ID
BING_WEBMASTER_API_KEY      bing.com/webmasters API key
BING_PROPERTIES             JSON list — site URLs to query (matches registry, redundant guard)
CF_API_TOKEN                Account Analytics:Read (Web Analytics)
CF_ANALYTICS_SITE_TAGS      JSON map — registry source-id → Web Analytics site_tag (one per tracked site)
DISCORD_DIGEST_WEBHOOK      daily 06:00 Vienna summary
DISCORD_ALERTS_WEBHOOK      permanent + DLQ alerts
ACCESS_TEAM_DOMAIN          e.g. yourteam.cloudflareaccess.com — for jose JWKS
ACCESS_AUD                  Access application AUD tag — for jose audience check
```

Local dev uses `.dev.vars` (gitignored) for Wrangler-bound secrets. Use `.env.local` only for future SvelteKit-only tooling that does not run through Wrangler.

---

## 2. Data Model

### 2.1 Identities (static config)

```typescript
// src/lib/identities.ts
import { z } from 'zod';

export const identities = ['glockyco', 'WoW_Much'] as const;
export type Identity = typeof identities[number];
export const Identity = z.enum(identities);

export const identityMeta: Record<Identity, { displayName: string; description: string }> = {
  glockyco: { displayName: 'glockyco', description: 'Professional / academic identity' },
  WoW_Much: { displayName: 'WoW_Much', description: 'Gaming / mods identity' },
};
```

### 2.2 D1 schema

```sql
-- Scalar + dimensioned metrics in one table; dimensions=null for scalar.
CREATE TABLE metric_points (
  source_id  TEXT    NOT NULL,
  metric     TEXT    NOT NULL,
  ts         INTEGER NOT NULL,            -- Unix ms (UTC)
  value      REAL    NOT NULL,
  dimensions TEXT,                        -- nullable JSON; e.g. {"query":"x","page":"/y"}
  PRIMARY KEY (source_id, metric, ts, dimensions)
);
CREATE INDEX idx_mp_source_metric_ts ON metric_points(source_id, metric, ts);
CREATE INDEX idx_mp_ts                ON metric_points(ts);

-- Event log: review bodies, wiki edits, releases, anything timestamped with content.
CREATE TABLE events (
  source_id   TEXT    NOT NULL,
  external_id TEXT    NOT NULL,           -- recommendationid / rcid / GH event id / ...
  ts          INTEGER NOT NULL,
  kind        TEXT    NOT NULL,           -- 'review' | 'wiki_edit' | 'commit' | 'release' | ...
  author      TEXT,
  title       TEXT,
  body        TEXT,
  url         TEXT,
  metadata    TEXT,                       -- JSON for kind-specific extras
  PRIMARY KEY (source_id, external_id)
);
CREATE INDEX idx_ev_source_ts ON events(source_id, ts DESC);
CREATE INDEX idx_ev_ts        ON events(ts DESC);
CREATE INDEX idx_ev_kind_ts   ON events(kind, ts DESC);

-- Per-source state (cadence gate + "last fetched X ago" UI).
CREATE TABLE fetcher_runs (
  source_id            TEXT    PRIMARY KEY,
  last_run_at          INTEGER NOT NULL,
  last_success_at      INTEGER,
  last_status          TEXT    NOT NULL,  -- 'success' | 'transient_failure' | 'permanent_failure' | 'rate_limited_failure'
  last_error           TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);

-- Audit trail for digest "Health" section + on-page diagnostics.
CREATE TABLE fetcher_failures (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id     TEXT    NOT NULL,
  ts            INTEGER NOT NULL,
  tier          TEXT    NOT NULL,         -- 'transient' | 'permanent' | 'rate_limited' | 'dlq'
  status_code   INTEGER,
  error_message TEXT    NOT NULL
);
CREATE INDEX idx_ff_ts        ON fetcher_failures(ts DESC);
CREATE INDEX idx_ff_source_ts ON fetcher_failures(source_id, ts DESC);

-- Dedup the immediate Discord alerts so we don't repost the same failure each retry attempt.
CREATE TABLE alerts_sent (
  alert_key TEXT PRIMARY KEY,             -- e.g. 'permanent:gsc-glockyco-com:401'
  sent_at   INTEGER NOT NULL
);

-- Dedup the daily digest external side effect so cron replays/retries do not repost.
CREATE TABLE digest_sent (
  digest_date TEXT PRIMARY KEY,             -- Vienna date key, e.g. '2026-05-04'
  sent_at     INTEGER NOT NULL
);

-- Posts metadata cache (canonical body lives in repo as markdown).
CREATE TABLE posts_index (
  slug         TEXT    PRIMARY KEY,
  posted_at    INTEGER NOT NULL,
  author       TEXT    NOT NULL,          -- 'glockyco' | 'WoW_Much'
  platform     TEXT    NOT NULL,
  url          TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  tags         TEXT    NOT NULL,          -- JSON array
  body_excerpt TEXT,                      -- first ~200 chars for previews
  body_hash    TEXT    NOT NULL           -- sha-256 of body
);
CREATE INDEX idx_posts_posted_at ON posts_index(posted_at DESC);
CREATE INDEX idx_posts_author_ts ON posts_index(author, posted_at DESC);

-- Normalized many-to-many for posts ↔ sources (the join that makes correlation queries cheap).
CREATE TABLE posts_sources (
  slug      TEXT NOT NULL,
  source_id TEXT NOT NULL,
  PRIMARY KEY (slug, source_id)
);
CREATE INDEX idx_ps_source ON posts_sources(source_id);
```

**Design rationale:**

- **Single `metric_points` table for scalar + dimensioned.** SQLite's JSON1 is enough for top-N over `dimensions`. Splitting tables doubles connector code paths and forbids unified timeline queries. At our scale denormalization wins.
- **`(source_id, external_id)` PK on events** = natural idempotency. Re-fetching same review batch hourly does `INSERT OR IGNORE` and writes only new ones. No connector-level dedup needed.
- **`metadata` JSON column on events** = absorbs kind-specific extras (vote_score, helpful_count, edit_size_delta) without schema migrations.
- **`alerts_sent` dedup keyed by `tier:source_id:error_class`** with 24h TTL prevents Discord spam during sustained outages while still re-firing daily for unresolved problems.
- **`digest_sent` dedup keyed by Vienna date** prevents replayed scheduled events from reposting the daily Discord digest.
- **Posts metadata in D1 + body in repo** — hybrid. SQL-joinable correlation queries; markdown remains the editorial source of truth.

### 2.3 Source registry

Single source of truth, code-as-config:

```typescript
// src/lib/sources/registry.ts
import { z } from 'zod';
import { Identity } from '$lib/identities';
import * as fetchers from './fetchers';

const SourceDef = z.object({
  id:           z.string(),
  name:         z.string(),
  identity:     Identity,
  category:     z.enum(['platform', 'analytics', 'event_feed']),
  cadenceHours: z.number().int().positive(),
  fetcher:      z.function(),
  config:       z.record(z.unknown()).default({}),
});
export type SourceDef = z.infer<typeof SourceDef>;

export const sources: SourceDef[] = z.array(SourceDef).parse([
  { id: 'github-glockyco',         identity: 'glockyco', name: 'GitHub @glockyco',                category: 'platform',   cadenceHours: 1,  fetcher: fetchers.github,                 config: {} },
  { id: 'gsc-glockyco-com',        identity: 'glockyco', name: 'GSC: glockyco.com',               category: 'analytics',  cadenceHours: 24, fetcher: fetchers.gsc,                    config: { siteUrl: 'sc-domain:glockyco.com' } },
  { id: 'steam-guide-erenshor',    identity: 'WoW_Much', name: 'Steam Guide: Erenshor Maps',      category: 'platform',   cadenceHours: 1,  fetcher: fetchers.steamGuide,             config: { publishedfileid: '3500398991' } },
  { id: 'steam-guide-ak',          identity: 'WoW_Much', name: 'Steam Guide: AK Compendium',      category: 'platform',   cadenceHours: 1,  fetcher: fetchers.steamGuide,             config: { publishedfileid: '3616580411' } },
  { id: 'steam-reviews-erenshor',  identity: 'WoW_Much', name: 'Steam Reviews: Erenshor',         category: 'event_feed', cadenceHours: 1,  fetcher: fetchers.steamReviews,           config: { appid: '2382520' } },
  { id: 'steam-reviews-ak',        identity: 'WoW_Much', name: 'Steam Reviews: Ancient Kingdoms', category: 'event_feed', cadenceHours: 1,  fetcher: fetchers.steamReviews,           config: { appid: '2241380' } },
  { id: 'thunderstore-wowmuch',    identity: 'WoW_Much', name: 'Thunderstore: WoW_Much',          category: 'platform',   cadenceHours: 1,  fetcher: fetchers.thunderstoreTeam,       config: { namespace: 'WoW_Much', community: 'erenshor' } },
  { id: 'erenshor-wiki-recent',    identity: 'WoW_Much', name: 'Erenshor Wiki: Recent Changes',   category: 'event_feed', cadenceHours: 1,  fetcher: fetchers.mediaWikiRecentChanges, config: { wiki: 'erenshor.wiki.gg' } },
  { id: 'gsc-ak-compendium',       identity: 'WoW_Much', name: 'GSC: AK Compendium',              category: 'analytics',  cadenceHours: 24, fetcher: fetchers.gsc,                    config: { siteUrl: 'https://ancient-kingdoms-compendium.wowmuch1.workers.dev/' } },
  { id: 'gsc-erenshor-maps',       identity: 'WoW_Much', name: 'GSC: Erenshor Maps',              category: 'analytics',  cadenceHours: 24, fetcher: fetchers.gsc,                    config: { siteUrl: 'https://erenshor-maps.wowmuch1.workers.dev/' } },
  { id: 'bing-glockyco-com',        identity: 'glockyco', name: 'Bing: glockyco.com',              category: 'analytics',  cadenceHours: 24, fetcher: fetchers.bingWebmaster,         config: { siteUrl: 'https://glockyco.com/' } },
  { id: 'bing-ak-compendium',       identity: 'WoW_Much', name: 'Bing: AK Compendium',             category: 'analytics',  cadenceHours: 24, fetcher: fetchers.bingWebmaster,         config: { siteUrl: 'https://ancient-kingdoms-compendium.wowmuch1.workers.dev/' } },
  { id: 'bing-erenshor-maps',       identity: 'WoW_Much', name: 'Bing: Erenshor Maps',             category: 'analytics',  cadenceHours: 24, fetcher: fetchers.bingWebmaster,         config: { siteUrl: 'https://erenshor-maps.wowmuch1.workers.dev/' } },
  { id: 'cf-analytics-glockyco-com',   identity: 'glockyco', name: 'CF Analytics: glockyco.com',      category: 'analytics',  cadenceHours: 1,  fetcher: fetchers.cfAnalytics,           config: { /* site_tag from CF_ANALYTICS_SITE_TAGS */ } },
  { id: 'cf-analytics-ak-compendium',  identity: 'WoW_Much', name: 'CF Analytics: AK Compendium',     category: 'analytics',  cadenceHours: 1,  fetcher: fetchers.cfAnalytics,           config: { /* site_tag from CF_ANALYTICS_SITE_TAGS */ } },
  { id: 'cf-analytics-erenshor-maps',  identity: 'WoW_Much', name: 'CF Analytics: Erenshor Maps',     category: 'analytics',  cadenceHours: 1,  fetcher: fetchers.cfAnalytics,           config: { /* site_tag from CF_ANALYTICS_SITE_TAGS */ } },
  // ga4 — added once property ID is known (see §7.2).
]);
```

### 2.4 Posts — markdown files in repo, metadata mirrored to D1

```
posts/
  2026-04-12-wow-much-040-release.md
  2026-04-15-erenshor-tips-thread.md
  ...
```

Each file:

```markdown
---
posted_at: 2026-04-12T18:30:00Z
author: WoW_Much
platform: thunderstore
url: https://thunderstore.io/c/erenshor/p/WoW_Much/WoW_Much/
title: "WoW Much 0.4.0 release notes"
tags: [release, erenshor, wow-much]
related_sources: [thunderstore-wowmuch]
---

Body in markdown.
```

**Loader (runtime, body access):**

```typescript
// src/lib/posts/loader.ts
import matter from 'gray-matter';
import { z } from 'zod';
import { Identity } from '$lib/identities';
import { sources } from '$lib/sources/registry';

const PostFrontmatter = z.object({
  posted_at:       z.string().datetime(),
  author:          Identity,
  platform:        z.string(),
  url:             z.string().url(),
  title:           z.string(),
  tags:            z.array(z.string()).default([]),
  related_sources: z.array(z.string()).default([]),
});

const raw = import.meta.glob('/posts/*.md', { eager: true, query: '?raw', import: 'default' });
const knownSourceIds = new Set(sources.map(s => s.id));

export const posts = Object.entries(raw).map(([path, src]) => {
  const { data, content } = matter(src as string);
  const fm = PostFrontmatter.parse(data);
  for (const sid of fm.related_sources) {
    if (!knownSourceIds.has(sid)) {
      throw new Error(`Post ${path}: related_sources contains unknown source '${sid}'`);
    }
  }
  return {
    slug: path.replace(/^\/posts\//, '').replace(/\.md$/, ''),
    posted_at_ms: new Date(fm.posted_at).getTime(),
    body: content,
    ...fm,
  };
}).sort((a, b) => b.posted_at_ms - a.posted_at_ms);
```

**Sync to D1 (deploy time, not runtime):**

`pnpm deploy` runs:

```bash
pnpm exec wrangler deploy && \
node --experimental-strip-types scripts/sync-posts.ts
```

`scripts/sync-posts.ts` shares the same frontmatter schema and runtime-safe parsing/normalization logic as the runtime loader, but uses Node filesystem reads instead of the runtime `import.meta.glob` loader. The runtime normalizer does not import Node built-ins; the Node-only sync script adds `body_hash` as SHA-256 of the normalized body before generating SQL. It generates a single transaction (`BEGIN; DELETE FROM posts_sources; DELETE FROM posts_index; INSERT ...; COMMIT;`) and runs it via `pnpm exec wrangler d1 execute --remote --file=<generated.sql>`.

Why deploy-time, not runtime: the deploy is when "publish" happens. Sync at deploy = code, files, and DB always reflect the same git SHA. No drift, no per-isolate sync race, no "first request after deploy is slow" problem.

### 2.5 Validation strategy

| Boundary                                              | Schema                            | Failure mode                              |
| ----------------------------------------------------- | --------------------------------- | ----------------------------------------- |
| Source registry array → at module init                | `z.array(SourceDef).parse([...])` | Worker fails to start, deploy aborts      |
| Post frontmatter → at loader init                     | `PostFrontmatter`                 | Worker fails to start, deploy aborts      |
| Post `related_sources` → at loader init               | cross-check vs `sources` IDs      | Worker fails to start, deploy aborts      |
| Connector HTTP response → before write                | per-source response schema        | Permanent failure → Discord alert         |
| User input (date ranges, source filters) → API routes | per-route Zod schema              | 400 to client                             |
| D1 reads                                              | TypeScript types only, no runtime | Trust the DB; we wrote it                 |

**Connector contract:**

```typescript
export type FetcherInput  = { source: SourceDef; env: Env; now: number };
export type FetcherOutput = { metric_points: MetricPoint[]; events: Event[] };
export type Fetcher       = (input: FetcherInput) => Promise<FetcherOutput>;
```

Connectors are pure: HTTP → Zod-parsed → typed rows. **They don't touch D1.** The consumer Worker is responsible for all persistence. Easy to test (give a mock HTTP response, assert on returned rows).

### 2.6 Read patterns this model serves

| View                                       | Query shape                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard tile (one source, last 30 days)  | `WHERE source_id=? AND metric=? AND ts > ? ORDER BY ts`                                                                              |
| GSC top-10 queries last 7 days             | `WHERE source_id='gsc-...' AND ts > ? GROUP BY json_extract(dimensions, '$.query') ORDER BY SUM(value) DESC LIMIT 10`                |
| Timeline view (correlation)                | Two parallel queries: `metric_points` range + `events` range; posts joined via `posts_sources`; merged client-side                   |
| GitHub contribution heatmap                | `WHERE source_id='github-glockyco' AND metric='contributions' ORDER BY ts` (365 daily rows × N years)                                |
| Health (last 24h failures)                 | `WHERE ts > ? ORDER BY ts DESC` from `fetcher_failures`                                                                              |
| All Steam reviews across both games        | `WHERE kind='review' ORDER BY ts DESC LIMIT 50`                                                                                      |
| "Posts I made + post-window subscriber Δ"  | `JOIN posts_index/posts_sources` + correlated subqueries against `metric_points` (single SQL, indexed)                               |

---

## 3. Orchestration

### 3.1 Worker entrypoints

```
SvelteKit fetch handler   — HTTP requests (dashboard pages, /api/*, manual refresh) — Access-protected
scheduled handler         — Cron Triggers ('0 * * * *' dispatches; '0 4,5 * * *' digest)
queue handler             — fetcher-queue + fetcher-dlq consumers
```

All HTTP routes uniformly behind Access. No public exemptions.

### 3.2 Hourly dispatcher

```typescript
async function scheduled(event: ScheduledEvent, env: Env) {
  if (event.cron === '0 * * * *') {
    await env.FETCHER_QUEUE.sendBatch(
      sources.map(s => ({ body: { source_id: s.id, dispatch_ts: Date.now(), force: false } as JobMsg }))
    );
  } else if (event.cron === '0 4,5 * * *') {
    await maybeDailyDigest(env);
  }
}
```

Sends N messages once per hour. The consumer decides per-source whether the work is actually due. Adding a new hourly-or-daily source is a registry change, not a cron change.

### 3.3 Queue consumer

```typescript
async function queue(batch: MessageBatch<JobMsg>, env: Env) {
  const msg = batch.messages[0];                        // batch_size = 1
  const { source_id, force } = msg.body;
  const source = sources.find(s => s.id === source_id);
  if (!source) { msg.ack(); return; }                   // unknown id — drop silently

  // Cadence gate — force=true bypasses (manual refresh)
  if (!force) {
    const run = await env.DB.prepare(
      'SELECT last_run_at FROM fetcher_runs WHERE source_id = ?'
    ).bind(source_id).first<{ last_run_at: number }>();
    const cadenceMs = source.cadenceHours * 3_600_000;
    if (run && Date.now() - run.last_run_at < cadenceMs - 300_000) {  // 5-min jitter window
      msg.ack();
      return;
    }
  }

  try {
    const result = await source.fetcher({ source, env, now: Date.now() });

    await env.DB.batch([
      ...result.metric_points.map(mp =>
        env.DB.prepare('INSERT OR IGNORE INTO metric_points VALUES (?, ?, ?, ?, ?)')
          .bind(mp.source_id, mp.metric, mp.ts, mp.value, mp.dimensions ? JSON.stringify(mp.dimensions) : null)
      ),
      ...result.events.map(ev =>
        env.DB.prepare('INSERT OR IGNORE INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(ev.source_id, ev.external_id, ev.ts, ev.kind, ev.author, ev.title, ev.body, ev.url,
                ev.metadata ? JSON.stringify(ev.metadata) : null)
      ),
      env.DB.prepare(`
        INSERT INTO fetcher_runs (source_id, last_run_at, last_success_at, last_status, consecutive_failures)
        VALUES (?, ?, ?, 'success', 0)
        ON CONFLICT(source_id) DO UPDATE SET
          last_run_at         = excluded.last_run_at,
          last_success_at     = excluded.last_success_at,
          last_status         = 'success',
          last_error          = NULL,
          consecutive_failures = 0
      `).bind(source_id, Date.now(), Date.now()),
    ]);

    msg.ack();
  } catch (err) {
    await handleFetchError(source, err, env, msg);
  }
}
```

Connectors are pure (don't touch D1). Consumer is responsible for all persistence. All writes go in one D1 `batch()` — atomic — so consumer crashes never leave half-written state.

### 3.4 Error classification & retry policy

```typescript
type Failure = { tier: 'transient' | 'rate_limited' | 'permanent'; statusCode?: number; retryAfterSeconds?: number };

function classify(err: unknown): Failure {
  if (err instanceof z.ZodError)                    return { tier: 'permanent' };               // API drift
  if (err instanceof FetchError) {
    const s = err.status;
    if (s === 429)                                   return { tier: 'rate_limited', statusCode: s, retryAfterSeconds: parseRetryAfter(err.headers) ?? 600 };
    if (s === 401 || s === 403 || s === 404)         return { tier: 'permanent', statusCode: s };
    if (s >= 500)                                    return { tier: 'transient', statusCode: s };
  }
  return { tier: 'transient' };                      // network errors, timeouts, anything else
}
```

| Failure                                      | Action                                                  | Max attempts |
| -------------------------------------------- | ------------------------------------------------------- | ------------ |
| `permanent` (401/403/404/Zod)                | Alert immediately, ack, do not retry                    | 1            |
| `rate_limited` (429)                         | Retry after `Retry-After` header (or 10 min default)    | 5            |
| `transient` (5xx, network)                   | Retry after fixed 5 min                                 | 5            |
| Exhausted retries                            | Routed to DLQ; alert from DLQ consumer                  | n/a          |

Fixed 5-min delay (not exponential) is the deliberate simplification — Queues doesn't pass retry count through, so true exponential would require a D1 round-trip per consumer. At our volume, 5 retries × 5 min = 25-min recovery window covers any legitimately transient issue. Upgrade to D1-tracked retries if a flaky source warrants it.

### 3.5 Dead-letter handling

```typescript
async function dlq(batch: MessageBatch<JobMsg>, env: Env) {
  for (const msg of batch.messages) {
    const { source_id } = msg.body;
    await env.DB.prepare(
      'INSERT INTO fetcher_failures (source_id, ts, tier, error_message) VALUES (?, ?, ?, ?)'
    ).bind(source_id, Date.now(), 'dlq', 'Exhausted retries').run();
    await maybeSendAlert(env, source_id, 'dlq', 'exhausted_retries', 'Failed after 5 retries');
    msg.ack();
  }
}
```

### 3.6 Alert deduplication

```typescript
async function maybeSendAlert(env: Env, source_id: string, tier: 'permanent' | 'dlq', errorClass: string, message: string) {
  const alertKey = `${tier}:${source_id}:${errorClass}`;
  const existing = await env.DB.prepare(
    'SELECT sent_at FROM alerts_sent WHERE alert_key = ?'
  ).bind(alertKey).first<{ sent_at: number }>();
  if (existing && Date.now() - existing.sent_at < 24 * 3_600_000) return;  // re-fire after 24h
  await postDiscord(env.DISCORD_ALERTS_WEBHOOK, formatAlert(source_id, tier, errorClass, message));
  await env.DB.prepare('INSERT OR REPLACE INTO alerts_sent VALUES (?, ?)')
    .bind(alertKey, Date.now()).run();
}
```

Without dedup, a permanent 401 on a daily-cadence source would post 24 alerts/day (one per hourly enqueue → permanent → alert). With dedup keyed by (tier, source, error_class), one alert per 24h, with the granularity to distinguish e.g. `auth_dead` from `quota_exhausted` on the same source.

### 3.7 Manual refresh

```typescript
// src/routes/api/refresh/[source_id]/+server.ts (Access-protected)
export async function POST({ params, request, platform }) {
  await assertAccessJwt(request, platform.env);
  const source = sources.find(s => s.id === params.source_id);
  if (!source) return new Response('unknown source', { status: 404 });
  await platform.env.FETCHER_QUEUE.send({
    source_id: source.id, dispatch_ts: Date.now(), force: true
  });
  return json({ queued: true });
}
```

Forces a fetch by bypassing the cadence gate. Goes through the same queue/consumer path — error handling, retry, dedup all uniform.

Frontend:

```typescript
await fetch(`/api/refresh/${sourceId}`, {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});
```

### 3.8 Daily digest (Vienna-DST aware)

```typescript
async function maybeDailyDigest(env: Env) {
  const viennaHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Vienna', hour: 'numeric', hour12: false }).format(new Date())
  );
  if (viennaHour !== 6) return;                    // wrong cron half (DST other side)

  const digestDate = viennaDateKey(new Date());    // Europe/Vienna YYYY-MM-DD
  const existing = await env.DB.prepare(
    'SELECT sent_at FROM digest_sent WHERE digest_date = ?'
  ).bind(digestDate).first<{ sent_at: number }>();
  if (existing) return;                            // replay/retry-safe external side effect

  const since = Date.now() - 24 * 3_600_000;
  const [scalarDeltas, eventCount, posts, failureCount] = await Promise.all([
    computeScalarDeltas(env, since),
    env.DB.prepare('SELECT source_id, kind, count(*) AS n FROM events WHERE ts > ? GROUP BY source_id, kind').bind(since).all(),
    env.DB.prepare('SELECT slug, title, author, posted_at, url FROM posts_index WHERE posted_at > ? ORDER BY posted_at DESC').bind(since).all(),
    env.DB.prepare('SELECT source_id, tier, count(*) AS n FROM fetcher_failures WHERE ts > ? GROUP BY source_id, tier').bind(since).all(),
  ]);

  const message = formatDigest({ scalarDeltas, eventCount, posts, failureCount });
  await postDiscord(env.DISCORD_DIGEST_WEBHOOK, message);
  await env.DB.prepare('INSERT INTO digest_sent (digest_date, sent_at) VALUES (?, ?)')
    .bind(digestDate, Date.now()).run();
}
```

Cron `0 4,5 * * *` UTC fires twice; the Vienna-local-hour guard makes exactly one half eligible, and `digest_sent` makes the Discord post replay-safe. Single Discord webhook (`DISCORD_DIGEST_WEBHOOK`) — body segmented by identity:

```
🌅 Daily digest — 2026-05-04

━━ glockyco ━━
📈 GitHub @glockyco           ★ 47 (+1) · followers 23 (=) · contributions today: 4
🔍 GSC: glockyco.com           clicks 12 (-2) · impressions 384 (+15) · pos 18.4 (=)

━━ WoW_Much ━━
📈 Thunderstore: WoW_Much      downloads 14 502 (+87) · 4 mods
📈 Steam Guide: AK Compendium  rating 4.0★ (29 ratings, =) · views 1 421 (+3)
📈 Steam Guide: Erenshor Maps  rating 4.0★ (41 ratings, =) · views 2 087 (+8)
🔍 GSC: AK Compendium          clicks 41 (+5) · impressions 1 203 (+102)
🔍 GSC: Erenshor Maps          clicks 28 (-1) · impressions 922 (+34)
☁️  CF: erenshor-maps          visits 312 · pageviews 891
💬 Steam reviews (24h):        2 new on Erenshor (1 ⊕ 1 ⊖) · "...quote..."
📝 Wiki edits:                 5 changes on Erenshor wiki

━━ Posts (24h) ━━
None.

━━ Health ━━
✅ All sources fetching cleanly.
```

When something breaks:

```
━━ Health ━━
🔥 gsc-glockyco-com            permanent failure (auth_dead, 401) — alert sent 09:14
⚠️  bing-ak-compendium          3 transient failures (recovered)
```

### 3.9 Idempotency summary

Every write path is replay-safe:

| Path                                       | Idempotency mechanism                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Connector hourly fetch (cron-driven)       | `INSERT OR IGNORE` on PKs `(source_id, metric, ts, dimensions)` and `(source_id, external_id)`                |
| Manual refresh                             | Same write path; `force=true` only bypasses cadence gate                                                      |
| Queue retry                                | Same as above — re-fetch produces same rows; ignored on conflict                                              |
| Cron firing twice during DST transition    | Digest guard checks Vienna local hour; `digest_sent` prevents duplicate Discord posts; metrics dispatcher idempotent at write level |
| Worker restart mid-batch                   | `db.batch()` is atomic; nothing half-written                                                                  |

You can replay any fetch cron and any queue message without polluting state. Digest cron is replay-safe via `digest_sent` because it has an external Discord side effect.

---

## 4. Connector architecture

### 4.1 Shared HTTP utility

```typescript
// src/lib/connectors/http.ts
import { z } from 'zod';

export class FetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly headers: Headers,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(`HTTP ${status} from ${url}: ${body.slice(0, 200)}`);
    this.name = 'FetchError';
  }
}

export interface FetchOptions extends RequestInit {
  timeout?: number;            // ms, default 15_000
  schema?: z.ZodTypeAny;       // optional Zod parser for response body
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeout = 15_000, schema, ...init } = options;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new FetchError(res.status, res.headers, text, url);
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      throw new FetchError(200, res.headers, `Invalid JSON: ${text.slice(0, 200)}`, url);
    }
    return (schema ? schema.parse(data) : data) as T;
  } finally {
    clearTimeout(tid);
  }
}
```

Single I/O boundary every connector uses:

- **Timeout via `AbortController`**, default 15s, well under both Worker request budget and Queue consumer wall-clock budget.
- **`FetchError` is the only HTTP error type connectors raise.** The consumer's `classify()` (§3.4) reads `.status` and `.headers` (for `Retry-After`).
- **Schema parse is integrated**, so connectors don't repeat the validate-then-use pattern. `ZodError` propagates and is classified as permanent.
- **JSON parse errors wrapped as `FetchError(200, ...)`** so they classify as transient (often a content-type mismatch from a mid-flight upstream change).

### 4.2 Auth helpers per platform family

```typescript
// src/lib/connectors/auth/github.ts
export const githubHeaders = (env: Env) => ({
  'Authorization': `Bearer ${env.GITHUB_PAT}`,
  'Content-Type':  'application/json',
  'User-Agent':    'creator-dashboard/1.0',
});

// src/lib/connectors/auth/steam.ts — API key as query param
export const withSteamKey = (url: URL, env: Env) => {
  url.searchParams.set('key', env.STEAM_WEB_API_KEY);
  return url;
};

// src/lib/connectors/auth/cloudflare.ts
export const cfHeaders = (env: Env) => ({
  'Authorization': `Bearer ${env.CF_API_TOKEN}`,
  'Content-Type':  'application/json',
});

// src/lib/connectors/auth/google.ts — two cached access-token paths
// (a) Service-account JWT-bearer flow, retained for GA4 (and any future SA-grantable API).
// (b) OAuth refresh-token flow, used by GSC because Google's "Add user" / Site Verification
//     -> Search Console permission propagation is broken (acknowledged April 23, 2026; no
//     fix timeline as of May 1, 2026). Refresh token is bound to jaichberger@gmail.com,
//     who is already verified owner of all three GSC properties.
let cachedSa: { token: string; expiresAt: number } | null = null;
let cachedOAuth: { token: string; expiresAt: number } | null = null;

export async function getGoogleAccessToken(
  env: Pick<Env, 'GOOGLE_SERVICE_ACCOUNT'>,
  scopes: string[]
): Promise<string> {
  if (cachedSa && Date.now() < cachedSa.expiresAt - 60_000) return cachedSa.token;
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT) as { client_email: string; private_key: string };
  const jwt = await signSaJwt(sa, scopes);
  const res = await fetchJson<TokenResponse>(
    'https://oauth2.googleapis.com/token',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` }
  );
  cachedSa = { token: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 };
  return cachedSa.token;
}

export async function getGoogleOAuthAccessToken(
  env: Pick<Env, 'GOOGLE_OAUTH_CLIENT_ID' | 'GOOGLE_OAUTH_CLIENT_SECRET' | 'GOOGLE_OAUTH_REFRESH_TOKEN'>
): Promise<string> {
  if (cachedOAuth && Date.now() < cachedOAuth.expiresAt - 60_000) return cachedOAuth.token;
  const body = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });
  const res = await fetchJson<TokenResponse>(
    'https://oauth2.googleapis.com/token',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  );
  cachedOAuth = { token: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 };
  return cachedOAuth.token;
}
```

Module-scope token cache works because Cloudflare reuses isolates across requests. Cache miss = one extra HTTP call to `oauth2.googleapis.com` once per ~hour per isolate.

`signSaJwt()` uses `jose` (already required for Access JWT verification — no extra install).

### 4.3 Per-connector module pattern

```
src/lib/connectors/
  http.ts                           shared
  errors.ts                         shared
  types.ts                          Fetcher / FetcherInput / FetcherOutput
  index.ts                          re-exports

  auth/
    github.ts
    steam.ts
    cloudflare.ts
    bing.ts
    google.ts                       SA JWT (GA4) + OAuth refresh-token (GSC)

  fetchers/
    github.ts
    github.test.ts
    github.fixture.json
    steam-guide.ts
    steam-guide.test.ts
    steam-guide.fixture.json
    steam-reviews.ts
    thunderstore-team.ts
    mediawiki-recent-changes.ts
    gsc.ts
    bing-webmaster.ts
    ga4.ts
    cf-analytics.ts
```

One file per connector. `<name>.ts` exports the `Fetcher` function. `<name>.test.ts` is the test. `<name>.fixture.json` is the recorded happy-path response.

### 4.4 Concrete example — GitHub connector

```typescript
// src/lib/connectors/fetchers/github.ts
import { z } from 'zod';
import { fetchJson } from '../http';
import { githubHeaders } from '../auth/github';
import type { FetcherInput, FetcherOutput } from '../types';

const Response = z.object({
  data: z.object({
    viewer: z.object({
      login: z.string(),
      followers: z.object({ totalCount: z.number().int() }),
      contributionsCollection: z.object({
        contributionCalendar: z.object({
          totalContributions: z.number().int(),
          weeks: z.array(z.object({
            contributionDays: z.array(z.object({
              date: z.string(),
              contributionCount: z.number().int(),
            })),
          })),
        }),
      }),
      repositories: z.object({
        totalCount: z.number().int(),
        nodes: z.array(z.object({
          name: z.string(),
          stargazerCount: z.number().int(),
          isArchived: z.boolean(),
          url: z.string().url(),
        })),
      }),
    }),
  }),
});

const QUERY = /* GraphQL */ `
  query {
    viewer {
      login
      followers { totalCount }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
      repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes { name stargazerCount isArchived url }
      }
    }
  }
`;

export async function fetchGithub({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const data = await fetchJson<z.infer<typeof Response>>('https://api.github.com/graphql', {
    method:  'POST',
    headers: githubHeaders(env),
    body:    JSON.stringify({ query: QUERY }),
    schema:  Response,
  });

  const v = data.data.viewer;
  const totalStars = v.repositories.nodes.filter(r => !r.isArchived).reduce((s, r) => s + r.stargazerCount, 0);

  // Daily contribution counts for the past year — re-emitted every fetch, INSERT OR IGNORE handles dedup.
  const contributionPoints = v.contributionsCollection.contributionCalendar.weeks
    .flatMap(w => w.contributionDays)
    .map(d => ({
      source_id:  source.id,
      metric:     'contributions',
      ts:         new Date(`${d.date}T00:00:00Z`).getTime(),
      value:      d.contributionCount,
      dimensions: null,
    }));

  // Per-repo star counts — dimensioned, top 100.
  const repoStarPoints = v.repositories.nodes.map(r => ({
    source_id:  source.id,
    metric:     'repo_stars',
    ts:         now,
    value:      r.stargazerCount,
    dimensions: { repo: r.name, archived: r.isArchived ? 'true' : 'false' },
  }));

  return {
    metric_points: [
      { source_id: source.id, metric: 'followers',    ts: now, value: v.followers.totalCount,     dimensions: null },
      { source_id: source.id, metric: 'total_stars',  ts: now, value: totalStars,                 dimensions: null },
      { source_id: source.id, metric: 'public_repos', ts: now, value: v.repositories.totalCount,  dimensions: null },
      ...contributionPoints,
      ...repoStarPoints,
    ],
    events: [],   // PushEvent / ReleaseEvent / IssueEvent added later as a separate fetcher if wanted
  };
}
```

Patterns to internalize:

- **Connector is pure.** No D1, no `console.log`, no environment magic. Input → output.
- **Re-emit historical data freely.** `INSERT OR IGNORE` makes every fetch idempotent. Tracking "what we've already seen" client-side is wasted complexity.
- **Dimensioned data shares the metric_points table.** `repo_stars` with `dimensions: {repo: 'X'}` is one row per repo per timestamp. Top-N by repo is a `GROUP BY json_extract(dimensions, '$.repo')` query.
- **`source.id` is parameterized**, not hardcoded. If we ever add a second GitHub identity, the same fetcher serves both with different config.

### 4.5 Testing strategy — fixture-based vitest

Three tests per connector minimum: happy path, schema drift, auth error.

```typescript
// src/lib/connectors/fetchers/github.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { fetchGithub } from './github';
import { FetchError } from '../http';
import fixture from './github.fixture.json';

const source = { id: 'github-glockyco', name: 'GitHub @glockyco', identity: 'glockyco', category: 'platform', cadenceHours: 1, fetcher: fetchGithub, config: {} } as const;
const env = { GITHUB_PAT: 'ghp_test' } as const;
const now = 1714838400_000;

beforeEach(() => { vi.unstubAllGlobals(); });

describe('fetchGithub', () => {
  it('emits scalar + dimensioned + 365 contribution points (happy path)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } })
    ));
    const out = await fetchGithub({ source, env, now });

    expect(out.metric_points.find(p => p.metric === 'followers')?.value).toBeTypeOf('number');
    expect(out.metric_points.filter(p => p.metric === 'contributions').length).toBeGreaterThanOrEqual(365);
    expect(out.metric_points.filter(p => p.metric === 'repo_stars').length).toBeGreaterThan(0);
    expect(out.events).toHaveLength(0);
  });

  it('throws ZodError on schema drift', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { viewer: null } }), { status: 200 })
    ));
    await expect(fetchGithub({ source, env, now })).rejects.toBeInstanceOf(z.ZodError);
  });

  it('propagates HTTP 401 as FetchError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Bad credentials', { status: 401 })
    ));
    await expect(fetchGithub({ source, env, now })).rejects.toMatchObject({ status: 401 });
  });
});
```

Fixtures are checked-in real-shaped responses generated by a one-off capture script:

```bash
node --experimental-strip-types scripts/capture-fixture.ts github > src/lib/connectors/fetchers/github.fixture.json
```

The capture script post-processes the fixture to redact emails / Steam IDs. Manual review before committing.

**Why hand-curated fixtures over full record-and-replay (nock-style):** the goal of these tests isn't reproducing every API call exhaustively; it's three things — schema parses, business logic produces expected rows, errors propagate. One fixture per connector + 2-3 synthesized error cases suffices.

### 4.6 Backfill — one-off local scripts, not in-Worker

Point-in-time sources (GitHub stars, Steam ratings, Thunderstore downloads, MediaWiki recent changes window) **have no backfill possible** — history starts the day we deploy.

Analytics sources **do** have server-side history:

| Source         | Retention                     |
| -------------- | ----------------------------- |
| GSC            | 16 months                     |
| GA4            | 14 months                     |
| Bing Webmaster | varies (typically 6 months)   |
| CF Analytics   | 6 months free / 12 months paid |

```
scripts/
  backfill-gsc.ts         # last 16mo of GSC clicks/impressions/queries/pages, all configured properties
  backfill-ga4.ts         # last 14mo
  backfill-bing.ts        # whatever Bing returns
  backfill-cf.ts          # last 6mo
```

Each script:

1. Reads the source registry (filters to its category).
2. Runs the same fetcher modules from `src/lib/connectors/fetchers/`, via exported date-range helpers that share the scheduled connector response schemas and row-to-metric mapping instead of duplicating parsing in scripts.
3. Pages through historical windows (GSC max 25k rows per query, paginate via `startRow`).
4. Writes to D1 via `pnpm exec wrangler d1 execute --remote --file=<generated.sql>` in batches of ~500 rows per transaction.

**Why local scripts vs in-Worker:**

- **No 15-min wall-clock ceiling.** A full GSC backfill across 3 properties × 16 months could run for tens of minutes.
- **Easy to retry on failure.** Idempotent inserts mean previous progress is preserved.
- **Same connector code.** The fetcher modules expose scheduled fetchers plus date-range helpers for backfill. Backfill loops over historical windows while preserving the same response schemas and metric mapping. No duplicated parsing logic.

### 4.7 Concurrency & rate limits

Cloudflare Workers limit each invocation to **6 simultaneous connections** waiting on response headers. A connector that does `Promise.all([fetch1, ..., fetch10])` will fail past the 6th.

**Rule:** connectors use sequential `await` loops, not `Promise.all`. At hourly cadence, a connector taking 2-3s instead of 0.5s doesn't matter. Documented in `connectors/README.md`, enforced by code review.

Per-source rate limits are well above our usage:

| Source                 | Limit                              | Usage                       |
| ---------------------- | ---------------------------------- | --------------------------- |
| GitHub GraphQL         | 5000 points/h authed               | ~24/day                     |
| Steam Web API          | 100k/day                           | ~96/day                     |
| GSC                    | 1200 QPM/site                      | ~24/day per property        |
| GA4                    | 1250 tokens/h/property             | ~240 tokens/day             |
| CF GraphQL Analytics   | 300 queries / 5 min                | ~24/h total                 |
| Bing                   | undocumented                       | conservative                |
| Thunderstore, MediaWiki| undocumented                       | conservative                |

Conservative defaults already in §3.4: 429 → respect `Retry-After`, default 10 min, max 5 retries.

---

## 5. UI surface

### 5.1 Information architecture

```
┌─ Header: identity tabs [All | glockyco | WoW_Much] · global date range · "Refresh all" button ─┐
├─ Sidebar ────────────┬─ Main content ─────────────────────────────────────────────────────────┤
│  📊 Dashboard        │                                                                          │
│  📈 Timeline         │   (per-page content)                                                     │
│  📝 Posts            │                                                                          │
│  💚 Health           │                                                                          │
│  ⚙  Settings         │                                                                          │
└──────────────────────┴──────────────────────────────────────────────────────────────────────────┘
```

| Route                  | Purpose                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `/`                    | Dashboard — grid of tiles, one per source. Filtered by selected identity tab.                 |
| `/timeline`            | Correlation view — stacked time-series with event + post markers. The headline feature.       |
| `/sources/[id]`        | Per-source drill-down — full-size charts, paginated events feed, full history.                |
| `/posts`               | Writings list — sortable, filterable by author / tag / related source.                        |
| `/posts/[slug]`        | Single post — body + per-related-source performance panel.                                    |
| `/health`              | Operational view — last-fetched ages, recent failures, manual refresh, DLQ snapshot.          |
| `/settings`            | Theme toggle, default date range, identity color overrides — persisted to localStorage.       |

### 5.2 Identity tabs as global state

Identity selection is a URL query param (`?identity=glockyco`) for shareability and back-button correctness, with a localStorage default.

```
?identity=all         → show all sources, posts, etc. (default)
?identity=glockyco    → only sources where identity='glockyco', posts where author='glockyco'
?identity=WoW_Much    → only sources where identity='WoW_Much', posts where author='WoW_Much'
```

Server-side `load()` functions read this and add the appropriate `WHERE` clauses.

### 5.3 Tile shape — three variants by category

Common skeleton:

```
┌─────────────────────────────────────────────────────────┐
│ ┃ {name}                      {identity-pill}  {⟳}     │  header — identity-color border-left
│                                                         │
│ {category-specific body}                                │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ Last fetched {relative time}              {Open ↗}      │  footer
└─────────────────────────────────────────────────────────┘
```

- **Identity pill** is a small color-coded badge.
- **Border-left** in identity color provides visual grouping when scanning a wall of tiles.
- **`⟳`** is the manual refresh button.
- **`Open ↗`** opens `/sources/[id]` for the drill-down.
- **Tile is clickable as a whole** for drill-down; the `⟳` button stops propagation.

Three category-specific bodies:

**Platform tile** (Steam Guide / Thunderstore / GitHub): primary numbers + sparkline + awards/recent-versions row.

**Analytics tile** (GSC / Bing / CF / GA4): clicks/impressions/CTR/position + sparkline + top-N queries list.

**Event feed tile** (Steam Reviews / Wiki Recent Changes): total + delta + 3 most-recent items with author and timestamp.

Tile component is a single Svelte component parameterized by category. `TileSnapshot` is pre-computed in the dashboard's `load()` with one batched D1 query per tile (latest values, deltas, sparkline data, latest events). At ~12 sources, the dashboard loads in one D1 round-trip group of ~24 queries.

### 5.4 Timeline / correlation view (headline feature)

URL drives all state:

```
/timeline?since=2026-04-01&until=2026-05-04&sources=thunderstore-wowmuch,steam-reviews-erenshor&overlay=posts,events
```

Layout: filter bar + stacked charts (one per source × key metric) + combined chronological event/post log below.

Each chart, in pseudocode:

```typescript
Plot.plot({
  marks: [
    Plot.lineY(metric_points, { x: 'ts', y: 'value', stroke: 'var(--color-accent)' }),
    Plot.areaY(metric_points,  { x: 'ts', y: 'value', fillOpacity: 0.1 }),
    Plot.ruleX(events,         { x: 'ts',         stroke: 'var(--color-event)', strokeWidth: 1.5 }),
    Plot.ruleX(posts,          { x: 'posted_at_ms', stroke: 'var(--color-post)', strokeWidth: 2, strokeDasharray: '3,3' }),
    Plot.tip([...events, ...posts], Plot.pointerX({
      x: d => d.ts ?? d.posted_at_ms,
      title: d => d.title || d.body?.slice(0, 80),
    })),
  ],
})
```

Plot charts render client-side into component-owned containers. **Cross-chart sync** for date-window navigation: a small Svelte store holds the current x-domain; each chart re-renders. Skip pinch-zoom — Plot's mobile story is "use UI controls, not gestures."

### 5.5 Per-source drill-down `/sources/[id]`

Source header → key metrics chart (large, with overlays) → secondary metrics grid → events feed (paginated, kind-filterable) → linked posts (those referencing this source via `related_sources`).

GitHub source gets a special component for the **contribution heatmap** (`Plot.cell` faceted by year, click a cell to drill into that day's activity).

### 5.6 Posts pages

**`/posts`** — list view: filterable table (author, tag, related source) sorted by date desc.

**`/posts/[slug]`** — detail view: header (title, author, posted_at, platform link, tags, related sources) + rendered markdown body + **performance panel** computed via the SQL from §2.4 (before/after metric values around the post window, per related source).

### 5.7 Health page

Per-source status table (id, name, last_run_at, last_status, last_error, consecutive_failures, refresh button) + recent-failures table from `fetcher_failures` + alerts log from `alerts_sent`.

### 5.8 Manual refresh UX

Optimistic + informative:

1. Click `⟳` → `POST /api/refresh/[source_id]`.
2. Tile shows spinner state.
3. Poll `fetcher_runs.last_run_at` (every 2s for 30s) — when it changes, refresh tile data.
4. If 30s elapses without change, show "still running, see Health".

States visible on the tile: idle → refreshing → success (green flash, fade) / error (red flash, error tooltip) / pending.

### 5.9 Mobile responsiveness

- Sidebar collapses to hamburger at <768px.
- Tile grid: 3-col → 2-col → 1-col at ≥1280px / ≥768px / <768px.
- Charts: full-width single column on mobile; horizontal scroll inside the chart for long ranges.
- Touch targets ≥44px.
- Posts list: card layout on mobile instead of table.

Tailwind `sm: md: lg:` breakpoints.

### 5.10 Theme

Dark by default. Light mode toggle in Settings. Tailwind 4 `@theme` block:

```css
/* src/app.css */
@import 'tailwindcss';

@theme {
  --color-bg-primary:    light-dark(#fafafa, #0a0a0a);
  --color-bg-secondary:  light-dark(#f0f0f0, #161616);
  --color-fg-primary:    light-dark(#0a0a0a, #fafafa);
  --color-fg-muted:      light-dark(#525252, #a3a3a3);
  --color-border:        light-dark(#e5e5e5, #262626);

  --color-glockyco:      #6366f1;  /* indigo-500; user can override via Settings */
  --color-wowmuch:       #f59e0b;  /* amber-500; user can override via Settings */

  --color-success:       #22c55e;
  --color-warning:       #f59e0b;
  --color-danger:        #ef4444;
  --color-event:         #8b5cf6;  /* violet for event markers */
  --color-post:          #14b8a6;  /* teal for post markers */
}
```

`light-dark()` is native CSS; toggle = setting `style="color-scheme: dark"` (or `light`) on `<html>` to override the user's system preference. Identity colors are user-overridable via Settings → localStorage.

### 5.11 Deliberately not in v1

- Search across content
- CSV/JSON export (D1 directly queryable via Wrangler)
- Annotations on charts beyond posts/events overlays
- Multi-user views, sharing
- iframes / embedded source pages (technically blocked by upstream CSP)
- Real-time updates (page-load + manual refresh sufficient)
- Customizable tile layout (registry order, grouped by category)

---

## 6. Testing & deployment

### 6.1 Test layers

| Layer                     | Tool       | What it covers                                                                              | Run when           |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------- | ------------------ |
| **Connector unit tests**  | vitest     | Per-connector: happy path, schema drift, auth error                                         | Pre-commit + CI    |
| **Schema parsers**        | vitest     | `PostFrontmatter`, `SourceDef`, identity validators reject malformed input                  | Pre-commit + CI    |
| **Posts sync**            | vitest     | `scripts/sync-posts.ts` against fixture `posts/` produces expected SQL transcript           | Pre-commit + CI    |
| **Auth helper**           | vitest     | Access JWT verification accepts valid token, rejects expired/wrong-AUD/wrong-issuer         | Pre-commit + CI    |
| **Worker integration**    | Wrangler   | `pnpm exec wrangler dev --test-scheduled` + scripted HTTP calls: scheduled handler reachable; fixture source can prove cron → queue → D1 row once Phase 2 test wiring exists | Pre-deploy         |
| **Live connector smoke**  | Node/Vite   | `scripts/smoke-connectors.ts` runs real source fetchers sequentially against live upstream APIs, reads `.dev.vars`, prints sanitized counts/samples, skips missing credentials, and never writes D1/enqueues/alerts | Before digest/deploy |
| **End-to-end UI**         | Playwright | Wrangler Worker behind local Access/JWKS harness; local D1 migrations and deterministic seed data let UI specs assert dashboard/timeline/source/posts rendering without auth bypasses | Pre-deploy         |
| **D1 migration replay**   | Wrangler   | Apply migrations to a fresh local DB; assert all tables and indexes exist                   | Pre-deploy         |

**Deliberately not tested:**

- Live API calls (connectors tested against fixtures).
- Visual regression (single user; pixel-perfect snapshots = noise).
- Cross-browser (Chrome + mobile Safari are the only browsers used).

### 6.2 Migrations

D1 first-class migrations via Wrangler:

```
migrations/
  0001_initial_schema.sql              all tables from §2.2 + indexes
  0002_<...>.sql                       future schema changes
```

```bash
pnpm exec wrangler d1 migrations apply creator-dashboard --local
pnpm exec wrangler d1 migrations apply creator-dashboard --remote
```

D1 tracks applied versions in a system table. Migration files are immutable once committed (D1 records hashes; modifying a past migration triggers an error). `pnpm deploy` applies them on remote as part of the deploy step.

### 6.3 Local development

```bash
pnpm exec wrangler dev --test-scheduled     # Worker + local D1 + local Queues + scheduled test route, port 8787
pnpm dev                              # SvelteKit dev server, port 5173, proxies to wrangler
```

Wrangler's local mode mocks D1 (in-memory SQLite) and Queues (in-process). Cron Triggers invoked via `curl http://localhost:8787/__scheduled?cron=0+*+*+*+*`. The full orchestration (cron → queue → consumer → D1 write) is testable without touching production.

Local secrets via `.dev.vars` (gitignored). Multi-line secrets (e.g., Google service account JSON): single line with escaped newlines, or use Wrangler's local secret store.

### 6.4 CI

GitHub Actions on PR + push to `main`:

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm check                 # svelte-check + tsc
      - run: pnpm test                  # vitest
      - run: pnpm build                 # smoke-test
```

**No auto-deploy from CI.** Single-user private tool — manual `pnpm deploy` from the dev machine is appropriate. Auto-deploy would mean encrypted Cloudflare API tokens in GitHub secrets (more surface area) for negligible velocity gain. Re-evaluate if friction grows.

Lefthook for pre-commit (matches sibling projects):

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:    { glob: '*.{ts,svelte,js}',         run: pnpm lint --fix {staged_files} }
    format:  { glob: '*.{ts,svelte,js,css,md}',  run: pnpm prettier --write {staged_files} }
    check:   { run: pnpm check }
commit-msg:
  commands:
    commitlint: { run: pnpm commitlint --edit {1} }
```

### 6.5 Observability

In order of how often they're consulted:

1. **Daily Discord digest** — passive read each morning. Includes Health section.
2. **Discord alert webhook** — push for permanent failures + DLQ.
3. **Dashboard `/health` page** — interactive view; last-fetched ages, recent failures, alerts log.
4. **Workers Logs** — persistent structured logs, 7-day retention on Paid. Filter by `level:error`, source ID, cron expression.
5. **`pnpm exec wrangler tail`** — live tail during local iteration or freshly-deployed debugging.

Structured log shape:

```typescript
// src/lib/log.ts
export function log(env: Env, level: 'info' | 'warn' | 'error', message: string, ctx: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, message, ts: new Date().toISOString(), ...ctx }));
}
```

Every consumer invocation logs `{ source_id, duration_ms, status, error?: string }`. Workers Logs indexes the JSON for efficient slicing.

### 6.6 Deploy pipeline

Initial setup (one-time):

```bash
pnpm install
pnpm exec wrangler d1 create creator-dashboard
# (paste returned database_id into wrangler.toml)
pnpm exec wrangler queues create creator-dashboard-fetchers
pnpm exec wrangler queues create creator-dashboard-fetcher-dlq
# (configure CF Access app in Zero Trust dashboard pointing at dashboard.glockyco.com)
# (set all secrets via `pnpm exec wrangler secret put`)

pnpm migrate:remote
pnpm deploy
pnpm backfill                                 # optional, runs all backfill scripts (defined as a package.json script that invokes each backfill-*.ts in sequence)
```

Steady-state deploy:

```bash
pnpm deploy                                   # = migrate:remote + wrangler deploy + sync-posts
```

If migrations changed: deploy applies them first; if they fail, the Worker isn't shipped. If `sync-posts` fails post-deploy, the Worker is current but `posts_index` is one deploy behind — non-fatal, next deploy fixes it. Every operation is idempotent.

### 6.7 Backup strategy

D1 Time Travel: 30 days point-in-time recovery on Workers Paid. Restores are destructive (in-place); for non-trivial recovery, capture current state first via `pnpm exec wrangler d1 export` before restoring. **Time Travel is sufficient for v1.**

Future enhancement (not part of the v1 phasing): a weekly cron exports D1 to R2 as a redundant offsite backup. Adds a third cron expression (`0 3 * * 0` UTC, Sunday 03:00) and an R2 binding. Trivial to add when D1 grows large or paranoia warrants it; flagged here so the architecture has space for it.

---

## 7. Sequencing & follow-ups

### 7.1 Implementation phasing

Designed for full scope; deployable incrementally. Each phase produces a working deploy.

| Phase | Scope                                                                                           | Deliverable                                                                  |
| ----- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **1** | Foundation: repo, SvelteKit + Tailwind 4 + adapter-cloudflare, wrangler config, Access policy, JWT verifier, D1 migrations applied, hello-world page | Auth-gated empty dashboard reachable at `dashboard.glockyco.com`.            |
| **2** | Orchestration core: cron + queue + DLQ, fetcher_runs/failures tables, alert dedup, manual-refresh endpoint, basic Health page, Discord alert wiring | Orchestration proven with no production fetchers configured; tests use injected fixture fetchers. |
| **3** | Tier 1 connectors (key-backed/public): GitHub, Steam Guide, Steam Reviews, Thunderstore, MediaWiki Recent Changes | Five connector modules / seven source IDs collecting hourly. Dashboard tiles render real data. **History starts ticking.** |
| **4** | Dashboard UI: tile components per category, drill-down `/sources/[id]`, sparklines, identity tabs | Visual scan of all metrics in one place.                                     |
| **5** | Posts subsystem: markdown loader + frontmatter validation, sync-posts script, `/posts` list + `/posts/[slug]` detail with performance panel | Editorial layer functional.                                                  |
| **6** | Tier 2 connectors (auth): GSC, Bing Webmaster, GA4, CF GraphQL Analytics                        | All sources collecting.                                                      |
| **7** | Backfill: per-source scripts that pull historical data from analytics sources                   | Charts have real depth from day one.                                         |
| **8** | Polish: timeline correlation view (headline feature), daily digest formatting + Vienna-DST guard, settings page, mobile refinement | Headline feature lit up.                                                     |

**Why this phasing:**

- Phase 3 deploys before Phase 6 because Tier 1 connectors are public-API and provide value immediately. Their history is point-in-time-only — every day waiting is a day of trend data not collected.
- Phase 5 (posts) before Phase 6 (Tier 2 connectors) because posts unblocks the writing archive use case independently.
- Phase 8 (correlation timeline) is last because it requires *all* upstream pieces present and historically deep enough to be interesting.

Each phase is independently deployable.

### 7.2 Remaining config inputs (don't affect architecture)

| Item                                | Source                                       | When needed |
| ----------------------------------- | -------------------------------------------- | ----------- |
| Bing Webmaster API key              | bing.com/webmasters API key                  | Phase 6     |
| CF Web Analytics site_tags (3 sites)| Each site's Web Analytics setup in CF dashboard | Phase 6  |
| GA4 property ID                     | GA4 admin UI                                 | Phase 6     |
| Google OAuth client + refresh token | GCP -> Auth Platform -> Clients (Web), then OAuth Playground (Server-side, Offline, Force prompt: Consent Screen). Scope: `webmasters.readonly`. Bound to jaichberger@gmail.com. | Phase 6 |
| Google service account JSON         | Generate in GCP, retained for future GA4 access (GSC moved off SA due to acknowledged Google permission-propagation bug) | Phase 6     |
| Steam Web API key                   | `steamcommunity.com/dev`                     | Phase 3     |
| GitHub PAT                          | `github.com/settings/tokens` (`read:user`, `public_repo`) | Phase 3     |
| Discord webhook URLs                | Create dedicated channels                    | Phase 2     |
| Cloudflare Access team domain + AUD | Set up Access app in Zero Trust dashboard    | Phase 1     |
| Cloudflare account/zone IDs         | From `glockyco.com` zone in CF dashboard     | Phase 1     |

### 7.3 Decisions captured during review

- **Identity colors:** indigo `#6366f1` (glockyco) / amber `#f59e0b` (WoW_Much). User-overridable via Settings.
- **Bing Webmaster scope:** track all three sites — `glockyco.com`, AK Compendium, Erenshor Maps.
- **CF Web Analytics scope:** track all three sites — `glockyco.com` (Auto Web Analytics), AK Compendium and Erenshor Maps (JS Snippet on Workers).
- **GitHub connector scope:** contributions + stars + followers only. No push/release/issue activity events in v1.
- **Deploy model:** manual `pnpm deploy` only. No CI auto-deploy.

### 7.4 Transition to writing-plans

Once §0-§7 are signed off, the brainstorming process is complete. Per `superpowers:brainstorming`, the next step is to invoke `superpowers:writing-plans` to produce an executable plan keyed off this design.

The plan is a different artifact:

- **This design** (`docs/superpowers/specs/2026-05-04-creator-dashboard-design.md`): *what* and *why*. Architecture and rationale. Long-lived.
- **Implementation plan** (`docs/superpowers/plans/...`): *how* and *in what order*. Per-phase task breakdown with concrete file lists, code skeletons, acceptance checks, dependencies. What an executing session works from.

The plan respects §7.1 phasing. Each phase becomes a sequence of small tasks with verification steps.

---

## Decision log

Concise audit trail of architectural choices and their rationale.

| Decision                                                       | Why                                                                                                                              |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Sibling private repo, not submodule of `personal-website`**  | Different threat model (auth secrets), different deploy cadence, different runtime (server vs static).                            |
| **Cloudflare-native over GitHub Actions + Turso**              | One control plane, fewer secret rotation surfaces, manual-refresh natural; GH cron is "lossy under high load" per their docs.    |
| **D1 over Workers Analytics Engine**                           | WAE has 3-month retention cap and built-in sampling. D1 free tier (5 GB) is 1000× our annual volume.                             |
| **Cron Trigger → Queues fan-out over Workflows**               | Per-fetcher retry isolation, configurable backoff up to 24h, DLQ; Workflows is sequential and journals every step.               |
| **Cloudflare Access over Worker-hosted OAuth**                 | Free, zero auth code we maintain, mobile UX is fine. JWT validation is ~15 lines.                                                |
| **Tailwind 4 over plain CSS**                                  | Dashboard work is dense and variant-heavy. Iteration speed wins over editorial design.                                           |
| **Observable Plot for charts**                                 | Native correlation view; single library covers heatmap + lines + bars + sparklines + tooltips.                                   |
| **D1 + markdown hybrid for posts**                             | SQL-joinable for correlation; markdown stays canonical for editorial.                                                            |
| **Posts metadata sync at deploy time, not runtime**            | Single source-of-truth event; no per-isolate sync race; no drift.                                                                |
| **Identities as static config, not D1 table**                  | Two identities for the foreseeable future; adding more is a code change anyway.                                                  |
| **Daily digest, not per-event push**                           | Engagement deltas don't need real-time alerting; one consolidated message at 06:00 Vienna.                                       |
| **Permanent + DLQ failures alert immediately, transient stays silent** | Real problems need attention; transient failures are noise.                                                              |
| **Single Discord webhook for digest, not per-identity**        | User wants to see both identities at once.                                                                                       |
| **Fixed 5-min retry over exponential backoff**                 | Queues doesn't pass retry count; D1 round-trip per retry is overkill at our volume.                                              |
| **Ko-fi out of scope**                                         | No public read API, webhook-only is payment-only; GA4 already covers ko-fi.com page traffic.                                     |
| **Connectors are pure (no D1 access)**                         | Clean test boundary; consumer Worker owns persistence atomically via `db.batch()`.                                               |
| **`INSERT OR IGNORE` everywhere**                              | Natural idempotency from `(source_id, external_id)` and `(source_id, metric, ts, dimensions)` PKs.                               |
| **Hand-curated fixtures over record-and-replay**               | Test goal is schema/business logic, not exhaustive API surface.                                                                  |
| **Backfill via local Node scripts, not in-Worker endpoint**    | No 15-min wall-clock ceiling; same fetcher modules parameterized by date range.                                                  |
| **Sequential `await` in connectors, not `Promise.all`**        | Worker 6-concurrent-connections ceiling. 2-3s vs 0.5s/fetcher doesn't matter at hourly cadence.                                  |
| **Manual deploy, no CI auto-deploy**                           | Single-user tool; auto-deploy = more secret surface for negligible gain.                                                         |