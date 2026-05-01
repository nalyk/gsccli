import { describe, expect, it } from 'vitest';
import { resolveDate } from '../../src/utils/date-helpers.js';

describe('resolveDate', () => {
  it('passes through ISO YYYY-MM-DD', () => {
    expect(resolveDate('2025-04-01')).toBe('2025-04-01');
  });

  it('resolves "today" to a YYYY-MM-DD string', () => {
    expect(resolveDate('today')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolves "yesterday" to a date one day earlier than today', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    expect(resolveDate('yesterday')).toBe(expected);
  });

  it('resolves "NdaysAgo" format', () => {
    const result = resolveDate('7daysAgo');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolves "0daysAgo" to today', () => {
    expect(resolveDate('0daysAgo')).toBe(resolveDate('today'));
  });

  it('passes through unknown input unchanged (caller decides)', () => {
    expect(resolveDate('whatever')).toBe('whatever');
  });
});
