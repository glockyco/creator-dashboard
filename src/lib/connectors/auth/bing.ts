export function withBingKey(url: URL, env: Pick<Env, 'BING_WEBMASTER_API_KEY'>): URL {
  url.searchParams.set('apikey', env.BING_WEBMASTER_API_KEY);
  return url;
}
