export const cfHeaders = (env: Pick<Env, 'CF_API_TOKEN'>) => ({
  Authorization: `Bearer ${env.CF_API_TOKEN}`,
  'Content-Type': 'application/json'
});
