---
title: "Steam Guide Engagement Implementation Plan"
type: plan
status: implemented
created: 2026-06-05
parent: 2026-06-05-steam-guide-engagement-design
superseded_by:
archived: 2026-06-25
---

# Steam Guide Engagement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture public Steam guide comments plus award/reaction counts and render them on Steam guide source detail pages.

**Architecture:** Keep guide comments in the existing `events` model because they are timeline items. Add a dedicated `steam_guide_awards` table for latest per-reaction counts/icons, exposed through `getSourceDetail` and a small source-detail panel. Extend the Steam guide fetcher to request reactions and page the public Steam comment endpoint during the normal cron/queue ingestion path.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest, Cloudflare Workers/D1, Wrangler migrations, Zod schemas, existing `fetchJson` helper.

---

## File structure

- Create `migrations/0003_steam_guide_awards.sql`: D1 table for latest Steam guide award/reaction state.
- Modify `src/lib/types/domain.ts`: add `SteamGuideAward` and optional `FetcherOutput.steam_guide_awards`.
- Modify `src/lib/server/orchestration/persist.ts`: persist optional awards with upsert plus stale-row cleanup.
- Modify `src/lib/server/orchestration/persist.test.ts`: prove award statements are emitted only when the fetcher output includes awards.
- Create `src/lib/connectors/fetchers/steam-guide-comments.ts`: fetch and parse Steam's public guide comment JSON/HTML endpoint.
- Create `src/lib/connectors/fetchers/steam-guide-comments.test.ts`: parser and pagination tests.
- Modify `src/lib/connectors/fetchers/steam-guide.ts`: request reactions, emit comments, scalar counts, and awards.
- Modify `src/lib/connectors/fetchers/steam-guide.test.ts`: fetcher integration tests for comments, reaction metrics, and request parameters.
- Modify `src/lib/connectors/fetchers/steam-guide.fixture.json`: add the fields the new schema reads.
- Modify `scripts/capture-fixture.ts`: capture Steam guide fixtures with `includereactions=true`.
- Modify `src/lib/sources/metrics.ts` and `src/lib/sources/metrics.test.ts`: add `comment_count` and `award_count` to Steam guide primary metrics.
- Modify `src/lib/server/source-detail.ts`: add `steamGuideAwards` to `SourceDetail` and query `steam_guide_awards`.
- Modify `src/lib/server/source-detail.test.ts`: assert awards are loaded and sorted.
- Create `src/lib/components/sources/SteamGuideAwards.svelte`: render icon/count badges and empty state.
- Modify `src/routes/sources/[id]/+page.svelte`: render the awards panel for Steam guide sources.

---

### Task 1: Add award persistence contract

**Files:**

- Create: `migrations/0003_steam_guide_awards.sql`
- Modify: `src/lib/types/domain.ts`
- Modify: `src/lib/server/orchestration/persist.ts`
- Test: `src/lib/server/orchestration/persist.test.ts`

- [ ] **Step 1: Write the failing persistence test**

Add a second test to `src/lib/server/orchestration/persist.test.ts`:

```ts
it('upserts steam guide awards and removes awards missing from the latest snapshot', () => {
  const { db, statements } = fakeDb();
  const output: FetcherOutput = {
    metric_points: [],
    events: [],
    steam_guide_awards: [
      {
        source_id: 'steam-guide-erenshor',
        reaction_id: 17,
        count: 5,
        icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/17.png?v=5',
        captured_at: 1777852800000
      },
      {
        source_id: 'steam-guide-erenshor',
        reaction_id: 27,
        count: 2,
        icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/27.png?v=5',
        captured_at: 1777852800000
      }
    ]
  };

  const result = successStatements(db, 'steam-guide-erenshor', 1777852800000, output);

  expect(result).toHaveLength(4);
  expect(statements[0].sql).toContain('INSERT INTO steam_guide_awards');
  expect(statements[0].sql).toContain('ON CONFLICT(source_id, reaction_id) DO UPDATE');
  expect(statements[0].binds).toEqual([
    'steam-guide-erenshor',
    17,
    5,
    'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/17.png?v=5',
    1777852800000
  ]);
  expect(statements[2].sql).toContain('DELETE FROM steam_guide_awards');
  expect(statements[2].binds).toEqual(['steam-guide-erenshor', 1777852800000]);
  expect(statements[3].sql).toContain('INSERT INTO fetcher_runs');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/lib/server/orchestration/persist.test.ts`

