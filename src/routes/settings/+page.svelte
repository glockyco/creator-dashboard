<script lang="ts">
  import { browser } from '$app/environment';
  import SettingsForm from '$lib/components/settings/SettingsForm.svelte';
  import { createSettingsStore, type SettingsStore } from '$lib/settings/store.svelte';

  let store = $state<SettingsStore | null>(null);

  $effect(() => {
    if (!browser || store) return;
    store = createSettingsStore({ storage: localStorage, root: document.documentElement });
  });
</script>

<svelte:head>
  <title>Settings · Creator Dashboard</title>
</svelte:head>

<section class="mx-auto max-w-3xl space-y-6">
  <div class="rounded-xl border border-border bg-bg-secondary p-5">
    <p class="text-sm uppercase tracking-wide text-fg-muted">Dashboard preferences</p>
    <h1 class="mt-2 text-3xl font-semibold">Settings</h1>
    <p class="mt-2 text-sm text-fg-muted">Client-only preferences are stored in this browser. No D1 table is used for personal display settings.</p>
  </div>

  {#if store}
    <SettingsForm {store} />
  {:else}
    <div class="rounded-xl border border-border bg-bg-secondary p-5 text-sm text-fg-muted">Loading settings...</div>
  {/if}
</section>
