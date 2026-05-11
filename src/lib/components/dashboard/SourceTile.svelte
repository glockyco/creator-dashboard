<script lang="ts">
  import type { FetcherStatus, TileSnapshot } from "$lib/dashboard/types";
  import AnalyticsTileBody from "./AnalyticsTileBody.svelte";
  import EventFeedTileBody from "./EventFeedTileBody.svelte";
  import ManualRefreshButton from "./ManualRefreshButton.svelte";
  import PlatformTileBody from "./PlatformTileBody.svelte";

  let { snapshot }: { snapshot: TileSnapshot } = $props();
  let latestStatus = $state<FetcherStatus | null>(null);
  const status = $derived(latestStatus ?? snapshot.status);

  const sourceTone = $derived(
    snapshot.source.identity === "glockyco"
      ? "bg-glockyco text-white"
      : "bg-wowmuch text-black",
  );
  const hasProblem = $derived(
    status.consecutive_failures > 0 ||
      (status.last_status !== null && status.last_status !== "success"),
  );
  const statusTone = $derived(
    hasProblem
      ? "border-danger/30 bg-danger/10 text-danger"
      : status.last_status === "success"
        ? "border-success/30 bg-success/10 text-success"
        : "border-warning/30 bg-warning/10 text-warning",
  );
  const statusLabel = $derived(
    status.last_status ? status.last_status.replaceAll("_", " ") : "Not run",
  );
  const lastSuccessLabel = $derived(
    formatTimestamp(status.last_success_at, "No success yet"),
  );
  const lastRunLabel = $derived(
    formatTimestamp(status.last_run_at, "Never run"),
  );

  function updateStatus(next: FetcherStatus) {
    latestStatus = next;
  }

  function formatTimestamp(value: number | null, fallback: string) {
    if (value === null) return fallback;
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Vienna",
    }).format(new Date(value));
  }
</script>

<article
  class={`group min-w-0 rounded-2xl border bg-bg-secondary/90 p-4 shadow-sm shadow-black/5 transition hover:-translate-y-0.5 hover:border-fg-muted hover:shadow-md sm:p-5 ${hasProblem ? "border-danger/40" : "border-border"}`}
  data-source-id={snapshot.source.id}
>
  <div class="mb-5 flex flex-col gap-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] ${sourceTone}`}
            >{snapshot.source.identity}</span
          >
          <span
            class="rounded-full border border-border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-fg-muted"
            >{snapshot.source.category.replaceAll("_", " ")}</span
          >
        </div>
        <h2
          class="mt-3 truncate text-lg font-semibold tracking-tight text-fg-primary"
        >
          <a
            class="rounded-sm outline-none hover:text-glockyco focus-visible:ring-2 focus-visible:ring-glockyco focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary"
            href={`/sources/${snapshot.source.id}`}>{snapshot.source.name}</a
          >
        </h2>
      </div>
      <ManualRefreshButton
        sourceId={snapshot.source.id}
        onStatus={updateStatus}
      />
    </div>

    <div class="grid gap-2 text-xs sm:grid-cols-3">
      <div class={`rounded-xl border px-3 py-2 font-medium ${statusTone}`}>
        {statusLabel}
      </div>
      <div
        class="rounded-xl border border-border bg-bg-primary px-3 py-2 text-fg-muted"
      >
        <span class="block text-[0.65rem] uppercase tracking-[0.18em]"
          >Last success</span
        >
        <span class="mt-1 block text-fg-primary">{lastSuccessLabel}</span>
      </div>
      <div
        class="rounded-xl border border-border bg-bg-primary px-3 py-2 text-fg-muted"
      >
        <span class="block text-[0.65rem] uppercase tracking-[0.18em]"
          >Cadence</span
        >
        <span class="mt-1 block text-fg-primary"
          >{snapshot.source.cadenceHours}h · run {lastRunLabel}</span
        >
      </div>
    </div>

    {#if status.consecutive_failures > 0 || status.last_error}
      <div
        class="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
      >
        {status.consecutive_failures} consecutive {status.consecutive_failures ===
        1
          ? "failure"
          : "failures"}{status.last_error ? ` · ${status.last_error}` : ""}
      </div>
    {/if}
  </div>

  {#if snapshot.source.category === "analytics"}
    <AnalyticsTileBody {snapshot} />
  {:else if snapshot.source.category === "event_feed"}
    <EventFeedTileBody {snapshot} />
  {:else}
    <PlatformTileBody {snapshot} />
  {/if}
</article>
