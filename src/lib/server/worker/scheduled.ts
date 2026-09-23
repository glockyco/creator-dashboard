import { dispatchDueSources } from '$lib/server/orchestration/dispatcher';

export async function scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
  if (controller.cron === '0 * * * *') {
    await dispatchDueSources(env, Date.now());
  }
}
