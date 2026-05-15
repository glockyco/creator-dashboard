import { describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

const dispatch = vi.hoisted(() => ({ dispatchDueSources: vi.fn() }));

vi.mock('$lib/server/orchestration/dispatcher', () => ({
  dispatchDueSources: dispatch.dispatchDueSources
}));

describe('POST /api/smoke/hourly', () => {
  it('returns 404 unless smoke endpoints are explicitly enabled', async () => {
    await expect(
      POST({
        platform: { env: { SMOKE_ENDPOINTS_ENABLED: 'false' } },
        request: new Request('http://test/smoke')
      } as never)
    ).rejects.toMatchObject({ status: 404 });
  });

  it('dispatches only the requested source when enabled', async () => {
    dispatch.dispatchDueSources.mockResolvedValue(1);
    const response = await POST({
      platform: { env: { SMOKE_ENDPOINTS_ENABLED: 'true' } },
      request: new Request('http://test/smoke', {
        method: 'POST',
        body: JSON.stringify({ sourceId: 'steam-reviews-erenshor' })
      })
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enqueued: 1 });
    expect(dispatch.dispatchDueSources).toHaveBeenCalledWith({ SMOKE_ENDPOINTS_ENABLED: 'true' }, expect.any(Number), {
      sourceIds: ['steam-reviews-erenshor']
    });
  });
});
