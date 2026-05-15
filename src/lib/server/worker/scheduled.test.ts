import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduled } from './scheduled';

const workerMocks = vi.hoisted(() => ({ dispatchDueSources: vi.fn(), maybeDailyDigest: vi.fn() }));

vi.mock('$lib/server/orchestration/dispatcher', () => ({
  dispatchDueSources: workerMocks.dispatchDueSources
}));

vi.mock('$lib/digest/send', () => ({
  maybeDailyDigest: workerMocks.maybeDailyDigest
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
  workerMocks.maybeDailyDigest.mockReset();
});
describe('scheduled worker handler', () => {
  it('dispatches hourly fetch jobs on the hourly cron', async () => {
    await scheduled(controller('0 * * * *'), env, ctx);

    expect(workerMocks.dispatchDueSources).toHaveBeenCalledOnce();
    expect(workerMocks.maybeDailyDigest).not.toHaveBeenCalled();
  });

  it('runs the digest handler on the Vienna digest cron', async () => {
    await scheduled(controller('0 4,5 * * *'), env, ctx);

    expect(workerMocks.maybeDailyDigest).toHaveBeenCalledOnce();
    expect(workerMocks.maybeDailyDigest.mock.calls[0][0]).toBe(env);
    expect(workerMocks.maybeDailyDigest.mock.calls[0][1]).toBeInstanceOf(Date);
    expect(workerMocks.dispatchDueSources).not.toHaveBeenCalled();
  });
});
