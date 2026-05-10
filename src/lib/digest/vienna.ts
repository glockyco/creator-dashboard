const VIENNA_TIME_ZONE = 'Europe/Vienna';

export function viennaDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VIENNA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!year || !month || !day) throw new Error('failed to format Vienna date');
  return `${year}-${month}-${day}`;
}

export function isViennaDigestHour(now: Date): boolean {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: VIENNA_TIME_ZONE,
    hour: '2-digit',
    hour12: false
  }).format(now);
  return hour === '06';
}
