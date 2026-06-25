---
title: "Steam Guide Engagement — Comments and Awards Design Spec"
type: spec
status: implemented
created: 2026-06-05
parent:
superseded_by:
archived: 2026-06-25
---

# Steam Guide Engagement — Comments and Awards Design Spec

> **Status:** Approved design, pre-implementation (2026-06-05).
> **Scope:** Capture public Steam guide comments and award/reaction counts for `steam-guide-erenshor` and `steam-guide-ak`, then show them on each source detail page.

---

## 0. Problem

The Steam guide sources currently collect only guide metrics from `ISteamRemoteStorage.GetPublishedFileDetails`: `views`, `rating`, and `ratings`. The detail pages therefore show charts and linked posts, but not the most useful engagement data visible on Steam itself: public comments and the award/reaction badges shown near the guide header.

Goal: make the two Steam guide detail pages useful as an engagement monitor without making page loads depend on Steam availability.

## 1. Decision

Use the existing fetcher pipeline for ingestion, persist guide comments as dashboard events, and add a small Steam-specific table for the latest guide award/reaction state.

### 1.1 Why this shape

Comments are event-like: they have a stable upstream id, author, timestamp, body, source URL, and belong in the same feed/pagination model already used by reviews, wiki edits, and other source events. Storing them in `events` avoids duplicating feed logic and lets source detail pages reuse `EventsFeed`.

Awards/reactions are not events. They are per-guide counters with a Steam reaction id, icon, and latest count. Storing them as generic metric dimensions would make the metric query path harder to understand and would hide the Steam-specific icon/type identity. A dedicated `steam_guide_awards` table keeps that upstream shape explicit and maintainable.

### 1.2 Why not the alternatives

- **All data in generic metric points:** no migration, but per-reaction dimensions would make source-detail queries and UI brittle. Metrics remain best for scalar totals and trends.
- **Dedicated comments table:** clean in isolation, but duplicates `events` semantics, pagination, rendering, and the existing `INSERT OR IGNORE` dedupe behavior.
- **Fetch live on detail-page load:** avoids storage, but makes source pages slow/flaky and bypasses the app's existing cron/queue/fetcher persistence model.

### 1.3 Evidence

- Steam's published-file protobuf includes `CPublishedFile_GetDetails_Request.includereactions` and `PublishedFileDetails.reactions[]` with `reactionid` and `count`.
- Steam guide pages expose comments through `https://steamcommunity.com/comment/PublishedFile_Public/render/{creator}/{publishedfileid}/`, returning JSON with `total_count` and rendered `comments_html`.
- The public Steam guide HTML for both tracked guides shows the same creator Steam ID (`76561198107304856`), public comment lists, and award/reaction image URLs under `public/images/loyalty/reactions/still/{reactionid}.png`.

## 2. Architecture

Runtime stays on the existing ingestion path:

```text
cron -> dispatcher -> FETCHER_QUEUE -> consumer
  -> fetchSteamGuide({ source, env, now })
     -> GetPublishedFileDetails(includevotes=true, includereactions=true)
     -> comment render endpoint, paginated by start/count
     -> metric_points: views, rating, ratings, comment_count, award_count
     -> events: steam_guide_comment rows
     -> steam_guide_awards: latest per-reaction counts/icons
```

The source detail route continues to load from D1 only. It does not call Steam.

## 3. Data model

### 3.1 Existing `events`

Steam guide comments are persisted as events:

- `source_id`: the Steam guide source id.
- `external_id`: Steam comment id without the `comment_` prefix.
- `ts`: comment `data-timestamp * 1000`.
- `kind`: `steam_guide_comment`.
- `author`: display name from the comment HTML.
- `title`: `Steam guide comment`.
- `body`: plain-text comment body, HTML-decoded and whitespace-normalized.
- `url`: `https://steamcommunity.com/sharedfiles/filedetails/?id=<publishedfileid>#comment_<commentid>`.
- `metadata`: at least `{ "author_url": "...", "publishedfileid": "..." }` when present.

`events` already uses `INSERT OR IGNORE`, so existing comments are not rewritten every hourly run.

### 3.2 New `steam_guide_awards`

Add an append-only migration creating:

```sql
CREATE TABLE steam_guide_awards (
  source_id   TEXT    NOT NULL,
  reaction_id INTEGER NOT NULL,
  count       INTEGER NOT NULL,
  icon_url    TEXT    NOT NULL,
  captured_at INTEGER NOT NULL,
  PRIMARY KEY (source_id, reaction_id)
);
```

