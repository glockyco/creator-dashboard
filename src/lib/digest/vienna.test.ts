import { describe, expect, it } from 'vitest';
import { isViennaDigestHour, viennaDateKey } from './vienna';

describe('Vienna digest time helpers', () => {
  it('formats the Vienna local date key across winter and summer offsets', () => {
    expect(viennaDateKey(new Date('2026-01-15T23:30:00.000Z'))).toBe('2026-01-16');
    expect(viennaDateKey(new Date('2026-07-15T22:30:00.000Z'))).toBe('2026-07-16');
  });

  it('only allows the digest during the Vienna 06:00 local hour', () => {
    expect(isViennaDigestHour(new Date('2026-01-15T05:00:00.000Z'))).toBe(true);
    expect(isViennaDigestHour(new Date('2026-07-15T04:00:00.000Z'))).toBe(true);
    expect(isViennaDigestHour(new Date('2026-01-15T04:59:59.000Z'))).toBe(false);
    expect(isViennaDigestHour(new Date('2026-07-15T05:00:00.000Z'))).toBe(false);
  });
});
