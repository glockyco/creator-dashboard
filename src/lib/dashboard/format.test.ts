import { describe, it, expect } from 'vitest';
import { formatMetricDelta, formatMetricValue } from './format';

describe('formatMetricValue', () => {
  it('renders integers with thousands separators', () => {
    expect(formatMetricValue(0)).toBe('0');
    expect(formatMetricValue(12)).toBe('12');
    expect(formatMetricValue(12_345)).toBe('12,345');
    expect(formatMetricValue(-1_500)).toBe('-1,500');
  });

  it('rounds floats to two decimals and drops trailing zeros', () => {
    expect(formatMetricValue(0.14285714285714285)).toBe('0.14');
    expect(formatMetricValue(4.666666666666667)).toBe('4.67');
    expect(formatMetricValue(4.1)).toBe('4.1');
    expect(formatMetricValue(4.005)).toBe('4.01');
  });

  it('treats integer-valued floats as integers', () => {
    expect(formatMetricValue(7.0)).toBe('7');
  });

  it('returns an em dash for null, undefined, NaN and infinity', () => {
    expect(formatMetricValue(null)).toBe('—');
    expect(formatMetricValue(undefined)).toBe('—');
    expect(formatMetricValue(Number.NaN)).toBe('—');
    expect(formatMetricValue(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatMetricDelta', () => {
  it('prefixes positive deltas with +', () => {
    expect(formatMetricDelta(2)).toBe('+2');
    expect(formatMetricDelta(0.00802568218298555)).toBe('+0.01');
    expect(formatMetricDelta(1234.5)).toBe('+1,234.5');
  });

  it('keeps the native minus sign on negatives', () => {
    expect(formatMetricDelta(-3)).toBe('-3');
    expect(formatMetricDelta(-0.125)).toBe('-0.13');
  });

  it('renders zero without a sign', () => {
    expect(formatMetricDelta(0)).toBe('0');
  });

  it('returns an em dash for null/undefined/NaN', () => {
    expect(formatMetricDelta(null)).toBe('—');
    expect(formatMetricDelta(undefined)).toBe('—');
    expect(formatMetricDelta(Number.NaN)).toBe('—');
  });
});
