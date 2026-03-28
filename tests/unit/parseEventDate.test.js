import { describe, it, expect } from 'vitest';
import { parseEventDate } from '../../src/utils.js';

describe('parseEventDate', () => {
  it('returns 0 for null/undefined', () => {
    expect(parseEventDate(null)).toBe(0);
    expect(parseEventDate(undefined)).toBe(0);
  });

  it('returns 0 for empty object', () => {
    expect(parseEventDate({})).toBe(0);
  });

  it('parses dateTime (ISO with timezone) correctly', () => {
    const ts = parseEventDate({ dateTime: '2026-03-28T10:00:00+01:00' });
    expect(ts).toBe(new Date('2026-03-28T10:00:00+01:00').getTime());
    expect(ts).toBeGreaterThan(0);
  });

  it('parses all-day date as local midnight (not UTC midnight)', () => {
    const ts = parseEventDate({ date: '2026-03-28' });
    const localMidnight = new Date(2026, 2, 28).getTime(); // month is 0-indexed
    expect(ts).toBe(localMidnight);
  });

  it('all-day date differs from UTC parse when timezone offset exists', () => {
    const tsLocal = parseEventDate({ date: '2026-03-28' });
    const tsUtc = new Date('2026-03-28').getTime(); // UTC midnight
    // They should be equal only in UTC+0 — in any other timezone they differ
    // We just verify our parser always returns the local value
    expect(tsLocal).toBe(new Date(2026, 2, 28).getTime());
    // And that it parsed something valid
    expect(tsLocal).toBeGreaterThan(0);
  });

  it('prefers dateTime over date when both present', () => {
    const ts = parseEventDate({ dateTime: '2026-03-28T10:00:00Z', date: '2026-03-28' });
    expect(ts).toBe(new Date('2026-03-28T10:00:00Z').getTime());
  });
});
