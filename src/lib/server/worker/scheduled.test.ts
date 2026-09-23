import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduled } from './scheduled';

const workerMocks = vi.hoisted(() => ({ dispatchDueSources: vi.fn() }));

vi.mock('$lib/server/orchestration/dispatcher', () => ({
  dispatchDueSources: workerMocks.dispatchDueSources
}));

function controller(cron: string): ScheduledController {
  return {
    cron,
    scheduledTime: 1_778_400_000_000,
    type: 'scheduled',
    noRetry: vi.fn()
  } as unknown as ScheduledController;
}

const env = {} as Env;
const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;

beforeEach(() => {
  workerMocks.dispatchDueSources.mockReset();
});
describe('scheduled worker handler', () => {
  it('dispatches hourly fetch jobs on the hourly cron', async () => {
    await scheduled(controller('0 * * * *'), env, ctx);

    expect(workerMocks.dispatchDueSources).toHaveBeenCalledOnce();
  });

  it('ignores schedules other than the hourly collector cron', async () => {
    await scheduled(controller('0 4,5 * * *'), env, ctx);

    expect(workerMocks.dispatchDueSources).not.toHaveBeenCalled();
  });
});