Expected: FAIL because `FetcherOutput` has no `steam_guide_awards` field and `successStatements` emits no award statements.

- [ ] **Step 3: Add the D1 migration**

Create `migrations/0003_steam_guide_awards.sql`:

```sql
CREATE TABLE steam_guide_awards (
  source_id TEXT NOT NULL,
  reaction_id INTEGER NOT NULL,
  count INTEGER NOT NULL,
  icon_url TEXT NOT NULL,
  captured_at INTEGER NOT NULL,
  PRIMARY KEY (source_id, reaction_id)
);
```

- [ ] **Step 4: Extend the domain types**

In `src/lib/types/domain.ts`, add after `EventRow`:

```ts
export type SteamGuideAward = {
  source_id: string;
  reaction_id: number;
  count: number;
  icon_url: string;
  captured_at: number;
};
```

Replace `FetcherOutput` with:

```ts
export type FetcherOutput = {
  metric_points: MetricPoint[];
  events: EventRow[];
  steam_guide_awards?: SteamGuideAward[];
};
```

- [ ] **Step 5: Persist awards in `successStatements`**

In `src/lib/server/orchestration/persist.ts`, build award statements before the returned array:

```ts
const awardStatements = output.steam_guide_awards
  ? [
      ...output.steam_guide_awards.map((award) =>
        db
          .prepare(
            `INSERT INTO steam_guide_awards (source_id, reaction_id, count, icon_url, captured_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(source_id, reaction_id) DO UPDATE SET
               count = excluded.count,
               icon_url = excluded.icon_url,
               captured_at = excluded.captured_at`
          )
          .bind(award.source_id, award.reaction_id, award.count, award.icon_url, award.captured_at)
      ),
      db.prepare('DELETE FROM steam_guide_awards WHERE source_id = ? AND captured_at <> ?').bind(sourceId, now)
    ]
  : [];
```

Then spread `...awardStatements` between the event statements and the `fetcher_runs` upsert.

- [ ] **Step 6: Run the persistence test to verify it passes**

Run: `pnpm test src/lib/server/orchestration/persist.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add migrations/0003_steam_guide_awards.sql src/lib/types/domain.ts src/lib/server/orchestration/persist.ts src/lib/server/orchestration/persist.test.ts
git commit -m "feat(steam): persist guide awards"
```

---

### Task 2: Add Steam guide comment parsing and paging

**Files:**

- Create: `src/lib/connectors/fetchers/steam-guide-comments.ts`
- Test: `src/lib/connectors/fetchers/steam-guide-comments.test.ts`

- [ ] **Step 1: Write parser and pagination tests first**

Create `src/lib/connectors/fetchers/steam-guide-comments.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { fetchSteamGuideComments, parseSteamGuideComments } from './steam-guide-comments';

const commentsHtml = `
<div class="commentthread_comment responsive_body_text" id="comment_111">
  <a class="hoverunderline commentthread_author_link" href="https://steamcommunity.com/profiles/1"><bdi>Alice &amp; Bob</bdi></a>
  <span class="commentthread_comment_timestamp" title="1 January, 2026" data-timestamp="1770000001">1 Jan</span>
  <div class="commentthread_comment_text" id="comment_content_111">
    Hello&nbsp;world<br>Second line
  </div>
</div>
<div class="commentthread_comment responsive_body_text" id="comment_222">
  <a class="hoverunderline commentthread_author_link" href="https://steamcommunity.com/id/charlie"><bdi>Charlie</bdi></a>
  <span class="commentthread_comment_timestamp" title="2 January, 2026" data-timestamp="1770000002">2 Jan</span>
  <div class="commentthread_comment_text" id="comment_content_222">Thanks &#x1F642;</div>
</div>`;

describe('parseSteamGuideComments', () => {
  it('extracts ids, authors, timestamps, urls, and normalized plain text bodies', () => {
    expect(parseSteamGuideComments(commentsHtml, '3500398991')).toEqual([
      {
        source_id: '',
        external_id: '111',
        ts: 1770000001000,
        kind: 'steam_guide_comment',
        author: 'Alice & Bob',
        title: 'Steam guide comment',
        body: 'Hello world Second line',
        url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3500398991#comment_111',
        metadata: { author_url: 'https://steamcommunity.com/profiles/1', publishedfileid: '3500398991' }
      },
      {
        source_id: '',
        external_id: '222',
        ts: 1770000002000,
        kind: 'steam_guide_comment',
        author: 'Charlie',
        title: 'Steam guide comment',
        body: 'Thanks 🙂',
        url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3500398991#comment_222',
        metadata: { author_url: 'https://steamcommunity.com/id/charlie', publishedfileid: '3500398991' }
      }
    ]);
  });

  it('returns an empty list for empty comment html', () => {
    expect(parseSteamGuideComments('', '3500398991')).toEqual([]);
  });
});

describe('fetchSteamGuideComments', () => {
  it('pages until Steam reports all comments captured', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            start: 0,
            pagesize: '1',
            total_count: 2,
            comments_html: commentsHtml.split('</div>')[0] + '</div>'
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            start: 1,
            pagesize: '1',
            total_count: 2,
            comments_html: commentsHtml.split('</div>').slice(1).join('</div>')
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetch);

    const result = await fetchSteamGuideComments({
      creator: '76561198107304856',
      publishedfileid: '3500398991',
      pageSize: 1
    });

    expect(result.totalCount).toBe(2);
    expect(result.comments.map((comment) => comment.external_id)).toEqual(['111', '222']);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1]?.[1]?.body)).toContain('start=1');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/connectors/fetchers/steam-guide-comments.test.ts`

Expected: FAIL because `steam-guide-comments.ts` does not exist.

- [ ] **Step 3: Implement the parser and fetch helper**

Create `src/lib/connectors/fetchers/steam-guide-comments.ts` with:

```ts
import { z } from 'zod';
import { fetchJson } from '../http';
import type { EventRow } from '$lib/types/domain';

const CommentPage = z.object({
  success: z.boolean(),
  start: z.number().int().optional(),
  pagesize: z.union([z.string(), z.number()]),
  total_count: z.number().int(),
  comments_html: z.string()
});

export type SteamGuideCommentsResult = {
  totalCount: number;
  comments: EventRow[];
};

export async function fetchSteamGuideComments({
  creator,
  publishedfileid,
  pageSize = 50,
  maxPages = 20
}: {
  creator: string;
  publishedfileid: string;
  pageSize?: number;
  maxPages?: number;
}): Promise<SteamGuideCommentsResult> {
  const comments: EventRow[] = [];
  let totalCount = 0;
  let start = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const body = new URLSearchParams({ start: String(start), totalcount: String(totalCount), count: String(pageSize) });
    const data = await fetchJson(
      `https://steamcommunity.com/comment/PublishedFile_Public/render/${creator}/${publishedfileid}/`,
      { method: 'POST', body, schema: CommentPage }
    );
    if (!data.success) throw new Error(`Steam comments for guide ${publishedfileid} were not returned successfully`);

    totalCount = data.total_count;
    const pageComments = parseSteamGuideComments(data.comments_html, publishedfileid);
    comments.push(...pageComments);
    const parsedPageSize = Number(data.pagesize);
    const step = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : pageSize;
    start += step;
    if (totalCount === 0 || start >= totalCount) return { totalCount, comments };
  }

  throw new Error(`Steam comments for guide ${publishedfileid} exceeded ${maxPages} pages`);
}

