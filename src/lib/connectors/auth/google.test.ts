import { exportPKCS8, generateKeyPair } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGoogleAccessToken, getGoogleOAuthAccessToken, resetGoogleAccessTokenCacheForTests } from './google';

beforeEach(() => {
  vi.unstubAllGlobals();
  resetGoogleAccessTokenCacheForTests();
});

async function envWithServiceAccount(): Promise<Pick<Env, 'GOOGLE_SERVICE_ACCOUNT'>> {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  return {
    GOOGLE_SERVICE_ACCOUNT: JSON.stringify({
      client_email: 'svc@example.iam.gserviceaccount.com',
      private_key: await exportPKCS8(privateKey)
    })
  };
}

describe('getGoogleAccessToken', () => {
  it('signs a service-account JWT, exchanges it, and caches the access token', async () => {
    const env = await envWithServiceAccount();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'ya29.token', expires_in: 3600 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getGoogleAccessToken(env, ['scope-a', 'scope-b'])).resolves.toBe('ya29.token');
    await expect(getGoogleAccessToken(env, ['scope-a', 'scope-b'])).resolves.toBe('ya29.token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][0] as string;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
    expect(String(init.body)).toContain('assertion=');
  });
});

describe('getGoogleOAuthAccessToken', () => {
  it('exchanges a refresh token for an access token and caches the result', async () => {
    const env = { GOOGLE_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'secret-1', GOOGLE_OAUTH_REFRESH_TOKEN: '1//refresh' } as Pick<Env, 'GOOGLE_OAUTH_CLIENT_ID' | 'GOOGLE_OAUTH_CLIENT_SECRET' | 'GOOGLE_OAUTH_REFRESH_TOKEN'>;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'ya29.oauth', expires_in: 3600, token_type: 'Bearer', scope: 'https://www.googleapis.com/auth/webmasters.readonly' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getGoogleOAuthAccessToken(env)).resolves.toBe('ya29.oauth');
    await expect(getGoogleOAuthAccessToken(env)).resolves.toBe('ya29.oauth');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    const body = String(init.body);
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('client_id=client.apps.googleusercontent.com');
    expect(body).toContain('client_secret=secret-1');
    expect(body).toContain('refresh_token=1%2F%2Frefresh');
  });
});
