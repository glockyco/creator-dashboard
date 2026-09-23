<script lang="ts">
  import { resolve } from '$app/paths';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const timestampFormatter = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const hoursFormatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
  const bytesFormatter = new Intl.NumberFormat('en-GB');

  function relativeTime(timestamp: number): string {
    const elapsedMinutes = Math.max(0, Math.floor((data.now - timestamp) / 60_000));
    if (elapsedMinutes < 1) return 'Just now';
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;

    const elapsedDays = Math.floor(elapsedHours / 24);
    return `${elapsedDays}d ago`;
  }

  function sizeDelta(value: number): string {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${bytesFormatter.format(value)} bytes`;
  }
</script>

<svelte:head><title>{data.title} · Creator Pulse</title></svelte:head>

<section class="space-y-6 pb-6 sm:space-y-7">
  <header class="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
    <h1 class="text-3xl font-semibold tracking-tight text-fg-primary">Activity</h1>
    <p class="text-sm text-fg-muted">
      <span class="font-semibold tabular-nums text-fg-primary">{data.activity.items.length}</span>
      {data.activity.items.length === 1 ? 'event' : 'events'} · Newest first
    </p>
  </header>

  <form
    method="GET"
    class="rounded-xl border border-border bg-bg-secondary p-4 shadow-sm shadow-black/5 sm:p-5"
    aria-labelledby="activity-filters-heading"
  >
    <h2 id="activity-filters-heading" class="mb-4 text-base font-semibold text-fg-primary">Filters</h2>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
      <label class="space-y-2 text-sm">
        <span class="block text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">Type</span>
        <select
          class="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-fg-primary outline-none transition-colors hover:border-glockyco/50 focus-visible:border-glockyco focus-visible:ring-2 focus-visible:ring-glockyco/25"
          name="type"
          value={data.filters.type}
        >
          <option value="all">Reviews and wiki edits</option>
          <option value="review">Steam reviews</option>
          <option value="wiki_edit">Wiki edits</option>
        </select>
      </label>

      <label class="space-y-2 text-sm">
        <span class="block text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">Game or wiki</span>
        <select
          class="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-fg-primary outline-none transition-colors hover:border-glockyco/50 focus-visible:border-glockyco focus-visible:ring-2 focus-visible:ring-glockyco/25"
          name="subject"
          value={data.filters.subject}
        >
          <option value="all">All games and wikis</option>
          {#each data.subjects as subject (subject.id)}
            <option value={subject.id}>{subject.name}</option>
          {/each}
        </select>
      </label>

      <label class="space-y-2 text-sm">
        <span class="block text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">Review sentiment</span>
        <select
          class="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-fg-primary outline-none transition-colors hover:border-glockyco/50 focus-visible:border-glockyco focus-visible:ring-2 focus-visible:ring-glockyco/25"
          name="sentiment"
          value={data.filters.sentiment}
        >
          <option value="all">Positive and negative</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
      </label>

      <label class="space-y-2 text-sm">
        <span class="block text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">Range</span>
        <select
          class="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-fg-primary outline-none transition-colors hover:border-glockyco/50 focus-visible:border-glockyco focus-visible:ring-2 focus-visible:ring-glockyco/25"
          name="range"
          value={data.filters.range}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </label>

      <div class="flex gap-2 sm:col-span-2 xl:col-span-1">
        <button
          class="min-h-11 flex-1 rounded-lg bg-glockyco px-5 py-2 text-sm font-semibold text-bg-primary outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary"
          type="submit">Apply</button
        >
        <a
          class="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-bg-primary px-4 py-2 text-sm font-medium text-fg-muted outline-none transition-colors hover:border-glockyco/50 hover:text-fg-primary focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary"
          href={resolve('/activity')}>Clear</a
        >
      </div>
    </div>
  </form>

  {#if data.activity.items.length === 0}
    <section class="rounded-xl border border-dashed border-border bg-bg-secondary px-5 py-10 text-center">
      <h2 class="text-lg font-semibold text-fg-primary">No activity matches these filters</h2>
      <p class="mt-2 text-sm text-fg-muted">Adjust the filters or clear them to see more activity.</p>
      <a
        class="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-bg-primary px-4 py-2 text-sm font-semibold text-fg-primary outline-none transition-colors hover:border-glockyco/50 focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary"
        href={resolve('/activity')}>Clear all filters</a
      >
    </section>
  {:else}
    <section aria-label="Activity feed">
      <ol class="space-y-3">
        {#each data.activity.items as item (item.id)}
          <li>
            <article class="rounded-xl border border-border bg-bg-secondary px-4 py-4 shadow-sm shadow-black/5 sm:px-5">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span class={`font-semibold ${item.kind === 'wiki_edit' ? 'text-glockyco' : 'text-warning'}`}>
                      {item.kind === 'review' ? 'Steam review' : 'Wiki edit'}
                    </span>
                    <span class="text-border" aria-hidden="true">·</span>
                    <span class="font-medium text-fg-muted">{item.sourceName}</span>
                  </div>
                  <h2 class="mt-2 text-base font-semibold leading-snug text-fg-primary sm:text-lg">{item.title}</h2>
                </div>
                <time
                  class="shrink-0 text-xs tabular-nums text-fg-muted"
                  datetime={new Date(item.ts).toISOString()}
                  title={timestampFormatter.format(new Date(item.ts))}
                >
                  {relativeTime(item.ts)}
                </time>
              </div>

              {#if item.body}
                <p class="activity-excerpt mt-2 whitespace-pre-wrap text-sm leading-6 text-fg-muted">{item.body}</p>
              {/if}

              <footer
                class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-fg-muted sm:text-sm"
              >
                {#if item.sentiment}
                  <span class={`font-semibold ${item.sentiment === 'positive' ? 'text-success' : 'text-danger'}`}>
                    {item.sentiment === 'positive' ? 'Positive review' : 'Negative review'}
                  </span>
                {/if}
                {#if item.author}
                  <span>Edited by <span class="font-medium text-fg-primary">{item.author}</span></span>
                {/if}
                {#if item.playtimeHours != null}
                  <span
                    ><span class="font-medium tabular-nums text-fg-primary"
                      >{hoursFormatter.format(item.playtimeHours)}</span
                    > hours played</span
                  >
                {/if}
                {#if item.netSizeDelta != null}
                  <span
                    >Net change <span class="font-medium tabular-nums text-fg-primary"
                      >{sizeDelta(item.netSizeDelta)}</span
                    ></span
                  >
                {/if}
                {#if item.href && item.hrefLabel}
                  <!-- eslint-disable svelte/no-navigation-without-resolve -- item.href is validated native context -->
                  <a
                    class="ml-auto inline-flex min-h-8 items-center font-semibold text-glockyco outline-none underline decoration-glockyco/30 underline-offset-4 transition-colors hover:decoration-glockyco focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-glockyco"
                    href={item.href}
                  >
                    {item.hrefLabel}<span class="ml-1" aria-hidden="true">↗</span>
                  </a>
                  <!-- eslint-enable svelte/no-navigation-without-resolve -->
                {/if}
              </footer>
            </article>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if data.nextPageHref}
    <nav class="flex justify-center border-t border-border pt-6" aria-label="Activity pages">
      <a
        class="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-bg-secondary px-5 py-2 text-sm font-semibold text-fg-primary outline-none transition-colors hover:border-glockyco/50 hover:text-glockyco focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary sm:w-auto"
        href={resolve(data.nextPageHref as '/activity')}>Next page <span class="ml-2" aria-hidden="true">→</span></a
      >
    </nav>
  {/if}
</section>

<style>
  .activity-excerpt {
    display: -webkit-box;
    overflow: hidden;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }
</style>