export function parseSteamGuideComments(html: string, publishedfileid: string): EventRow[] {
  const starts = [
    ...html.matchAll(/<div[^>]+class="[^"]*commentthread_comment\b[^"]*"[^>]+id="comment_(\d+)"[^>]*>/g)
  ].map((match) => ({ index: match.index ?? 0, id: match[1] }));
  return starts.flatMap((start, index) => {
    const block = html.slice(start.index, starts[index + 1]?.index ?? html.length);
    const timestamp = /data-timestamp="(\d+)"/.exec(block)?.[1];
    const bodyMatch = /<div[^>]+class="commentthread_comment_text"[^>]*>([\s\S]*?)<\/div>/.exec(block);
    if (!timestamp || !bodyMatch) return [];
    const authorMatch =
      /<a[^>]+class="[^"]*commentthread_author_link[^"]*"[^>]+href="([^"]+)"[\s\S]*?<bdi>([\s\S]*?)<\/bdi>/.exec(block);
    const authorUrl = authorMatch ? decodeHtml(authorMatch[1]) : null;
    return [
      {
        source_id: '',
        external_id: start.id,
        ts: Number(timestamp) * 1000,
        kind: 'steam_guide_comment',
        author: authorMatch ? normalizePlainText(authorMatch[2]) : null,
        title: 'Steam guide comment',
        body: normalizePlainText(bodyMatch[1]),
        url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${publishedfileid}#comment_${start.id}`,
        metadata: authorUrl ? { author_url: authorUrl, publishedfileid } : { publishedfileid }
      }
    ];
  });
}

