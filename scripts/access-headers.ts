import { readFile } from 'node:fs/promises';
import { accessHeaders as accessJwtHeaders } from '../e2e/support/access-auth.ts';
import { parseDevVars } from './deploy-preflight.ts';

export type AccessHeadersEnv = Record<string, string | undefined>;

/**
 * Smoke scripts (`verify-deploy`, `smoke-cron`, `smoke-ingest`) need to talk to
 * Access-protected Workers. There are two distinct auth paths:
 *
 *  1. Cloudflare Access service token — for remote Workers (production /
 *     preview deployed under a real Access app). Headers are
 *     `CF-Access-Client-Id` + `CF-Access-Client-Secret`. CF Access validates
 *     them at the edge and mints a real Access JWT for the Worker.
 *
 *  2. Local-preview JWT — for the loopback Worker spun up by
 *     `pnpm preview:local`. The harness generates an ad-hoc RSA keypair, the
 *     preview Worker is told to trust its JWKS, and the scripts sign a JWT
 *     against that keypair. None of this is valid against a real CF Access
 *     application.
 *
 * `chooseAccessHeaders` picks the right path so the same script works in both
 * contexts and fails loudly (rather than silently 401-ing) in the trap case:
 * a remote URL with no service token configured.
 */

export async function loadEnvWithDevVars(path = '.dev.vars'): Promise<AccessHeadersEnv> {
  try {
    const file = await readFile(path, 'utf8');
    return { ...parseDevVars(file), ...process.env };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { ...process.env };
    throw error;
  }
}

export function isLoopbackBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  } catch {
    return false;
  }
}

export function serviceTokenHeaders(env: AccessHeadersEnv): Record<string, string> | null {
  const id = env.CF_ACCESS_CLIENT_ID;
  const secret = env.CF_ACCESS_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret };
}

export async function chooseAccessHeaders(baseUrl: string, env?: AccessHeadersEnv): Promise<Record<string, string>> {
  const resolved = env ?? (await loadEnvWithDevVars());
  const svc = serviceTokenHeaders(resolved);
  if (svc) return svc;
  if (isLoopbackBaseUrl(baseUrl)) return accessJwtHeaders();
  throw new Error(
    `cannot authenticate to ${baseUrl}: set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (see .dev.vars.example) ` +
      `to verify against a remote Worker, or point --base-url at the local preview to use the JWT fixture.`
  );
}
