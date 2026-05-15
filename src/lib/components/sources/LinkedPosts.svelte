<script lang="ts">
  import type { LinkedPost } from '$lib/server/source-detail';

  let { posts }: { posts: LinkedPost[] } = $props();
</script>

<section class="rounded-xl border border-border bg-bg-secondary p-5">
  <h2 class="mb-4 text-lg font-semibold">Linked posts</h2>
  <div class="space-y-3">
    {#each posts as post}
      <a class="block rounded-lg border border-border bg-bg-primary p-4 hover:border-fg-muted" href={post.url}>
        <div class="text-xs text-fg-muted">{post.platform} · {new Date(post.posted_at).toLocaleDateString()}</div>
        <h3 class="mt-1 font-medium">{post.title}</h3>
        {#if post.body_excerpt}<p class="mt-2 text-sm text-fg-muted">{post.body_excerpt}</p>{/if}
        {#if post.tags.length > 0}<p class="mt-2 text-xs text-fg-muted">{post.tags.join(', ')}</p>{/if}
      </a>
    {:else}
      <p class="rounded-lg border border-dashed border-border p-4 text-sm text-fg-muted">
        No posts linked to this source yet.
      </p>
    {/each}
  </div>
</section>
