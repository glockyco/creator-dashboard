<script lang="ts">
  import type { SettingsStore } from '$lib/settings/store.svelte';
  import type { Settings } from '$lib/settings/schema';

  let { store }: { store: SettingsStore } = $props();

  function setRange(defaultDateRange: Settings['defaultDateRange']) {
    store.set({ ...store.current, defaultDateRange });
  }
</script>

<label class="block space-y-2 text-sm">
  <span class="font-semibold text-fg-primary">Default date range</span>
  <select
    class="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-fg-primary"
    value={store.current.defaultDateRange}
    onchange={(event) => setRange(event.currentTarget.value as Settings['defaultDateRange'])}
  >
    <option value="7d">Last 7 days</option>
    <option value="30d">Last 30 days</option>
    <option value="90d">Last 90 days</option>
  </select>
</label>
