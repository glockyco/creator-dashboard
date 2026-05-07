<script lang="ts">
  import type { TimelineData } from '$lib/server/timeline';
  import type { TimelineFilters } from '$lib/timeline/schema';
  import OverlayToggleGroup from './OverlayToggleGroup.svelte';

  let { filters, timeline }: { filters: TimelineFilters; timeline: TimelineData } = $props();
</script>

<form method="GET" class="grid gap-4 rounded-xl border border-border bg-bg-secondary p-5 lg:grid-cols-[repeat(2,minmax(0,10rem))_1fr_auto] lg:items-end">
  <label class="space-y-2 text-sm">
    <span class="block font-medium text-fg-muted">Since</span>
    <input class="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-fg-primary" type="date" name="since" value={filters.since} />
  </label>
  <label class="space-y-2 text-sm">
    <span class="block font-medium text-fg-muted">Until</span>
    <input class="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-fg-primary" type="date" name="until" value={filters.until} />
  </label>
  <label class="space-y-2 text-sm">
    <span class="block font-medium text-fg-muted">Sources</span>
    <input class="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-fg-primary" name="sources" value={filters.sourceIds.join(',')} aria-describedby="timeline-sources-help" />
    <span id="timeline-sources-help" class="block text-xs text-fg-muted">Comma-separated source IDs. Showing {timeline.sources.length} selected.</span>
  </label>
  <div class="space-y-4">
    <OverlayToggleGroup overlays={filters.overlays} />
    <button class="min-h-11 w-full rounded-lg bg-fg-primary px-4 py-2 text-sm font-semibold text-bg-primary" type="submit">Apply filters</button>
  </div>
</form>
