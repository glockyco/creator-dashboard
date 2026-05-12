const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/**
 * Render a metric value for display. Integers render with thousands separators;
 * floats round to at most two decimals. Trailing zeros are dropped so 4.10 → 4.1.
 */
export function formatMetricValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? integerFormatter.format(value) : decimalFormatter.format(value);
}

/**
 * Render a metric delta with an explicit sign. `null`/`undefined`/non-finite → '—'.
 * Zero renders as '0' without a sign.
 */
export function formatMetricDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const rounded = Number.isInteger(value) ? integerFormatter.format(value) : decimalFormatter.format(value);
  if (value > 0) return `+${rounded}`;
  return rounded;
}
