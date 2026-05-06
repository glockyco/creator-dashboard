import { rename, writeFile } from 'node:fs/promises';

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
console.log(`wrote ${out}`);
