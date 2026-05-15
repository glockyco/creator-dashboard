import { spawnSync } from 'node:child_process';

/**
 * Ports we expect dev servers to bind: SvelteKit/Vite dev (5173 with
 * a small overflow range) plus the Wrangler stack — preview-local's
 * worker/jwks/proxy (8788/8790/8791), the e2e wrangler (8789), and bare
 * `wrangler dev` (8787). Node's default --inspect port 9229 is
 * intentionally **not** included because other macOS apps (RemNote's
 * SQLite helper, for example) bind to it; command-name matching catches
 * any debuggers we actually launch.
 */
const DEV_PORTS = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 8787, 8788, 8789, 8790, 8791] as const;

/**
 * Process-name substrings that identify dev workers we own. Matched
 * case-insensitively against `ps -o command`. Kept narrow so we never
 * kill the user's editor, shell, browser tabs, or any unrelated node.
 */
const COMMAND_PATTERNS = [
  'vite dev',
  'vite build --watch',
  'wrangler dev',
  'wrangler/bin/wrangler.js dev',
  'preview-local.ts',
  'e2e-server.ts',
  'workerd',
  'miniflare'
] as const;

type Target = { pid: number; command: string; source: 'port' | 'name'; port?: number };

export type KillDevOptions = { dryRun?: boolean; gracePeriodMs?: number };

export type KillDevResult = { targets: Target[]; signalled: number[]; killed: number[] };

export async function killDev(options: KillDevOptions = {}): Promise<KillDevResult> {
  const dryRun = options.dryRun ?? false;
  const gracePeriodMs = options.gracePeriodMs ?? 750;
  const ownPid = process.pid;
  const targets = new Map<number, Target>();
  for (const port of DEV_PORTS) {
    for (const pid of pidsBoundToPort(port)) {
      if (pid === ownPid || targets.has(pid)) continue;
      targets.set(pid, { pid, command: commandFor(pid), source: 'port', port });
    }
  }
  for (const pattern of COMMAND_PATTERNS) {
    for (const { pid, command } of pidsMatchingCommand(pattern)) {
      if (pid === ownPid || targets.has(pid)) continue;
      targets.set(pid, { pid, command, source: 'name' });
    }
  }
  const sortedTargets = [...targets.values()].sort((a, b) => a.pid - b.pid);
  if (dryRun || sortedTargets.length === 0) return { targets: sortedTargets, signalled: [], killed: [] };

  const signalled = sortedTargets.map((target) => target.pid);
  for (const pid of signalled) safeKill(pid, 'SIGTERM');
  await sleep(gracePeriodMs);
  const killed: number[] = [];
  for (const pid of signalled) {
    if (isAlive(pid)) {
      safeKill(pid, 'SIGKILL');
      killed.push(pid);
    }
  }
  return { targets: sortedTargets, signalled, killed };
}

function pidsBoundToPort(port: number): number[] {
  const result = spawnSync('lsof', ['-nP', '-iTCP:' + port, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  if (result.status !== 0 && !result.stdout) return [];
  return parsePidList(result.stdout);
}

function pidsMatchingCommand(pattern: string): { pid: number; command: string }[] {
  const result = spawnSync('pgrep', ['-fl', pattern], { encoding: 'utf8' });
  if (!result.stdout) return [];
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const space = line.indexOf(' ');
      if (space === -1) return { pid: Number.parseInt(line, 10), command: '' };
      return { pid: Number.parseInt(line.slice(0, space), 10), command: line.slice(space + 1) };
    })
    .filter((entry) => Number.isFinite(entry.pid));
}

function commandFor(pid: number): string {
  const result = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
  return result.stdout.trim();
}

function parsePidList(stdout: string): number[] {
  return stdout
    .split('\n')
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((pid) => Number.isFinite(pid) && pid > 0);
}

function safeKill(pid: number, signal: 'SIGTERM' | 'SIGKILL'): void {
  try {
    process.kill(pid, signal);
  } catch {
    // Process already gone; nothing to do.
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (process.argv[1]?.endsWith('kill-dev.ts')) {
  const dryRun = process.argv.includes('--dry-run');
  void killDev({ dryRun }).then((result) => {
    if (result.targets.length === 0) {
      console.log('No stale dev processes found.');
      return;
    }
    const verb = dryRun ? 'Would terminate' : 'Terminated';
    for (const target of result.targets) {
      const where = target.source === 'port' ? `port ${target.port}` : 'name match';
      const escalated = result.killed.includes(target.pid) ? ' (SIGKILL)' : '';
      console.log(`${verb} pid ${target.pid} via ${where}${escalated}: ${target.command}`);
    }
  });
}
