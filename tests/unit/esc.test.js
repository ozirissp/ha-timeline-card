import { describe, it, expect } from 'vitest';
import { esc } from '../../src/utils.js';

describe('esc', () => {
  it('escapes ampersand', () => expect(esc('a & b')).toBe('a &amp; b'));
  it('escapes less-than', () => expect(esc('<script>')).toBe('&lt;script&gt;'));
  it('escapes double quotes', () => expect(esc('"hello"')).toBe('&quot;hello&quot;'));
  it('returns empty string for null', () => expect(esc(null)).toBe(''));
  it('returns empty string for undefined', () => expect(esc(undefined)).toBe(''));
  it('converts numbers to string', () => expect(esc(42)).toBe('42'));
  it('leaves safe strings untouched', () => expect(esc('hello world')).toBe('hello world'));
});
