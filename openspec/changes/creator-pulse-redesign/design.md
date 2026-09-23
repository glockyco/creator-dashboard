## Context

See `proposal.md` for motivation and the four delta specs for user-visible behavior. The Worker uses a static `sourceRecords` registry, hourly queue dispatch, D1 metric/event tables, `fetcher_runs` and `fetcher_failures`, and Discord alerts for permanent or dead-letter failures. The home loader calls `getDashboardSnapshots` for every registered source. The displayed 30-day range is static; `latestMetricFromPoints` implements a distinct 24-hour comparison. Steam reviews store body and sentiment in `events`; wiki events store page, author, comment, revision IDs, and **net** size change. Thunderstore and Vault already store per-mod dimensional download snapshots. Steam guide fetches also collect comments and awards. The current review URL points to a game's review list, not an individual review. The existing alert key is time-window deduplication, not an incident record.

## Goals / Non-Goals

**Goals:**

- Keep Cloudflare Access, Workers, queue, D1, and the five useful connector families.
- Make cumulative guide views and per-mod downloads comparable without confusing missing baselines with zero growth.
- Present recent Steam reviews and wiki changes with ordinary links to native context.
- Preserve actionable failure notification and evidence while removing normal-operation health clutter.
- Cut over completely: no shadow collectors, legacy route aliases, or unused credentials.

**Non-Goals:**

- Recreate Google, Cloudflare, GitHub, Steam, or wiki native analytics.
- Merge counts from different mod platforms by inference.
- Add a general project model or additional analytics backend.
- Preserve post, timeline, digest, guide-comment, or per-reaction award displays that the new product does not expose.

## Decisions

### 1. Use asset-first read models, not collector cards

Keep `sourceRecords` for dispatch, but define explicit guide and mod display metadata alongside the retained sources. A guide maps to one Steam published-file ID. A mod row maps to one `(source_id, metric, dimension)` series: Thunderstore uses `package_downloads` and `package`; Vault uses `mod_downloads` and its `mod`/`slug` dimensions. Use a stable asset key for the detail route `/performance/[asset_id]`; keep platform identity in each mod key. Human names and verified native URLs come from this curated metadata, not from guessed slugs. If the Thunderstore API returns a new package, display a row with an available native destination only when its URL is verified. Prefer this mapping over adding a project table; no product decision depends on projects yet.

Replace `getDashboardSnapshots` with focused server read models for overview, performance detail, activity, and incidents. Query the necessary metric series once per page; limit Overview activity to a small number. Retain `metric_points`, `events`, `fetcher_runs`, and `fetcher_failures` as storage. The existing generic source detail and tile components do not remain as alternate paths.

### 2. Compute gains from comparable cumulative samples

Use server-controlled range values `7d`, `30d`, and `90d`; default to a browser-persisted selection supplied as a URL parameter. A stable server timestamp anchors the range. Select the nearest eligible baseline at each period boundary using a cadence-aware tolerance rather than subtracting the first observed point in the window. Compare `latest - baseline(now - window)` to `baseline(now - window) - baseline(now - 2 * window)`. A 24-hour gain uses its own boundary and label. Never use a future sample as a baseline. If a boundary has no acceptable sample, or a cumulative counter resets, mark that gain unavailable. Do not display misleading percentages for zero or absent prior-period gain. Totals across guides or mods include only complete, comparable series and disclose excluded rows; do not sum across different platforms as a substitute for matching assets. Keep UTC timestamps for storage and format local display times consistently.

This replaces the hard-coded 30-day label and the existing 24-hour-only tile projection for these surfaces; it does not change the storage format.

### 3. Keep native tools as validated links, not collectors

A small checked-in destination registry supplies the GitHub profile, the relevant GSC properties, Cloudflare Analytics entry points, and asset-specific Steam/mod/wiki links. Use verified service destinations; if a deep analytics link needs unavailable account/site identifiers, link to the correct native product landing page instead of fabricating a URL. Use ordinary anchors with no `target`, window-opening code, or forced tab. Validate external URL scheme/host before rendering configured links. Native links do not enter the source registry, preflight, queue, or health state.

### 4. Query activity directly from stored events

Read only `review` and `wiki_edit` events, join source metadata to show game or wiki labels, and order by `(ts DESC, source_id DESC, external_id DESC)`. Use a compound cursor with the same keys to avoid dropping same-timestamp events. Sentiment comes from review metadata; playtime is optional. Keep excerpts bounded in the UI but preserve full stored review text. The Steam fetcher currently saves a generic review-list URL: derive a precise review destination when upstream data permits, and otherwise label and use the game review list honestly. Wiki `old_revid`/`revid` allow a native diff URL; when unavailable, link to the page. Show **net** size delta rather than fabricated addition/deletion counts. The Activity filters remain URL-addressable and apply to Overview preview only where applicable (Overview itself stays unfiltered except date range).

### 5. Introduce durable incident identity and explicit retry state

