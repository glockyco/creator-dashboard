<script lang="ts">
  import SourceTile from "$lib/components/dashboard/SourceTile.svelte";
  import DateRangePicker from "$lib/ui/DateRangePicker.svelte";
  import IdentityTabs from "$lib/ui/IdentityTabs.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const summary = $derived.by(() => {
    const total = data.snapshots.length;
    const attention = data.snapshots.filter(
      (snapshot) =>
        snapshot.status.consecutive_failures > 0 ||
        snapshot.status.last_status === null ||
        snapshot.status.last_status !== "success",
    ).length;
    const healthy = data.snapshots.filter(
      (snapshot) =>
        snapshot.status.last_status === "success" &&
        snapshot.status.consecutive_failures === 0,
    ).length;
    const eventFeeds = data.snapshots.filter(
      (snapshot) => snapshot.source.category === "event_feed",
    ).length;
    const platforms = data.snapshots.filter(
      (snapshot) => snapshot.source.category !== "event_feed",
    ).length;

    return { total, attention, healthy, eventFeeds, platforms };
  });

  const identityLabel = $derived(
    data.identity === "all" ? "Both identities" : data.identity,
  );
</script>

<svelte:head>
  <title>{data.title}</title>
</svelte:head>

<section class="space-y-5">
  <div
    class="overflow-hidden rounded-2xl border border-border bg-bg-secondary/90 shadow-sm shadow-black/5"
  >
    <div
      class="flex flex-col gap-5 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between"
    >
      <div class="min-w-0">
        <p
          class="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-glockyco"
        >
          Live operations
        </p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {data.title}
        </h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
          Attention, freshness, source health, and manual refresh controls for
          the private creator system.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DateRangePicker />
      </div>
    </div>

    <div class="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-5">
      <div class="bg-bg-secondary p-4">
        <p
          class="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-fg-muted"
        >
          Scope
        </p>
        <p class="mt-2 text-xl font-semibold">{identityLabel}</p>
        <p class="mt-1 text-xs text-fg-muted">Current filter</p>
      </div>
      <div class="bg-bg-secondary p-4">
        <p
          class="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-fg-muted"
        >
          Sources
        </p>
        <p class="mt-2 text-xl font-semibold">{summary.total}</p>
        <p class="mt-1 text-xs text-fg-muted">
          {summary.platforms} metric · {summary.eventFeeds} event
        </p>
      </div>
      <div class="bg-bg-secondary p-4">
        <p
          class="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-fg-muted"
        >
          Needs attention
        </p>
        <p
          class={`mt-2 text-xl font-semibold ${summary.attention > 0 ? "text-danger" : "text-success"}`}
        >
          {summary.attention}
        </p>
        <p class="mt-1 text-xs text-fg-muted">Failed or retrying fetchers</p>
      </div>
      <div class="bg-bg-secondary p-4">
        <p
          class="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-fg-muted"
        >
          Healthy
        </p>
        <p class="mt-2 text-xl font-semibold text-success">{summary.healthy}</p>
        <p class="mt-1 text-xs text-fg-muted">Last run succeeded</p>
      </div>
      <div class="bg-bg-secondary p-4 sm:col-span-2 lg:col-span-1">
        <p
          class="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-fg-muted"
        >
          Action model
        </p>
        <p class="mt-2 text-sm font-semibold">
          Scan failures, then refresh stale sources.
        </p>
        <p class="mt-1 text-xs text-fg-muted">
          Manual controls stay on each tile.
        </p>
      </div>
    </div>
  </div>

  <div
    class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <IdentityTabs active={data.identity} url={new URL(data.url)} />
    <p class="text-xs text-fg-muted">{summary.total} visible sources</p>
  </div>

  <div class="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {#each data.snapshots as snapshot (snapshot.source.id)}
      <SourceTile {snapshot} />
    {:else}
      <div
        class="rounded-2xl border border-dashed border-border bg-bg-secondary/80 p-8 text-center text-sm text-fg-muted"
      >
        No dashboard sources match this filter.
      </div>
    {/each}
  </div>
</section>
