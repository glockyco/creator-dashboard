import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = '.svelte-kit/cloudflare/worker.js';
const content = `import svelteWorker from './_worker.js';

export default {
  fetch(request, env, ctx) {
    return svelteWorker.fetch(request, env, ctx);
  }
};
`;

await mkdir(dirname(out), { recursive: true });
await writeFile(out, content);
console.log(`wrote ${out}`);
