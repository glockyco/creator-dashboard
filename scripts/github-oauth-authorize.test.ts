import { describe, expect, it, vi } from 'vitest';
import { parseAuthorizeArgs, pollForToken, requestDeviceCode } from './github-oauth-authorize';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const device = {
  device_code: 'devcode',
  user_code: 'WDJB-MJHT',
  verification_uri: 'https://github.com/login/device',
  expires_in: 900,
  interval: 5
};

describe('parseAuthorizeArgs', () => {
  it('defaults scope to read:user and reads --client-id', () => {
    expect(parseAuthorizeArgs(['--client-id', 'cli_123'], {})).toEqual({
      clientId: 'cli_123',
      scopes: 'read:user'
    });
  });

  it('falls back to GITHUB_OAUTH_CLIENT_ID and honors --scopes', () => {
    expect(parseAuthorizeArgs(['--scopes', 'read:user public_repo'], { GITHUB_OAUTH_CLIENT_ID: 'env_id' })).toEqual({
      clientId: 'env_id',
      scopes: 'read:user public_repo'
    });
  });

  it('throws when no client id is provided', () => {
    expect(() => parseAuthorizeArgs([], {})).toThrow('missing --client-id');
  });

  it('skips a -- separator forwarded by pnpm', () => {
    expect(parseAuthorizeArgs(['--', '--client-id', 'cli_123'], {})).toEqual({
      clientId: 'cli_123',
      scopes: 'read:user'
    });
  });
});

describe('requestDeviceCode', () => {
  it('posts client_id + scope and returns the parsed device code', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(device));
    const result = await requestDeviceCode({ clientId: 'cli_123', scopes: 'read:user' }, fetchImpl);

    expect(result).toEqual(device);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://github.com/login/device/code');
    expect((init as RequestInit).body).toContain('client_id=cli_123');
    expect((init as RequestInit).body).toContain('scope=read%3Auser');
  });

  it('throws when the device code response carries an error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'invalid_client' }));
    await expect(requestDeviceCode({ clientId: 'bad', scopes: 'read:user' }, fetchImpl)).rejects.toThrow(
      'invalid_client'
    );
  });
});

describe('pollForToken', () => {
  const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
  const now = () => 0;

  it('keeps polling on authorization_pending then returns the token', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gho_minted', scope: 'read:user', token_type: 'bearer' }));

    const token = await pollForToken(device, 'cli_123', { fetchImpl, sleep, now });

    expect(token).toEqual({ access_token: 'gho_minted', scope: 'read:user', token_type: 'bearer' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('adopts the returned interval on slow_down', async () => {
    const calls: number[] = [];
    const recordingSleep = vi.fn(async (ms: number) => {
      calls.push(ms);
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'slow_down', interval: 10 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gho_minted', scope: 'read:user' }));

    await pollForToken(device, 'cli_123', { fetchImpl, sleep: recordingSleep, now });

    expect(calls).toEqual([5_000, 10_000]);
  });

  it('throws a clear message on access_denied', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'access_denied' }));
    await expect(pollForToken(device, 'cli_123', { fetchImpl, sleep, now })).rejects.toThrow('denied');
  });

  it('throws on device_flow_disabled', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'device_flow_disabled' }));
    await expect(pollForToken(device, 'cli_123', { fetchImpl, sleep, now })).rejects.toThrow('device flow');
  });

  it('throws when the device code expires before authorization', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'expired_token' }));
    await expect(pollForToken(device, 'cli_123', { fetchImpl, sleep, now })).rejects.toThrow('expired');
  });
});