Keep `fetcher_failures` as the append-only attempt log, and add a small `collection_incidents` table keyed by incident ID, with source ID, first/last failure time, latest tier/status/error, attempt count, last success at incident start, failure notification state, recovery time, and recovery notification state. Update it when failures persist; close it when the next successful capture commits. An issue link targets `/issues/[incident_id]`, so historical Discord links do not silently point to a different incident. Derive healthy/never-run from `fetcher_runs`; classify staleness relative to `cadenceHours` with a documented grace period. Only show `next retry` when a retry timestamp is actually recorded; queue retry, hourly dispatch, and manual retry must not be conflated. The existing authenticated refresh API can be used behind an incident-specific action, but guard repeated clicks or pending jobs to prevent duplicate forced work.

Keep Discord failure alerts limited to terminal/permanent failures and DLQ exhaustion. Send a direct authenticated issue URL after the incident exists. Deduplicate by incident instead of a rolling 24-hour key; allow a new alert after recovery and a new failure. Send one recovery message after successful resolution of an alerted incident. Persist notification state around send attempts and isolate webhook failures from metric/event persistence, so a Discord outage does not turn a successful fetch into a collection failure. Webhook delivery has no cross-system transaction: aim for one notification under normal retries and make attempted/failed sends observable; do not claim crash-proof exactly-once delivery.

### 6. Remove retired paths and data with an append-only migration

Delete retired registry entries, fetchers/auth modules/fixtures/backfills and test references for GitHub, GSC, Cloudflare Analytics, and GA4. Keep `STEAM_WEB_API_KEY`, `DISCORD_ALERTS_WEBHOOK`, and Cloudflare Access/queue/D1 bindings. Remove unused Google/Cloudflare Analytics/GitHub/GA4 secrets from `Env`, `.dev.vars.example`, preflight, and scripts. Remove `maybeDailyDigest`, its cron (`0 4,5 * * *`), the digest webhook and tables; remove posts sync from deployment and the posts/timeline/generic source/settings routes. Remove guide comments and the unused per-reaction award table. Retain guide favorites, rating, vote count, and aggregate award captures. Retain positive and negative review metrics, review events, and wiki events. Add a new numbered migration that deletes retired source metrics, events, runs, failures, alerts and post/digest records; drop obsolete tables and indexes. Never edit `0001_initial_schema.sql` or applied migrations. Update seed/dev setup and post-deploy verification so no old route or retired secret remains a prerequisite.

### 7. Replace the shell without adding UI dependencies

Use Svelte 5 runes and one dark palette: mauve-neutral canvas and rounded panels, restrained iris accents, readable secondary text, and consistent borders. Do not maintain a light theme or theme selection state. Desktop gets a compact top header with Overview, Activity, and Issues; mobile gets a three-item bottom bar with an active-issue count. Remove identity color and unused default-date-range settings; the range control is functional and URL-backed. Use separate full-width tables for Steam guides, Thunderstore mods, Vault mods, and Steam reviews. Sort each table by name by default. Keep asset, cumulative total, rolling 24-hour gain, selected-range gain, previous-period comparison, and trend in that order. Show positive and negative reviews as separate rows per game. Show guide favorites, rating, vote count, and awards in each guide row and detail. Keep the recent-activity preview below the tables. Use a common column grid without ranking cards, promotional text, or repeated metric summaries. Show collection freshness quietly when healthy and a direct issue link when active. Use accessible tables, drill-down links, and visible focus states. Missing series and incident details receive explicit text; sparklines supplement numbers rather than replacing them.

## Risks / Trade-offs

- [Sparse historical captures] → Mark gains unavailable when a boundary has no eligible sample; never silently call it zero.
- [Cumulative counter reset or mod rename] → Treat a reset as a discontinuity and identify a mod by stable platform key, not display name alone.
- [Existing Thunderstore data is a team-wide set] → Filter to explicit package series; do not present team totals as a single mod.
- [Unverified native deep links] → Use known public destinations until real account/site URLs are verified; never synthesize private IDs.
- [Discord send races and failures] → Store incident notification state, dedupe by incident, and keep collection success independent of webhook availability.
- [Destructive migration] → Verify retained source IDs and row counts on a copy of production D1 before applying; take a backup/export; test mixed history and rollback by code redeploy plus D1 restore rather than editing migrations.
- [Source deletion while jobs are queued] → Let existing unknown-source handling acknowledge them; update cron, queue, smoke scripts, and alerts before cleanup.
- [Removing unused routes breaks bookmarks] → Remove intentionally with no aliases; validate direct paths and update internal navigation/tests.

## Migration Plan

1. Build and validate the new read models and interface against local seeded D1, including missing data and same-timestamp activity events.
2. Add incident persistence and notification cutover; exercise transient, permanent, DLQ, recovered, and Discord-outage paths.
3. Remove retired collectors, routes, scripts, credentials, old tests, and daily cron in one clean cutover; update deploy and smoke commands.
4. Test the append-only migration against mixed retained/retired data and restore rehearsals. Back up remote D1 before production deployment.
5. Apply migration, deploy the Worker, and verify Overview, Activity, Issues, native navigation, and alerts through an authenticated preview or production session.
6. Roll back application code only with care: old code requires data and tables that the migration deletes. Recover from the pre-migration D1 backup before redeploying an old version.
