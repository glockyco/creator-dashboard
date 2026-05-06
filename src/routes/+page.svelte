<script lang="ts">
  let { data } = $props();
</script>

<main class="min-h-screen bg-bg-primary p-6 text-fg-primary">
  <section class="rounded-lg border border-border bg-bg-secondary p-6">
    <p class="text-sm uppercase tracking-wide text-fg-muted">Private dashboard</p>
    <h1 class="mt-2 text-3xl font-semibold">{data.title}</h1>
    <p class="mt-3 text-fg-muted">Foundation deployed. Sources are enabled in later phases.</p>
  </section>
</main>
