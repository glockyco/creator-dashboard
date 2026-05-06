export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log(JSON.stringify({ level: 'info', message: 'scheduled handler reached', cron: controller.cron, ts: new Date().toISOString() }));
}
