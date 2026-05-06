export function log(level: 'info' | 'warn' | 'error', message: string, ctx: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level, message, ts: new Date().toISOString(), ...ctx }));
}
