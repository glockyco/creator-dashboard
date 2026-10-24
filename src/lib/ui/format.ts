export const guideSignals = [
  { key: 'favorites', label: 'Favorites', percent: false },
  { key: 'approval', label: 'Approval', percent: true },
  { key: 'votes', label: 'Votes', percent: false },
  { key: 'awards', label: 'Awards', percent: false }
] as const;

const countFormatter = new Intl.NumberFormat();

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

/** The change as displayed: a ratio rounds to 0.1 percentage points first, so its sign and tone match the text. */
export function displayedChange(value: number | null, percent: boolean): number | null {
  if (value === null) return null;
  return percent ? Math.round(value * 1000) / 10 : value;
}

export function formatValue(value: number | null, percent: boolean): string {
  if (value === null) return 'Unavailable';
  return percent ? `${(value * 100).toFixed(1)}%` : formatCount(value);
}

export function formatChange(value: number | null, percent: boolean): string {
  const shown = displayedChange(value, percent);
  if (shown === null) return 'Unavailable';
  return `${shown > 0 ? '+' : ''}${percent ? `${shown.toFixed(1)} pp` : formatCount(shown)}`;
}

export function changeTone(value: number | null, percent = false): string {
  const shown = displayedChange(value, percent);
  return shown === null || shown === 0 ? 'text-fg-muted' : shown < 0 ? 'text-danger' : 'text-success';
}
