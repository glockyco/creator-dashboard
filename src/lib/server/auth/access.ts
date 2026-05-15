import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwksByIssuerAndUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export class AuthError extends Error {
  status = 401;
}

export type AccessUser = {
  email: string | null;
  claims: Record<string, unknown>;
};

type AccessJwtEnv = Pick<Env, 'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUD' | 'ACCESS_JWKS_URL'>;

export function resetAccessJwksCacheForTests(): void {
  jwksByIssuerAndUrl.clear();
}

export async function assertAccessJwt(request: Request, env: AccessJwtEnv): Promise<AccessUser> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new AuthError('missing Access JWT');

  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  const jwksUrl = new URL(env.ACCESS_JWKS_URL || `${issuer}/cdn-cgi/access/certs`);
  const cacheKey = `${issuer}|${jwksUrl.href}`;
  let jwks = jwksByIssuerAndUrl.get(cacheKey);
  if (!jwks) {
    jwks = createRemoteJWKSet(jwksUrl);
    jwksByIssuerAndUrl.set(cacheKey, jwks);
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD
    });
    return {
      email: typeof payload.email === 'string' ? payload.email : null,
      claims: payload as Record<string, unknown>
    };
  } catch (cause) {
    throw new AuthError('invalid Access JWT', { cause });
  }
}
