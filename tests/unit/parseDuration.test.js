import { describe, it, expect } from 'vitest';
import { parseDuration } from '../../src/utils.js';

const H = 60 * 60 * 1000;
const M = 60 * 1000;
const D = 24 * H;

describe('parseDuration', () => {
  it('returns 24h by default when no value', () => {
    expect(parseDuration(null)).toBe(24 * H);
    expect(parseDuration(undefined)).toBe(24 * H);
    expect(parseDuration('')).toBe(24 * H);
  });

  it('parses hours', () => {
    expect(parseDuration('24h')).toBe(24 * H);
    expect(parseDuration('1h')).toBe(H);
    expect(parseDuration('0.5h')).toBe(0.5 * H);
  });

  it('parses minutes', () => {
    expect(parseDuration('90m')).toBe(90 * M);
    expect(parseDuration('30m')).toBe(30 * M);
  });

  it('parses days', () => {
    expect(parseDuration('7d')).toBe(7 * D);
    expect(parseDuration('1d')).toBe(D);
  });

  it('parses seconds', () => {
    expect(parseDuration('3600s')).toBe(3600 * 1000);
  });

  it('treats bare number as hours (legacy)', () => {
    expect(parseDuration(24)).toBe(24 * H);
    expect(parseDuration(1)).toBe(H);
  });

  it('falls back to 24h for invalid values', () => {
    expect(parseDuration('abc')).toBe(24 * H);
    expect(parseDuration('0h')).toBe(24 * H);
    expect(parseDuration('-5h')).toBe(24 * H);
  });

  it('is case-insensitive', () => {
    expect(parseDuration('24H')).toBe(24 * H);
    expect(parseDuration('7D')).toBe(7 * D);
  });
});
