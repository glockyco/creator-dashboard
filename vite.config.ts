import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({ config: 'wrangler.toml' })
    })
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // The adapter's `cloudflare:workers` only works inside a dev or preview server.
    alias: {
      'cloudflare:workers': fileURLToPath(new URL('./src/lib/server/test-cloudflare-workers.ts', import.meta.url))
    }
  }
});
