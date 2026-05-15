import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertAccessJwt, resetAccessJwksCacheForTests } from './access';

const env = { ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', ACCESS_AUD: 'aud-test' } as Pick<
  Env,
  'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUD' | 'ACCESS_JWKS_URL'
>;

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let jwksBody: string;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  jwksBody = JSON.stringify({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] });
});

beforeEach(() => {
  resetAccessJwksCacheForTests();
  vi.unstubAllGlobals();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(jwksBody)));
});

async function signedToken(overrides: { aud?: string; iss?: string; exp?: number } = {}) {
  return new SignJWT({ email: 'johann@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(overrides.iss ?? 'https://team.cloudflareaccess.com')
    .setAudience(overrides.aud ?? 'aud-test')
    .setExpirationTime(overrides.exp ?? Math.floor(Date.now() / 1000) + 300)
    .sign(privateKey);
}

describe('assertAccessJwt', () => {
  it('accepts a valid Access JWT', async () => {
    const token = await signedToken();
    const request = new Request('https://dashboard.glockyco.com/', { headers: { 'Cf-Access-Jwt-Assertion': token } });

    await expect(assertAccessJwt(request, env)).resolves.toMatchObject({ email: 'johann@example.com' });
  });

  it('rejects missing, expired, wrong audience, wrong issuer, and malformed tokens', async () => {
    await expect(assertAccessJwt(new Request('https://dashboard.glockyco.com/'), env)).rejects.toMatchObject({
      status: 401
    });
    await expect(
      assertAccessJwt(
        new Request('https://dashboard.glockyco.com/', {
          headers: { 'Cf-Access-Jwt-Assertion': await signedToken({ exp: 1 }) }
        }),
        env
      )
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      assertAccessJwt(
        new Request('https://dashboard.glockyco.com/', {
          headers: { 'Cf-Access-Jwt-Assertion': await signedToken({ aud: 'wrong' }) }
        }),
        env
      )
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      assertAccessJwt(
        new Request('https://dashboard.glockyco.com/', {
          headers: { 'Cf-Access-Jwt-Assertion': await signedToken({ iss: 'https://evil.example' }) }
        }),
        env
      )
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      assertAccessJwt(
        new Request('https://dashboard.glockyco.com/', { headers: { 'Cf-Access-Jwt-Assertion': 'not-a-jwt' } }),
        env
      )
    ).rejects.toMatchObject({ status: 401 });
  });

  it('uses an explicit JWKS URL without changing issuer validation', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(jwksBody)));
    vi.stubGlobal('fetch', fetchMock);

    const token = await signedToken();
    const request = new Request('https://dashboard.glockyco.com/', { headers: { 'Cf-Access-Jwt-Assertion': token } });

    await expect(
      assertAccessJwt(request, { ...env, ACCESS_JWKS_URL: 'http://127.0.0.1:9000/jwks' })
    ).resolves.toMatchObject({ email: 'johann@example.com' });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9000/jwks', expect.anything());
  });

  it('caches JWKS by issuer and JWKS URL', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(jwksBody)));
    vi.stubGlobal('fetch', fetchMock);
    const token = await signedToken();
    const request = new Request('https://dashboard.glockyco.com/', { headers: { 'Cf-Access-Jwt-Assertion': token } });

    await assertAccessJwt(request, { ...env, ACCESS_JWKS_URL: 'http://127.0.0.1:9000/a' });
    await assertAccessJwt(request, { ...env, ACCESS_JWKS_URL: 'http://127.0.0.1:9000/b' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
