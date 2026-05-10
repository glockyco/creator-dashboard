<script lang="ts">
  import type { IndexedPost } from '$lib/server/posts';

  let { posts }: { posts: IndexedPost[] } = $props();
</script>

<div class="overflow-hidden rounded-xl border border-border bg-bg-secondary">
  <div class="hidden md:block">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-border text-xs uppercase tracking-wide text-fg-muted">
        <tr><th class="px-4 py-3">Post</th><th class="px-4 py-3">Author</th><th class="px-4 py-3">Platform</th><th class="px-4 py-3">Sources</th></tr>
      </thead>
      <tbody class="divide-y divide-border">
        {#each posts as post}
          <tr>
            <td class="px-4 py-3"><a class="font-medium hover:underline" href={`/posts/${post.slug}`}>{post.title}</a><p class="text-xs text-fg-muted">{new Date(post.posted_at).toLocaleDateString()}</p></td>
            <td class="px-4 py-3 text-fg-muted">{post.author}</td>
            <td class="px-4 py-3 text-fg-muted">{post.platform}</td>
            <td class="px-4 py-3 text-fg-muted">{post.related_sources.join(', ') || '—'}</td>
          </tr>
        {:else}
          <tr><td class="px-4 py-8 text-center text-fg-muted" colspan="4">No posts match these filters.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="divide-y divide-border md:hidden">
    {#each posts as post}
      <a class="block min-h-11 p-4" href={`/posts/${post.slug}`}>
        <p class="text-xs text-fg-muted">{post.author} · {post.platform}</p>
        <h2 class="mt-1 font-medium">{post.title}</h2>
        {#if post.body_excerpt}<p class="mt-2 text-sm text-fg-muted">{post.body_excerpt}</p>{/if}
      </a>
    {:else}
      <p class="p-8 text-center text-fg-muted">No posts match these filters.</p>
    {/each}
  </div>
</div>
