import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import { fetchJson } from '../http';

const ServiceAccount = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1)
});

const TokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive()
});

let cached: { token: string; expiresAt: number; cacheKey: string } | null = null;

export function resetGoogleAccessTokenCacheForTests(): void {
  cached = null;
}

export async function getGoogleAccessToken(env: Pick<Env, 'GOOGLE_SERVICE_ACCOUNT'>, scopes: string[]): Promise<string> {
  const cacheKey = scopes.slice().sort().join(' ');
  if (cached && cached.cacheKey === cacheKey && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const serviceAccount = ServiceAccount.parse(JSON.parse(env.GOOGLE_SERVICE_ACCOUNT));
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: scopes.join(' ') })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });

  const response = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    schema: TokenResponse
  });

  cached = { token: response.access_token, expiresAt: Date.now() + response.expires_in * 1000, cacheKey };
  return cached.token;
}
