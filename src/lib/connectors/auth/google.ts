import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import { fetchJson } from '../http.ts';

const ServiceAccount = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1)
});

const TokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive()
});

let cachedSa: { token: string; expiresAt: number; cacheKey: string } | null = null;
let cachedOAuth: { token: string; expiresAt: number } | null = null;

export function resetGoogleAccessTokenCacheForTests(): void {
  cachedSa = null;
  cachedOAuth = null;
}

export async function getGoogleAccessToken(env: Pick<Env, 'GOOGLE_SERVICE_ACCOUNT'>, scopes: string[]): Promise<string> {
  const cacheKey = scopes.slice().sort().join(' ');
  if (cachedSa && cachedSa.cacheKey === cacheKey && Date.now() < cachedSa.expiresAt - 60_000) return cachedSa.token;

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

  cachedSa = { token: response.access_token, expiresAt: Date.now() + response.expires_in * 1000, cacheKey };
  return cachedSa.token;
}

export async function getGoogleOAuthAccessToken(env: Pick<Env, 'GOOGLE_OAUTH_CLIENT_ID' | 'GOOGLE_OAUTH_CLIENT_SECRET' | 'GOOGLE_OAUTH_REFRESH_TOKEN'>): Promise<string> {
  if (cachedOAuth && Date.now() < cachedOAuth.expiresAt - 60_000) return cachedOAuth.token;

  const body = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });

  const response = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    schema: TokenResponse
  });

  cachedOAuth = { token: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 };
  return cachedOAuth.token;
}