function normalizePlainText(html: string): string {
  return decodeHtml(html.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
    if (code === 'amp') return '&';
    if (code === 'lt') return '<';
    if (code === 'gt') return '>';
    if (code === 'quot') return '"';
    if (code === 'apos') return "'";
    if (code === 'nbsp') return ' ';
    const radix = code.toLowerCase().startsWith('#x') ? 16 : 10;
    const numeric = code.toLowerCase().startsWith('#x') ? code.slice(2) : code.slice(1);
    const point = Number.parseInt(numeric, radix);
    return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
  });
}
```

- [ ] **Step 4: Run the parser tests to verify they pass**

Run: `pnpm test src/lib/connectors/fetchers/steam-guide-comments.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/connectors/fetchers/steam-guide-comments.ts src/lib/connectors/fetchers/steam-guide-comments.test.ts
git commit -m "feat(steam): parse guide comments"
```

---

### Task 3: Extend the Steam guide fetcher

**Files:**

- Modify: `src/lib/connectors/fetchers/steam-guide.ts`
- Modify: `src/lib/connectors/fetchers/steam-guide.test.ts`
- Modify: `src/lib/connectors/fetchers/steam-guide.fixture.json`
- Modify: `scripts/capture-fixture.ts`

- [ ] **Step 1: Write the failing fetcher test**

Update the first `fetchSteamGuide` test to expect all emitted outputs:

```ts
it('emits guide metrics, comments, and award snapshots', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(fixture), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          start: 0,
          pagesize: '50',
          total_count: 1,
          comments_html:
            '<div class="commentthread_comment responsive_body_text" id="comment_111"><a class="hoverunderline commentthread_author_link" href="https://steamcommunity.com/profiles/1"><bdi>Alice</bdi></a><span data-timestamp="1770000001"></span><div class="commentthread_comment_text" id="comment_content_111">Great guide</div></div>'
        }),
        { status: 200 }
      )
    );
  vi.stubGlobal('fetch', fetch);

  const out = await fetchSteamGuide({ source, env, now });

  expect(out.metric_points.map((point) => point.metric)).toEqual([
    'views',
    'rating',
    'ratings',
    'comment_count',
    'award_count'
  ]);
  expect(out.metric_points.find((point) => point.metric === 'comment_count')?.value).toBe(21);
  expect(out.metric_points.find((point) => point.metric === 'award_count')?.value).toBe(7);
  expect(out.events).toHaveLength(1);
  expect(out.events[0]).toMatchObject({
    source_id: 'steam-guide-erenshor',
    external_id: '111',
    kind: 'steam_guide_comment',
    body: 'Great guide'
  });
  expect(out.steam_guide_awards).toEqual([
    {
      source_id: 'steam-guide-erenshor',
      reaction_id: 17,
      count: 5,
      icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/17.png?v=5',
      captured_at: now
    },
    {
      source_id: 'steam-guide-erenshor',
      reaction_id: 27,
      count: 2,
      icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/27.png?v=5',
      captured_at: now
    }
  ]);
});
```

- [ ] **Step 2: Update the request-parameter test expectation**

In the request test, expect `includereactions` and two fetch calls:

```ts
expect(calledUrl.searchParams.get('includereactions')).toBe('true');
expect(fetch).toHaveBeenCalledTimes(2);
```

- [ ] **Step 3: Update the fixture used by the failing test**

Add these fields to the first item in `src/lib/connectors/fetchers/steam-guide.fixture.json`:

```json
"creator": "76561198107304856",
"num_comments_public": 21,
"reactions": [
  { "reactionid": 17, "count": 5 },
  { "reactionid": 27, "count": 2 }
]
```

- [ ] **Step 4: Run the fetcher test to verify it fails**

Run: `pnpm test src/lib/connectors/fetchers/steam-guide.test.ts`

Expected: FAIL because the fetcher does not request reactions or comments and does not emit new fields.

- [ ] **Step 5: Implement the fetcher changes**

In `src/lib/connectors/fetchers/steam-guide.ts`:

- import `fetchSteamGuideComments`.
- extend the Zod detail schema with `creator`, `num_comments_public`, and `reactions`.
- set `includereactions=true` on the details URL.
- call `fetchSteamGuideComments` after validating the detail.
- map comments to the current `source.id`.
- emit `comment_count`, `award_count`, and `steam_guide_awards`.

Use this shape:

```ts
const STEAM_REACTION_ICON_BASE = 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still';

