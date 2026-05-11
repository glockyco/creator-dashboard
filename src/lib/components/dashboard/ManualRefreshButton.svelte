<script lang="ts">
  import type { FetcherStatus } from '$lib/dashboard/types';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';

  type Tone = 'success' | 'warning' | 'danger' | 'muted';

  let {
    sourceId,
    tone = 'muted',
    statusLabel = 'unknown',
    onStatus
  }: {
    sourceId: string;
    tone?: Tone;
    statusLabel?: string;
    onStatus?: (status: FetcherStatus) => void;
  } = $props();

  let busy = $state(false);
  let message = $state<string | null>(null);

  const toneClass = $derived(
    {
      success: 'border-success/40 text-success hover:bg-success/10',
      warning: 'border-warning/40 text-warning hover:bg-warning/10',
      danger: 'border-danger/40 text-danger hover:bg-danger/10',
      muted: 'border-border text-fg-muted hover:bg-bg-primary hover:text-fg-primary'
    }[tone]
  );

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
  <button
    class={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border disabled:opacity-50 ${toneClass}`}
    type="button"
    disabled={busy}
    aria-label={`Refresh (status: ${statusLabel})`}
    title={`Refresh · ${statusLabel}`}
    onclick={refresh}
  >
    <RefreshCw class={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
  </button>
  {#if message}<span class="text-xs text-fg-muted">{message}</span>{/if}
</div>
