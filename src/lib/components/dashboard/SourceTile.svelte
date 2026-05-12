<script lang="ts">
  import type { FetcherStatus, TileSnapshot } from "$lib/dashboard/types";
  import AnalyticsTileBody from "./AnalyticsTileBody.svelte";
  import EventFeedTileBody from "./EventFeedTileBody.svelte";
  import ManualRefreshButton from "./ManualRefreshButton.svelte";
  import PlatformTileBody from "./PlatformTileBody.svelte";

  let { snapshot }: { snapshot: TileSnapshot } = $props();
  let latestStatus = $state<FetcherStatus | null>(null);
  const status = $derived(latestStatus ?? snapshot.status);

  const tone = $derived(
    status.last_status === "success"
      ? "success"
      : status.last_status === "permanent_failure"
        ? "danger"
        : status.last_status === "transient_failure" ||
            status.last_status === "rate_limited_failure"
          ? "warning"
          : "muted",
  );
  const hasProblem = $derived(tone === "danger" || tone === "warning");
  const statusLabel = $derived(
    status.last_status ? status.last_status.replaceAll("_", " ") : "not run",
  );

  function updateStatus(next: FetcherStatus) {
    latestStatus = next;
  }
</script>

<article
  class={`group min-w-0 rounded-2xl border bg-bg-secondary/90 p-4 shadow-sm shadow-black/5 transition hover:border-fg-muted hover:shadow-md sm:p-5 ${hasProblem ? "border-danger/40" : "border-border"}`}
  data-source-id={snapshot.source.id}
>
  <div class="mb-5 flex items-start justify-between gap-3">
    <h2
      class="min-w-0 truncate text-lg font-semibold tracking-tight text-fg-primary"
    >
      <a
        class="rounded-sm outline-none hover:text-glockyco focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary"
        href={`/sources/${snapshot.source.id}`}>{snapshot.source.name}</a
      >
    </h2>
    <ManualRefreshButton
      sourceId={snapshot.source.id}
      {tone}
      {statusLabel}
      onStatus={updateStatus}
    />
  </div>

  {#if status.consecutive_failures > 0 || status.last_error}
    <div
      class="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {status.consecutive_failures} consecutive {status.consecutive_failures ===
      1
        ? "failure"
        : "failures"}{status.last_error ? ` · ${status.last_error}` : ""}
    </div>
  {/if}

  {#if snapshot.source.category === "analytics"}
    <AnalyticsTileBody {snapshot} />
  {:else if snapshot.source.category === "event_feed"}
    <EventFeedTileBody {snapshot} />
  {:else}
    <PlatformTileBody {snapshot} />
  {/if}
</article>