const Reaction = z.object({ reactionid: z.number().int(), count: z.number().int() });
```

```ts
url.searchParams.set('includereactions', 'true');
```

```ts
const comments = await fetchSteamGuideComments({ creator: detail.creator, publishedfileid: config.publishedfileid });
const reactions = detail.reactions ?? [];
const awardCount = reactions.reduce((sum, reaction) => sum + reaction.count, 0);
```

- [ ] **Step 6: Update fixture capture**

In `scripts/capture-fixture.ts`, add this line in `captureSteamGuide` before the fetch:

```ts
body.set('includereactions', 'true');
```

- [ ] **Step 7: Run the fetcher tests to verify they pass**

Run: `pnpm test src/lib/connectors/fetchers/steam-guide.test.ts src/lib/connectors/fetchers/steam-guide-comments.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/lib/connectors/fetchers/steam-guide.ts src/lib/connectors/fetchers/steam-guide.test.ts src/lib/connectors/fetchers/steam-guide.fixture.json scripts/capture-fixture.ts
git commit -m "feat(steam): capture guide engagement"
```

---

### Task 4: Surface awards and metrics in source detail data

**Files:**

- Modify: `src/lib/sources/metrics.ts`
- Modify: `src/lib/sources/metrics.test.ts`
- Modify: `src/lib/server/source-detail.ts`
- Modify: `src/lib/server/source-detail.test.ts`

- [ ] **Step 1: Write the source-detail failing test**

Extend the registry mock in `source-detail.test.ts` so `steam-guide-erenshor` returns a source record. Then add rows in `rowsFor` for `FROM steam_guide_awards`:

```ts
if (sql.includes('FROM steam_guide_awards')) {
  return [
    {
      source_id: 'steam-guide-erenshor',
      reaction_id: 27,
      count: 2,
      icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/27.png?v=5',
      captured_at: 1777852800000
    },
    {
      source_id: 'steam-guide-erenshor',
      reaction_id: 17,
      count: 5,
      icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/17.png?v=5',
      captured_at: 1777852800000
    }
  ];
}
```

Add a test:

```ts
it('returns Steam guide awards sorted by count', async () => {
  const { db } = sourceDetailDb();

  const detail = await getSourceDetail(db, 'steam-guide-erenshor', { since: 500 });

  expect(detail?.steamGuideAwards).toEqual([
    {
      source_id: 'steam-guide-erenshor',
      reaction_id: 17,
      count: 5,
      icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/17.png?v=5',
      captured_at: 1777852800000
    },
    {
      source_id: 'steam-guide-erenshor',
      reaction_id: 27,
      count: 2,
      icon_url: 'https://store.akamai.steamstatic.com/public/images/loyalty/reactions/still/27.png?v=5',
      captured_at: 1777852800000
    }
  ]);
});
```

- [ ] **Step 2: Update metrics test expectations**

In `src/lib/sources/metrics.test.ts`, assert both Steam guide configs include:

```ts
primary: ['views', 'rating', 'ratings', 'comment_count', 'award_count'];
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test src/lib/server/source-detail.test.ts src/lib/sources/metrics.test.ts`

Expected: FAIL because `steamGuideAwards` and guide metrics are not updated yet.

- [ ] **Step 4: Update source metrics**

In `src/lib/sources/metrics.ts`, change both Steam guide configs to:

```ts
'steam-guide-erenshor': { primary: ['views', 'rating', 'ratings', 'comment_count', 'award_count'], sparkline: 'views' },
'steam-guide-ak': { primary: ['views', 'rating', 'ratings', 'comment_count', 'award_count'], sparkline: 'views' },
```

- [ ] **Step 5: Update source detail types and query**

In `src/lib/server/source-detail.ts`:

- import `SteamGuideAward`.
- add `steamGuideAwards: SteamGuideAward[]` to `SourceDetail`.
- add `steamGuideAwards: await steamGuideAwards(db, source.id)` to the returned detail.
- add:

```ts
async function steamGuideAwards(db: D1Database, sourceId: string): Promise<SteamGuideAward[]> {
  if (!sourceId.startsWith('steam-guide-')) return [];
  const result = await db
    .prepare(
      `SELECT source_id, reaction_id, count, icon_url, captured_at
       FROM steam_guide_awards
       WHERE source_id = ? AND count > 0
       ORDER BY count DESC, reaction_id ASC`
    )
    .bind(sourceId)
    .all<SteamGuideAward>();
  return result.results ?? [];
}
```

- [ ] **Step 6: Run source-detail tests to verify they pass**

Run: `pnpm test src/lib/server/source-detail.test.ts src/lib/sources/metrics.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/lib/sources/metrics.ts src/lib/sources/metrics.test.ts src/lib/server/source-detail.ts src/lib/server/source-detail.test.ts
git commit -m "feat(steam): expose guide awards"
```

---

### Task 5: Render Steam awards on detail pages

**Files:**

- Create: `src/lib/components/sources/SteamGuideAwards.svelte`
- Modify: `src/routes/sources/[id]/+page.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/sources/SteamGuideAwards.svelte`:

```svelte
<script lang="ts">
  import type { SteamGuideAward } from '$lib/types/domain';
  import { formatMetricValue } from '$lib/dashboard/format';

  let { awards }: { awards: SteamGuideAward[] } = $props();
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <div class="mb-4 flex items-center justify-between gap-3">
    <h2 class="text-lg font-semibold">Steam awards</h2>
    {#if awards.length > 0}
      <span class="text-sm text-fg-muted">{awards.length} types</span>
    {/if}
  </div>
  {#if awards.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each awards as award (award.reaction_id)}
        <div class="flex items-center gap-2 rounded-lg border border-border bg-bg-primary px-3 py-2">
          <img class="h-8 w-8" src={award.icon_url} alt={`Steam award ${award.reaction_id}`} loading="lazy" />
          <span class="font-semibold">{formatMetricValue(award.count)}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="rounded-lg border border-dashed border-border p-4 text-sm text-fg-muted">No Steam awards captured yet.</p>
  {/if}
</section>
```

- [ ] **Step 2: Render it on source detail pages**

In `src/routes/sources/[id]/+page.svelte`:

- import `SteamGuideAwards`.
- replace the right column with a nested stack:

```svelte
<div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
  <EventsFeed sourceId={data.detail.source.id} events={data.detail.events} />
  <div class="space-y-4">
    {#if data.detail.source.id.startsWith('steam-guide-')}
      <SteamGuideAwards awards={data.detail.steamGuideAwards} />
    {/if}
    <LinkedPosts posts={data.detail.linkedPosts} />
  </div>
</div>
```

- [ ] **Step 3: Run Svelte/type checks**

Run: `pnpm check`

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/lib/components/sources/SteamGuideAwards.svelte src/routes/sources/[id]/+page.svelte
git commit -m "feat(steam): show guide awards"
```

---

### Task 6: Final targeted verification

**Files:** all changed implementation files.

- [ ] **Step 1: Run targeted unit tests**

Run:

```bash
pnpm test src/lib/connectors/fetchers/steam-guide.test.ts src/lib/connectors/fetchers/steam-guide-comments.test.ts src/lib/server/orchestration/persist.test.ts src/lib/server/source-detail.test.ts src/lib/sources/metrics.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run Svelte/type validation**

Run: `pnpm check`

Expected: PASS.

- [ ] **Step 3: Check worktree status**

Run: `git status --short`

Expected: no unstaged or uncommitted implementation files.

- [ ] **Step 4: Report completion**

Report changed files, migrations, and verification commands with observed pass/fail status. Do not claim remote deployment; deployment is a separate operator action.
