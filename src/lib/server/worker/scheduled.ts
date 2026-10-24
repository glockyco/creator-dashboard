import { dispatchDueSources } from '$lib/server/orchestration/dispatcher';
import { runWatchdog } from '$lib/server/orchestration/watchdog';
import { log } from '$lib/server/log';

export async function scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
  if (controller.cron === '0 * * * *') {
    const now = Date.now();
    await dispatchDueSources(env, now);
    try {
      await runWatchdog(env, now);
    } catch (error) {
      log('error', 'collection watchdog failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}
