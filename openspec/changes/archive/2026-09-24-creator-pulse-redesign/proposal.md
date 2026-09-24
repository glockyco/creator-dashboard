## Why

The home page gives 19 collectors equal-sized cards, although guide views and mod downloads are the main reasons to visit. Reviews and wiki edits are hard to find, while unused analytics, posts, and digest features add operational noise.

## What Changes

- Replace the source grid with a compact Overview: name-sorted guide views, separate Thunderstore and Vault downloads, positive and negative Steam review gains, recent activity, and an issue banner. Show current guide favorites, rating, vote count, and awards with their absolute 24-hour and selected-range changes.
- Add an Activity feed for Steam reviews and wiki changes, plus focused guide and mod performance details.
- Replace Health with Issues: active failures first, diagnostic history, manual retry, and quiet healthy-collector inspection. Keep deduplicated Discord failure alerts; add direct investigation links and recovery notifications.
- Provide ordinary, same-tab links to GitHub, Google Search Console, Cloudflare Analytics, Steam, mod hosts, and wiki pages. Never force a new tab.
- **BREAKING**: retire GitHub, GSC, Cloudflare Analytics, and GA4 collectors; remove their metrics, credentials, backfills, and failures. Remove daily Discord digest, posts synchronization, timeline, generic source pages, and their unused UI and data.
- Use functional 7/30/90-day windows and show absolute changes, not previous-period percentages. Retain a visible distinction between fresh, stale, failed, retrying, and never-run collectors.

## Capabilities

### New Capabilities

- `performance-overview`: Guide and per-mod performance, functional date ranges, detail views, and native service links.
- `community-activity`: Combined Steam review and wiki activity with direct links and task-specific filters.
- `collection-issues`: Actionable failures, incident investigation, manual recovery, and Discord failure/recovery alerts.
- `integration-cutover`: Retain five connector families and remove unused collector, digest, post, timeline, and source-oriented behaviors.

### Modified Capabilities

None. This project has no existing OpenSpec capability specifications.

## Impact

SvelteKit routes and components, source registry and dashboard queries, Steam/mod/wiki fetchers, queue and scheduled handlers, alert persistence, D1 migrations, Cloudflare configuration, local/deploy scripts, fixtures, and affected tests. Existing production data requires an append-only migration; no original migration is edited. Cloudflare Access and D1 remain in place.
