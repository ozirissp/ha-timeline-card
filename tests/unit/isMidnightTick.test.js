import { describe, it, expect } from 'vitest';
import { isMidnightTick } from '../../src/utils.js';

describe('isMidnightTick', () => {
  it('returns true for a timestamp at local midnight (00:00:00.000)', () => {
    const midnight = new Date(2025, 3, 1, 0, 0, 0, 0).getTime(); // 1 Apr 2025 00:00
    expect(isMidnightTick(midnight)).toBe(true);
  });

  it('returns false for a timestamp at 01:00', () => {
    const t = new Date(2025, 3, 1, 1, 0, 0, 0).getTime();
    expect(isMidnightTick(t)).toBe(false);
  });

  it('returns false for a timestamp at 23:59', () => {
    const t = new Date(2025, 3, 1, 23, 59, 0, 0).getTime();
    expect(isMidnightTick(t)).toBe(false);
  });

  it('returns false for a timestamp at 00:01', () => {
    const t = new Date(2025, 3, 1, 0, 1, 0, 0).getTime();
    expect(isMidnightTick(t)).toBe(false);
  });

  it('returns false for a timestamp at 12:00', () => {
    const t = new Date(2025, 3, 1, 12, 0, 0, 0).getTime();
    expect(isMidnightTick(t)).toBe(false);
  });

  it('returns true for multiple consecutive midnights', () => {
    [1, 2, 3].forEach(day => {
      const midnight = new Date(2025, 3, day, 0, 0, 0, 0).getTime();
      expect(isMidnightTick(midnight)).toBe(true);
    });
  });
});
