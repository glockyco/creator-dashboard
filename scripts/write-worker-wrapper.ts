import { appendFile, rename, writeFile } from 'node:fs/promises';

const out = '.svelte-kit/cloudflare/worker.js';
const svelteWorkerOut = '.svelte-kit/cloudflare/sveltekit-worker.js';

await rename(out, svelteWorkerOut);

const content = `import svelteWorker from './sveltekit-worker.js';
import { scheduled, queue } from '../../src/worker.ts';

export default {
  fetch(request, env, ctx) {
    return svelteWorker.fetch(request, env, ctx);
  },
  scheduled,
  queue
};
`;

await writeFile(out, content);
// The adapter's .assetsignore names `_worker.js`, the Pages entry point. This
// Worker's entry points are `worker.js` (wrangler.toml `main`) and the
// renamed SvelteKit entry, so ignore both, or Workers serves them as files.
await appendFile('.svelte-kit/cloudflare/.assetsignore', '\nworker.js\nsveltekit-worker.js\n');
console.log(`wrote ${out}`);
