## 1. Read Models and Metadata

- [x] 1.1 Define stable guide and mod-platform asset metadata plus verified native destinations. Check that each retained guide and each configured mod maps to one asset and an ordinary link.
- [x] 1.2 Replace tile snapshot projections with focused guide and dimensional mod queries. Verify captured totals and per-platform separation with representative D1 rows.
- [x] 1.3 Implement 24-hour and 7/30/90-day gains against eligible boundary samples. Verify sparse captures, resets, zero prior gain, missing baselines, and honest aggregate exclusions.
- [x] 1.4 Build activity queries for reviews and wiki edits with type, subject, sentiment, range, and compound cursor filters. Verify same-time events page without omission or duplication.

## 2. Overview and Performance

- [x] 2.1 Replace the home grid with name-sorted guide, separate Thunderstore/Vault, and positive/negative Steam review tables plus a recent-activity preview. Verify actual rows and empty states in the browser.
- [x] 2.2 Add functional range selection, URL state, browser persistence, and period labels. Verify 7/30/90-day choices change both chart and comparison values.
- [x] 2.3 Build focused guide/mod detail routes with trends and native destinations. Verify Afallon guide and both mod platforms through the running application.
- [x] 2.4 Replace the sidebar with desktop top navigation and mobile bottom navigation in one dark palette. Verify keyboard focus and narrow-screen navigation in a browser.
- [x] 2.5 Add curated GitHub, GSC, and Cloudflare native shortcuts. Verify normal clicks stay in the current tab and no forced-tab attributes or handlers exist.
- [x] 2.6 Restore guide favorites, rating, vote count, and aggregate award collection and display. Preserve award metric history through pending cleanup; verify capture, missing fields, and detail in the browser.
- [x] 2.7 Show positive and negative Steam review totals and comparable gains per game. Verify missing boundaries and both sentiments with stored captures.

## 3. Community Activity

- [x] 3.1 Build Activity UI for mixed reviews and wiki edits with URL-addressable filters and chronological paging. Verify review sentiment and wiki net size change in the browser.
- [x] 3.2 Improve native review and wiki links using available identifiers; fall back to clearly labeled native context where precision is unavailable. Verify both links without forced new tabs.

## 4. Collection Issues

- [x] 4.1 Add append-only incident migration and incident read/write model for failure, recovery, and notification state. Verify failure-to-recovery and later-new-failure transitions on D1 fixtures.
- [x] 4.2 Integrate incident updates into consumer and dead-letter paths; record automatic retry time only when known. Verify permanent, transient, DLQ, and successful fetch behavior.
- [x] 4.3 Preserve Discord failure deduplication by incident, add direct issue links and recovery notification after alerted incidents. Verify webhook failure does not convert successful collection into failed collection.
- [x] 4.4 Build Issues list, issue detail, attempt history, healthy-collector view, and guarded manual retry. Verify full errors, real retry scheduling, duplicate-click protection, and status transitions in the browser.
- [x] 4.5 Connect Overview and navigation issue indicators to incident state. Verify healthy mode stays quiet and active issues link to their stable incident URL.

## 5. Clean Cutover

- [x] 5.1 Remove GitHub, GSC, Cloudflare Analytics, and GA4 registry entries, connectors, auth, backfills, fixture support, and retired secrets. Verify due-source dispatch and preflight use retained sources only.
- [x] 5.2 Remove daily digest, Discord digest secret, posts indexing/sync, timeline, source tiles/details, old Health/Settings routes, unused components, and obsolete tests. Verify remaining imports and commands have no dead paths.
- [x] 5.3 Remove guide comments and unused per-reaction award storage. Keep aggregate awards, favorites, rating, and vote counts. Verify guide and review/wiki collection still ingests normally.
- [x] 5.4 Add an append-only cleanup migration for retired metrics, events, runs, failures, alerts, posts, digest, and unused per-reaction award storage. Verify retained guide engagement rows and issue data survive on mixed-history fixtures.
- [x] 5.5 Update local setup, preview, deploy scripts, cron configuration, smoke tools, and repo guidance to match the reduced product. Verify deployment preflight requires only retained secrets and no posts sync runs.

## 6. Integration Verification

- [x] 6.1 Run focused unit checks, type checks, and lint once the cutover is integrated. Verify the project build succeeds without retired modules or references.
- [x] 6.2 Exercise Overview, Activity, Issues, performance details, same-tab links, mobile navigation, and failure/recovery flows in the local preview browser. Record any environment-limited checks explicitly.
- [x] 6.3 Rehearse D1 backup, migration, and restore on a copy before deployment. Verify migration is non-destructive to retained captures; do not deploy or push without a separate request.
