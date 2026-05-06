const required = ['GOOGLE_SERVICE_ACCOUNT', 'GSC_PROPERTIES', 'BING_WEBMASTER_API_KEY', 'BING_PROPERTIES', 'CF_API_TOKEN', 'CF_ANALYTICS_SITE_TAGS'] as const;

export type BackfillEnv = Record<(typeof required)[number], string> & { GA4_PROPERTY_ID?: string };

export function readBackfillEnv(source: NodeJS.ProcessEnv = process.env, options: { includeGa4?: boolean } = {}): BackfillEnv {
  const names = options.includeGa4 ? [...required, 'GA4_PROPERTY_ID'] : [...required];
  const env: Record<string, string> = {};
  for (const name of names) {
    const value = source[name];
    if (!value) throw new Error(`missing required env var ${name}`);
    env[name] = value;
  }
  return env as BackfillEnv;
}
