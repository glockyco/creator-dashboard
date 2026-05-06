<script lang="ts">
  let { data } = $props();
</script>

<main class="min-h-screen bg-bg-primary p-6 text-fg-primary">
  <div class="mx-auto flex max-w-6xl flex-col gap-6">
    <header>
      <p class="text-sm uppercase tracking-wide text-fg-muted">Operations</p>
      <h1 class="text-3xl font-semibold">Health</h1>
    </header>

    <section class="rounded-lg border border-border bg-bg-secondary p-4">
      <h2 class="text-xl font-semibold">Fetcher runs</h2>
      {#if data.runs.length === 0}
        <p class="mt-3 text-fg-muted">No fetcher runs yet.</p>
      {:else}
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-fg-muted">
              <tr><th class="py-2">Source</th><th>Status</th><th>Last run</th><th>Last success</th><th>Failures</th><th>Error</th></tr>
            </thead>
            <tbody>
              {#each data.runs as run}
                <tr class="border-t border-border">
                  <td class="py-2 font-mono">{run.source_id}</td>
                  <td>{run.last_status}</td>
                  <td>{run.last_run_at ?? '—'}</td>
                  <td>{run.last_success_at ?? '—'}</td>
                  <td>{run.consecutive_failures}</td>
                  <td>{run.last_error ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <section class="rounded-lg border border-border bg-bg-secondary p-4">
      <h2 class="text-xl font-semibold">Recent failures</h2>
      {#if data.failures.length === 0}
        <p class="mt-3 text-fg-muted">No recent failures.</p>
      {:else}
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-fg-muted">
              <tr><th class="py-2">Source</th><th>Tier</th><th>Status</th><th>Time</th><th>Error</th></tr>
            </thead>
            <tbody>
              {#each data.failures as failure}
                <tr class="border-t border-border">
                  <td class="py-2 font-mono">{failure.source_id}</td>
                  <td>{failure.tier}</td>
                  <td>{failure.status_code ?? '—'}</td>
                  <td>{failure.ts}</td>
                  <td>{failure.error_message}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <section class="rounded-lg border border-border bg-bg-secondary p-4">
      <h2 class="text-xl font-semibold">Alerts sent</h2>
      {#if data.alerts.length === 0}
        <p class="mt-3 text-fg-muted">No alerts sent yet.</p>
      {:else}
        <div class="mt-3 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-fg-muted">
              <tr><th class="py-2">Alert key</th><th>Sent at</th></tr>
            </thead>
            <tbody>
              {#each data.alerts as alert}
                <tr class="border-t border-border">
                  <td class="py-2 font-mono">{alert.alert_key}</td>
                  <td>{alert.sent_at}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  </div>
</main>
