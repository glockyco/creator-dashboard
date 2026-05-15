import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { killDev } from './kill-dev.ts';

type Spawned = { pid: number; exited: Promise<void>; close: () => Promise<void> };

const spawned: Spawned[] = [];

afterEach(async () => {
  for (const child of spawned.splice(0)) await child.close();
});

function spawnMarker(): Spawned {
  // A long-running node process whose `ps` command contains the kill-dev
  // marker pattern, so the suite never depends on a real `vite dev` or
  // `wrangler dev` binary being installed.
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{}, 1000); /* vite dev marker */'], {
    stdio: 'ignore'
  });
  // Attach the `exit` listener immediately at spawn so we never miss the
  // event when the process dies between killDev's signal and afterEach.
  const exited = new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
  });
  const close = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {
        // already gone
      }
    }
    await exited;
  };
  const entry: Spawned = { pid: child.pid as number, exited, close };
  spawned.push(entry);
  return entry;
}

describe('killDev', () => {
  it('identifies processes matching the dev command patterns and reports them in dry-run mode', async () => {
    const marker = spawnMarker();
    await wait(150);
    const result = await killDev({ dryRun: true });
    expect(result.targets.map((target) => target.pid)).toContain(marker.pid);
    expect(result.signalled).toEqual([]);
    expect(result.killed).toEqual([]);
  });

  it('terminates matching processes via SIGTERM and reports the kills', async () => {
    const marker = spawnMarker();
    await wait(150);
    const result = await killDev({ gracePeriodMs: 300 });
    expect(result.signalled).toContain(marker.pid);
    await marker.exited;
    expect(processAlive(marker.pid)).toBe(false);
  });

  it('never includes the killDev process itself as a target', async () => {
    const result = await killDev({ dryRun: true });
    expect(result.targets.every((target) => target.pid !== process.pid)).toBe(true);
  });
});

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
