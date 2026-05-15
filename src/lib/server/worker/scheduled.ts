import { dispatchDueSources } from '$lib/server/orchestration/dispatcher';
import { maybeDailyDigest } from '$lib/digest/send';

export async function scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
  if (controller.cron === '0 * * * *') {
    await dispatchDueSources(env, Date.now());
  }
  if (controller.cron === '0 4,5 * * *') {
    await maybeDailyDigest(env, new Date());
  }
}
