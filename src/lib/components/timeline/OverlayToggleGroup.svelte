<script lang="ts">
  import type { TimelineOverlay } from '$lib/timeline/schema';

  let { overlays }: { overlays: TimelineOverlay[] } = $props();
  let selected = $state(new Set<TimelineOverlay>());

  $effect(() => {
    selected = new Set(overlays);
  });

  function toggle(overlay: TimelineOverlay) {
    selected = new Set(selected);
    if (selected.has(overlay)) selected.delete(overlay);
    else selected.add(overlay);
  }

  const value = $derived([...selected].join(','));
</script>

<div class="space-y-2">
  <input type="hidden" name="overlay" {value} />
  <p class="text-xs font-medium uppercase tracking-wide text-fg-muted">Overlays</p>
  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      class="min-h-11 rounded-full border px-4 py-2 text-sm font-medium {selected.has('posts')
        ? 'border-post bg-bg-primary text-fg-primary'
        : 'border-border text-fg-muted'}"
      aria-pressed={selected.has('posts')}
      onclick={() => toggle('posts')}
    >
      Posts
    </button>
    <button
      type="button"
      class="min-h-11 rounded-full border px-4 py-2 text-sm font-medium {selected.has('events')
        ? 'border-event bg-bg-primary text-fg-primary'
        : 'border-border text-fg-muted'}"
      aria-pressed={selected.has('events')}
      onclick={() => toggle('events')}
    >
      Events
    </button>
  </div>
</div>
