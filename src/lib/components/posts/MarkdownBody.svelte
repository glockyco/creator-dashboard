<script lang="ts">
  let { body }: { body: string } = $props();
  const paragraphs = $derived(
    body
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
  );
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <div class="space-y-4 leading-7 text-fg-primary">
    {#each paragraphs as paragraph, i (i)}
      <p>{paragraph}</p>
    {:else}
      <p class="text-fg-muted">No post body available.</p>
    {/each}
  </div>
</section>
