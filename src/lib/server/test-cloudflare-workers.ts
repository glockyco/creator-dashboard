// Unit tests resolve `cloudflare:workers` to this module through the alias in
// vite.config.ts, and each test sets the bindings it needs on `env`.
export const env = {} as Cloudflare.Env;
