<script lang="ts">
  import type { SettingsStore } from '$lib/settings/store.svelte';

  let { store }: { store: SettingsStore } = $props();

  function setTheme(theme: 'dark' | 'light' | 'system') {
    store.set({ ...store.current, theme });
  }

  const themes = ['dark', 'light', 'system'] as const;
</script>

<fieldset class="space-y-3">
  <legend class="text-sm font-semibold text-fg-primary">Theme</legend>
  <div class="grid gap-2 sm:grid-cols-3">
    {#each themes as theme (theme)}
      <button
        type="button"
        class={`min-h-11 rounded-lg border px-4 py-3 text-left text-sm capitalize ${store.current.theme === theme ? 'border-glockyco bg-bg-primary text-fg-primary' : 'border-border text-fg-muted hover:bg-bg-primary hover:text-fg-primary'}`}
        aria-pressed={store.current.theme === theme}
        onclick={() => setTheme(theme)}
      >
        {theme}
      </button>
    {/each}
  </div>
</fieldset>
