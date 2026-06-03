export const githubHeaders = (env: Pick<Env, 'GITHUB_TOKEN'>) => ({
  Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'creator-dashboard/1.0'
});
