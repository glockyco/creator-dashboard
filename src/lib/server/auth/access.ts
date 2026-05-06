import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export class AuthError extends Error {
  status = 401;
}

export type AccessUser = {
  email: string | null;
  claims: Record<string, unknown>;
};

export async function assertAccessJwt(request: Request, env: Pick<Env, 'ACCESS_TEAM_DOMAIN' | 'ACCESS_AUD'>): Promise<AccessUser> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new AuthError('missing Access JWT');

  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  let jwks = jwksByDomain.get(env.ACCESS_TEAM_DOMAIN);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksByDomain.set(env.ACCESS_TEAM_DOMAIN, jwks);
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ACCESS_AUD
    });
    return { email: typeof payload.email === 'string' ? payload.email : null, claims: payload as Record<string, unknown> };
  } catch (cause) {
    throw new AuthError('invalid Access JWT', { cause });
  }
}
