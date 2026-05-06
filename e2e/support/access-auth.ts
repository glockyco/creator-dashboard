import { readFile } from 'node:fs/promises';
import { importJWK, SignJWT, type JWK } from 'jose';

export type AccessTokenOverrides = {
  aud?: string;
  iss?: string;
  exp?: number;
};

type E2EAccessConfig = {
  privateJwk: JWK;
  issuer: string;
  audience: string;
  kid: string;
};

let cachedConfig: E2EAccessConfig | null = null;

export async function accessHeaders(overrides: AccessTokenOverrides = {}): Promise<Record<string, string>> {
  return { 'Cf-Access-Jwt-Assertion': await accessToken(overrides) };
}

export async function accessToken(overrides: AccessTokenOverrides = {}): Promise<string> {
  const config = await loadConfig();
  const privateKey = await importJWK(config.privateJwk, 'RS256');
  return new SignJWT({ email: 'e2e@example.invalid' })
    .setProtectedHeader({ alg: 'RS256', kid: config.kid })
    .setIssuer(overrides.iss ?? config.issuer)
    .setAudience(overrides.aud ?? config.audience)
    .setExpirationTime(overrides.exp ?? Math.floor(Date.now() / 1000) + 300)
    .sign(privateKey);
}

async function loadConfig(): Promise<E2EAccessConfig> {
  cachedConfig ??= JSON.parse(await readFile('.tmp/e2e-access.json', 'utf8')) as E2EAccessConfig;
  return cachedConfig;
}