Persist each fetch with an upsert on `(source_id, reaction_id)` that replaces `count`, `icon_url`, and `captured_at` with the latest values. If a reaction disappears upstream, set its count to 0 or delete the row; prefer deletion so the UI only renders active awards.

### 3.3 Metric points

Extend Steam guide scalar metrics with:

- `comment_count`: `num_comments_public` from details, or the comment endpoint `total_count` if details omits it.
- `award_count`: sum of `reactions[].count`.

These metrics are eligible for charts/cards like other source metrics, but the icon-level display comes from `steam_guide_awards`.

### 3.4 Fetcher output contract

Extend `FetcherOutput` with an optional Steam-specific field:

```ts
steam_guide_awards?: {
  source_id: string;
  reaction_id: number;
  count: number;
  icon_url: string;
  captured_at: number;
}[];
```

Only `fetchSteamGuide` populates it. `successStatements` persists it when present and ignores it for every other connector. This keeps comments in the generic event model while making the Steam-only award persistence explicit.

## 4. Fetching and parsing

### 4.1 Details request

Keep the current `IPublishedFileService.GetDetails` request, and add:

- `includereactions=true`
- schema fields: `creator`, `num_comments_public`, optional `reactions[]`

Continue to require `result === 1`. Continue throwing `FetchError` for upstream HTTP failures and `ZodError` for response drift.

### 4.2 Comments request

Use the public render endpoint:

```text
POST https://steamcommunity.com/comment/PublishedFile_Public/render/{creator}/{publishedfileid}/
body: start=<offset>&totalcount=<known-or-0>&count=50
```

Fetch pages until all comments are captured or `start + pagesize >= total_count`. Counts are small for the tracked guides, so full pagination is acceptable. Cap pages defensively to avoid infinite loops if Steam returns inconsistent pagination.

Parse only the stable fields needed for events:

- comment block id: `id="comment_<id>"`
- author URL and display name from `.commentthread_author_link`
- timestamp from `data-timestamp`
- body from `.commentthread_comment_text`

Decode HTML entities and strip tags from the body. Do not persist rendered HTML.

## 5. Source detail UI

The detail page gains a Steam-specific awards panel for `steam-guide-*` sources:

- Header: `Steam awards`
- Body: active awards sorted by count descending, then reaction id ascending.
- Each item shows Steam's reaction icon and the count.
- Empty state: `No Steam awards captured yet.`

`EventsFeed` remains the comments display. It will show `steam_guide_comment` rows for guide sources alongside any future guide events.

## 6. Error handling

- Details fetch failure keeps failing the Steam guide fetcher, as today.
- Comments endpoint failure should fail the fetcher too: comments are part of the requested source snapshot, and silent partial ingestion would make the detail page misleading.
- Comment parser drift should fail with a clear error if Steam returns comments but no parseable comment blocks.
- Zero comments is valid when `total_count === 0`.
- Missing `reactions` is valid and produces `award_count = 0` plus an empty awards panel.

## 7. Testing and verification

- **Fetcher tests:** extend `steam-guide.test.ts` with a fixture containing `creator`, `num_comments_public`, and `reactions`; mock the comments endpoint; assert metrics, comment events, details request params, and awards output.
- **Parser tests:** cover multiple comments, author URL/name extraction, timestamp conversion, entity decoding, whitespace normalization, and empty comment pages.
- **Persistence tests:** assert `successStatements` writes `steam_guide_awards` upserts/deletes without disturbing existing metric/event persistence.
- **Source detail tests:** assert `getSourceDetail` returns awards for Steam guides and the page renders the awards panel.
- **Verification commands:** targeted unit tests for the changed fetcher, persistence, source detail, and Svelte component/check path; run `pnpm check` for type/Svelte validation.

## 8. Rollout

1. Add the migration for `steam_guide_awards`.
2. Update the Steam guide fetcher and persistence path.
3. Deploy through the normal migration + worker deploy path.
4. Trigger or wait for the next hourly Steam guide fetch.
5. Confirm the two detail pages show comments and awards from D1.

No backfill script is required: the first successful post-deploy fetch captures all currently available public comments and latest award counts.

## 9. Non-goals

- Moderation, sentiment analysis, or filtering of comments.
- Reply threading or rendering Steam's original comment HTML.
- Live Steam calls from source detail pages.
- Capturing Steam guide body content, screenshots, favorites, or subscriptions beyond the requested comments and awards.
