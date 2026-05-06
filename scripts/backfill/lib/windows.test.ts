import { describe, expect, it } from 'vitest';
import { cfDailyWindows, ga4MonthlyWindows, gscMonthlyWindows, singleWindow } from './windows';

const now = Date.UTC(2026, 4, 15, 12);

describe('gscMonthlyWindows', () => {
  it('returns 16 complete monthly windows ending before the current month', () => {
    const windows = gscMonthlyWindows(now);

    expect(windows).toHaveLength(16);
    expect(windows[0]).toEqual({ startDate: '2025-01-01', endDate: '2025-01-31' });
    expect(windows.at(-1)).toEqual({ startDate: '2026-04-01', endDate: '2026-04-30' });
  });
});

describe('ga4MonthlyWindows', () => {
  it('returns 14 complete monthly windows ending before the current month', () => {
    const windows = ga4MonthlyWindows(now);

    expect(windows).toHaveLength(14);
    expect(windows[0]).toEqual({ startDate: '2025-03-01', endDate: '2025-03-31' });
    expect(windows.at(-1)).toEqual({ startDate: '2026-04-01', endDate: '2026-04-30' });
  });
});

describe('cfDailyWindows', () => {
  it('returns daily windows for the previous six months by default', () => {
    const windows = cfDailyWindows(now);

    expect(windows[0]).toEqual({ startDate: '2025-11-15', endDate: '2025-11-15' });
    expect(windows.at(-1)).toEqual({ startDate: '2026-05-14', endDate: '2026-05-14' });
    expect(windows.length).toBe(181);
  });
});

describe('singleWindow', () => {
  it('wraps upstream-provided ranges without changing dates', () => {
    expect(singleWindow('2025-01-01', '2025-02-01')).toEqual([{ startDate: '2025-01-01', endDate: '2025-02-01' }]);
  });
});
