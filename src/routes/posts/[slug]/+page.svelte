<script lang="ts">
  import MarkdownBody from '$lib/components/posts/MarkdownBody.svelte';
  import PerformancePanel from '$lib/components/posts/PerformancePanel.svelte';
  import PostHeader from '$lib/components/posts/PostHeader.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.post.title} · Creator Dashboard</title></svelte:head>

<div class="space-y-6">
  <PostHeader post={data.post} />
  <div class="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <MarkdownBody body={data.body} />
    <PerformancePanel performance={data.performance} />
  </div>
</div>
