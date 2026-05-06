import { describe, expect, it, vi } from 'vitest';
import { isPermanentStatus, isRateLimitStatus, isTransientStatus, parseRetryAfter } from './errors';

describe('connector error helpers', () => {
  it('parses numeric Retry-After headers', () => {
    expect(parseRetryAfter(new Headers({ 'Retry-After': '600' }))).toBe(600);
  });

  it('parses date Retry-After headers', () => {
    vi.setSystemTime(new Date('2026-05-04T00:00:00Z'));
    expect(parseRetryAfter(new Headers({ 'Retry-After': 'Mon, 04 May 2026 00:10:00 GMT' }))).toBe(600);
    vi.useRealTimers();
  });

  it('classifies status families', () => {
    expect(isRateLimitStatus(429)).toBe(true);
    expect(isPermanentStatus(401)).toBe(true);
    expect(isPermanentStatus(403)).toBe(true);
    expect(isPermanentStatus(404)).toBe(true);
    expect(isTransientStatus(500)).toBe(true);
    expect(isTransientStatus(599)).toBe(true);
    expect(isTransientStatus(400)).toBe(false);
  });
});
