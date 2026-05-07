<script lang="ts">
  import { browser } from '$app/environment';
  import type { TimelineData } from '$lib/server/timeline';
  import type { TimelineOverlay } from '$lib/timeline/schema';
  import { sourceName } from '$lib/timeline/domain.svelte';

  let { timeline, overlays }: { timeline: TimelineData; overlays: TimelineOverlay[] } = $props();
  let container: HTMLDivElement;
  let renderVersion = 0;

  const metricPoints = $derived(
    timeline.metricSeries.flatMap((series) =>
      series.points.map((point) => ({ date: new Date(point.ts), value: point.value, source_id: series.source_id, metric: series.metric, label: `${sourceName(timeline, series.source_id)} · ${series.metric.replaceAll('_', ' ')}` }))
    )
  );
  const eventMarkers = $derived(overlays.includes('events') ? timeline.events.map((event) => ({ date: new Date(event.ts), title: event.title ?? event.kind })) : []);
  const postMarkers = $derived(overlays.includes('posts') ? timeline.posts.map((post) => ({ date: new Date(post.posted_at), title: post.title })) : []);

  $effect(() => {
    const version = ++renderVersion;
    const points = metricPoints;
    const events = eventMarkers;
    const posts = postMarkers;
    if (!browser || !container) return;
    void renderPlot(version, points, events, posts);
  });

  async function renderPlot(version: number, points: typeof metricPoints, events: typeof eventMarkers, posts: typeof postMarkers) {
    const Plot = await import('@observablehq/plot');
    if (version !== renderVersion || !container) return;
    const width = Math.max(container.clientWidth, 720);
    const plot = Plot.plot({
      width,
      height: 320,
      marginLeft: 56,
      marginRight: 24,
      x: { type: 'utc', label: null },
      y: { grid: true, label: 'value' },
      color: { legend: true },
      marks: [
        Plot.ruleY([0]),
        Plot.lineY(points, { x: 'date', y: 'value', stroke: 'label', strokeWidth: 2 }),
        Plot.ruleX(events, { x: 'date', stroke: 'var(--color-event)', strokeWidth: 1.5 }),
        Plot.ruleX(posts, { x: 'date', stroke: 'var(--color-post)', strokeWidth: 2, strokeDasharray: '3,3' })
      ]
    });
    container.replaceChildren(plot);
  }
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 class="text-lg font-semibold">Metric correlation</h2>
      <p class="text-sm text-fg-muted">Sparkline metrics with event and post markers overlaid by date.</p>
    </div>
    <div class="flex flex-wrap gap-3 text-xs text-fg-muted">
      <span data-testid="timeline-event-marker" class="inline-flex items-center gap-2"><span class="h-4 w-0.5 bg-event"></span>Events ({eventMarkers.length})</span>
      <span data-testid="timeline-post-marker" class="inline-flex items-center gap-2"><span class="h-4 w-0.5 border-l-2 border-dashed border-post"></span>Posts ({postMarkers.length})</span>
    </div>
  </div>
  <div class="overflow-x-auto">
    <div data-testid="timeline-chart" class="min-w-[720px]" bind:this={container} aria-label="Timeline chart"></div>
  </div>
</section>
