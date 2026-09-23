import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

const mocks = vi.hoisted(() => ({
  claimManualRetry: vi.fn(),
  releaseManualRetry: vi.fn()
}));

vi.mock('$lib/sources/registry', () => ({
  getSource: (sourceId: string) => (sourceId === 'source-a' ? { id: 'source-a' } : undefined)
}));
vi.mock('$lib/server/incidents', () => ({
  claimManualRetry: mocks.claimManualRetry,
  releaseManualRetry: mocks.releaseManualRetry
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimManualRetry.mockResolvedValue(true);
  mocks.releaseManualRetry.mockResolvedValue(undefined);
});

function request(incidentId: unknown): Request {
  return new Request('https://dashboard.glockyco.com/api/refresh/source-a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ incidentId })
  });
}

function platform(
  send = vi.fn().mockResolvedValue(undefined),
  incident = { source_id: 'source-a', resolved_at: null }
) {
  const first = vi.fn().mockResolvedValue(incident);
  const prepare = vi.fn(() => ({ bind: vi.fn(() => ({ first })) }));
  return { env: { DB: { prepare }, FETCHER_QUEUE: { send } } };
}

describe('POST /api/refresh/[source_id]', () => {
  it('returns 404 for unknown collectors', async () => {
    await expect(
      POST({ params: { source_id: 'missing' }, platform: platform(), request: request(1) } as never)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('requires a stable incident ID', async () => {
    await expect(
      POST({ params: { source_id: 'source-a' }, platform: platform(), request: request('bad') } as never)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('claims the active incident before queueing a forced refresh', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const pagePlatform = platform(send);

    const response = await POST({
      params: { source_id: 'source-a' },
      platform: pagePlatform,
      request: request(23)
    } as never);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ queued: true, incidentId: 23 });
    expect(mocks.claimManualRetry).toHaveBeenCalledWith(pagePlatform.env.DB, 23, 'source-a', expect.any(Number));
    expect(send).toHaveBeenCalledWith({ source_id: 'source-a', dispatch_ts: expect.any(Number), force: true });
  });

  it('rejects a duplicate retry without adding queue work', async () => {
    mocks.claimManualRetry.mockResolvedValueOnce(false);
    const send = vi.fn();

    await expect(
      POST({ params: { source_id: 'source-a' }, platform: platform(send), request: request(23) } as never)
    ).rejects.toMatchObject({ status: 409 });

    expect(send).not.toHaveBeenCalled();
  });

  it('releases the claim if queue delivery fails', async () => {
    const send = vi.fn().mockRejectedValue(new Error('queue unavailable'));

    await expect(
      POST({ params: { source_id: 'source-a' }, platform: platform(send), request: request(23) } as never)
    ).rejects.toMatchObject({ status: 503 });

    expect(mocks.releaseManualRetry).toHaveBeenCalledWith(expect.anything(), 23, expect.any(Number));
  });
});
