import { describe, it, expect } from 'vitest';
import { chooseTickInterval } from '../../src/utils.js';

const M = 60 * 1000;
const H = 60 * M;
const D = 24 * H;

describe('chooseTickInterval', () => {
  it('returns a sensible interval for 90 minutes', () => {
    const t = chooseTickInterval(90 * M);
    const ticks = Math.floor(90 * M / t);
    expect(ticks).toBeGreaterThanOrEqual(4);
    expect(ticks).toBeLessThanOrEqual(10);
  });

  it('returns a sensible interval for 24h', () => {
    const t = chooseTickInterval(24 * H);
    const ticks = Math.floor(24 * H / t);
    expect(ticks).toBeGreaterThanOrEqual(4);
    expect(ticks).toBeLessThanOrEqual(10);
  });

  it('returns a sensible interval for 7 days', () => {
    const t = chooseTickInterval(7 * D);
    const ticks = Math.floor(7 * D / t);
    expect(ticks).toBeGreaterThanOrEqual(4);
    expect(ticks).toBeLessThanOrEqual(10);
  });

  it('returns a sensible interval for 1 hour', () => {
    const t = chooseTickInterval(H);
    const ticks = Math.floor(H / t);
    expect(ticks).toBeGreaterThanOrEqual(4);
    expect(ticks).toBeLessThanOrEqual(10);
  });

  it('always returns a positive interval', () => {
    [30 * M, 3 * H, 48 * H, 14 * D].forEach(d => {
      expect(chooseTickInterval(d)).toBeGreaterThan(0);
    });
  });
});
