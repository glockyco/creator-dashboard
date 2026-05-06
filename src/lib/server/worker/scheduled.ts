import { dispatchDueSources } from '$lib/server/orchestration/dispatcher';

export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  if (controller.cron === '0 * * * *') {
    await dispatchDueSources(env, Date.now());
  }
}
