import { describe, it, expect } from 'vitest';
import { colorAt } from '../../src/utils.js';

const NOW = new Date('2026-03-28T10:00:00Z').getTime();
const H = 60 * 60 * 1000;

const groups = [
  { entities: ['calendar.a'], color: '#aaaa00' },
  { entities: ['calendar.b'], color: '#0000bb' },
  { entities: ['calendar.c', 'calendar.d'], color: '#00cc00' },
];

describe('colorAt', () => {
  it('returns default_color when no events', () => {
    const evs = { 'calendar.a': [], 'calendar.b': [], 'calendar.c': [], 'calendar.d': [] };
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#gray');
  });

  it('returns color of group whose entity has active event', () => {
    const evs = {
      'calendar.a': [{ start: NOW - H, end: NOW + H }],
      'calendar.b': [],
    };
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#aaaa00');
  });

  it('first group wins on overlap', () => {
    const evs = {
      'calendar.a': [{ start: NOW - H, end: NOW + H }],
      'calendar.b': [{ start: NOW - H, end: NOW + H }],
    };
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#aaaa00');
  });

  it('falls through to second group when first has no active event', () => {
    const evs = {
      'calendar.a': [],
      'calendar.b': [{ start: NOW - H, end: NOW + H }],
    };
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#0000bb');
  });

  it('returns default_color when event is in the past (tsMs >= end)', () => {
    const evs = {
      'calendar.a': [{ start: NOW - 2 * H, end: NOW - H }],
    };
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#gray');
  });

  it('returns default_color when event has not started yet (tsMs < start)', () => {
    const evs = {
      'calendar.a': [{ start: NOW + H, end: NOW + 2 * H }],
    };
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#gray');
  });

  it('event boundary: active at start, inactive at end', () => {
    const evs = {
      'calendar.a': [{ start: NOW, end: NOW + H }],
    };
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#aaaa00');         // at start → active
    expect(colorAt(NOW + H, groups, evs, '#gray')).toBe('#gray');       // at end → inactive
  });

  it('multi-entity group: active if ANY entity has event', () => {
    const evs = {
      'calendar.c': [],
      'calendar.d': [{ start: NOW - H, end: NOW + H }],
    };
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#00cc00');
  });

  it('multi-entity group: inactive when none of entities have event', () => {
    const evs = {
      'calendar.c': [],
      'calendar.d': [],
    };
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#gray');
  });

  it('handles missing entity in eventsByEntity (treats as no events)', () => {
    const evs = {}; // empty map
    expect(colorAt(NOW, groups, evs, '#gray')).toBe('#gray');
  });
});
