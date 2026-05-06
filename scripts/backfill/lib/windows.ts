export type DateWindow = { startDate: string; endDate: string };

export function gscMonthlyWindows(now = Date.now()): DateWindow[] {
  return completeMonthlyWindows(16, now);
}

export function ga4MonthlyWindows(now = Date.now()): DateWindow[] {
  return completeMonthlyWindows(14, now);
}

export function cfDailyWindows(now = Date.now(), months = 6): DateWindow[] {
  const start = addMonths(startOfUtcDay(new Date(now)), -months);
  const end = addDays(startOfUtcDay(new Date(now)), -1);
  const windows: DateWindow[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    windows.push({ startDate: day(cursor), endDate: day(cursor) });
  }
  return windows;
}

export function singleWindow(startDate: string, endDate: string): DateWindow[] {
  return [{ startDate, endDate }];
}

function completeMonthlyWindows(count: number, now: number): DateWindow[] {
  const currentMonth = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1));
  const first = addMonths(currentMonth, -count);
  const windows: DateWindow[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = addMonths(first, index);
    const next = addMonths(start, 1);
    windows.push({ startDate: day(start), endDate: day(addDays(next, -1)) });
  }
  return windows;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}
