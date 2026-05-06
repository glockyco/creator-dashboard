<script lang="ts">
  import type { TileSnapshot } from '$lib/dashboard/types';
  import PlatformTileBody from './PlatformTileBody.svelte';

  let { snapshot }: { snapshot: TileSnapshot } = $props();
</script>

<PlatformTileBody {snapshot} />
