<script lang="ts">
  import DefaultDateRangeSelect from './DefaultDateRangeSelect.svelte';
  import IdentityColorInputs from './IdentityColorInputs.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import { DEFAULT_SETTINGS } from '$lib/settings/schema';
  import type { SettingsStore } from '$lib/settings/store.svelte';

  let { store }: { store: SettingsStore } = $props();
</script>

<form
  class="space-y-6 rounded-xl border border-border bg-bg-secondary p-5"
  onsubmit={(event) => event.preventDefault()}
>
  <ThemeToggle {store} />
  <DefaultDateRangeSelect {store} />
  <IdentityColorInputs {store} />
  <div class="flex justify-end border-t border-border pt-4">
    <button
      class="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-muted hover:bg-bg-primary hover:text-fg-primary"
      type="button"
      onclick={() => store.set(DEFAULT_SETTINGS)}
    >
      Reset to defaults
    </button>
  </div>
</form>
