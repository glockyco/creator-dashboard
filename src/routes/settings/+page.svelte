<script lang="ts">
  import { browser } from '$app/environment';
  import SettingsForm from '$lib/components/settings/SettingsForm.svelte';
  import { createSettingsStore, type SettingsStore } from '$lib/settings/store.svelte';

  let store = $state<SettingsStore | null>(null);

  $effect(() => {
    if (!browser || store) return;
    store = createSettingsStore({
      storage: localStorage,
      root: document.documentElement
    });
  });
</script>

<svelte:head>
  <title>Settings · Creator Dashboard</title>
</svelte:head>

<section class="space-y-6">
  <div class="rounded-xl border border-border bg-bg-secondary p-5">
    <p class="text-sm uppercase tracking-wide text-fg-muted">Preferences</p>
    <h1 class="mt-2 text-3xl font-semibold">Settings</h1>
    <p class="mt-2 max-w-2xl text-sm text-fg-muted">
      Tune this browser's creator dashboard defaults. These client-only preferences do not write to D1.
    </p>
  </div>

  <section class="space-y-4 rounded-xl border border-border bg-bg-secondary p-5">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Local display controls</p>
      <h2 class="mt-1 text-lg font-semibold">Dashboard preferences</h2>
    </div>

    {#if store}
      <SettingsForm {store} />
    {:else}
      <div class="rounded-lg border border-dashed border-border bg-bg-primary p-6 text-sm text-fg-muted" role="status">
        Loading settings from this browser...
      </div>
    {/if}
  </section>
</section>
