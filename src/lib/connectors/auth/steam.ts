export function withSteamKey(url: URL, env: Pick<Env, 'STEAM_WEB_API_KEY'>): URL {
  url.searchParams.set('key', env.STEAM_WEB_API_KEY);
  return url;
}
