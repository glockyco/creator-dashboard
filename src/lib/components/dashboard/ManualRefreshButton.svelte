<script lang="ts">
  import type { FetcherStatus } from '$lib/dashboard/types';

  let { sourceId, onStatus }: { sourceId: string; onStatus?: (status: FetcherStatus) => void } = $props();
  let busy = $state(false);
  let message = $state<string | null>(null);

  async function refresh() {
    busy = true;
    message = null;
    try {
      const response = await fetch(`/api/refresh/${sourceId}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (!response.ok) throw new Error(`refresh failed: ${response.status}`);
      await pollStatus();
      message = 'Refresh queued';
    } catch (error) {
      message = error instanceof Error ? error.message : 'Refresh failed';
    } finally {
      busy = false;
    }
  }

  async function pollStatus() {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const response = await fetch(`/api/sources/${sourceId}/status`, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (response.ok) onStatus?.((await response.json()) as FetcherStatus);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
</script>

<div class="flex items-center gap-2">
  <button class="min-h-11 rounded-full border border-border px-4 py-2 text-xs font-medium text-fg-muted hover:bg-bg-primary hover:text-fg-primary disabled:opacity-50" type="button" disabled={busy} onclick={refresh}>
    {busy ? 'Refreshing…' : 'Refresh'}
  </button>
  {#if message}<span class="text-xs text-fg-muted">{message}</span>{/if}
</div>
