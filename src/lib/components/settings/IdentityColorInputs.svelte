<script lang="ts">
  import type { SettingsStore } from '$lib/settings/store.svelte';

  let { store }: { store: SettingsStore } = $props();

  function setColor(identity: 'glockyco' | 'WoW_Much', value: string) {
    store.set({
      ...store.current,
      identityColors: { ...store.current.identityColors, [identity]: value }
    });
  }
</script>

<fieldset class="space-y-3">
  <legend class="text-sm font-semibold text-fg-primary">Identity colors</legend>
  <div class="grid gap-4 sm:grid-cols-2">
    <label class="space-y-2 text-sm">
      <span class="block text-fg-muted">glockyco</span>
      <input
        class="h-11 w-full rounded-lg border border-border bg-bg-primary px-2"
        type="color"
        value={store.current.identityColors.glockyco}
        oninput={(event) => setColor('glockyco', event.currentTarget.value)}
      />
    </label>
    <label class="space-y-2 text-sm">
      <span class="block text-fg-muted">WoW_Much</span>
      <input
        class="h-11 w-full rounded-lg border border-border bg-bg-primary px-2"
        type="color"
        value={store.current.identityColors.WoW_Much}
        oninput={(event) => setColor('WoW_Much', event.currentTarget.value)}
      />
    </label>
  </div>
</fieldset>
