export const githubHeaders = (env: Pick<Env, 'GITHUB_PAT'>) => ({
  Authorization: `Bearer ${env.GITHUB_PAT}`,
  'Content-Type': 'application/json',
  'User-Agent': 'creator-dashboard/1.0'
});
