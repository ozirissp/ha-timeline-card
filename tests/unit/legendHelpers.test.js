import { describe, it, expect } from 'vitest';
import { getActiveEvent, getNextEvent, formatLegendSuffix } from '../../src/utils.js';

const H = 60 * 60 * 1000;
const M = 60 * 1000;

// Reference "now": 2026-03-31 10:00:00 UTC
const NOW = new Date('2026-03-31T10:00:00Z').getTime();

// ─── getActiveEvent ────────────────────────────────────────────────────────────

describe('getActiveEvent', () => {
  it('returns null when no entities', () => {
    expect(getActiveEvent(NOW, [], {})).toBeNull();
  });

  it('returns null when entity has no events', () => {
    expect(getActiveEvent(NOW, ['calendar.a'], { 'calendar.a': [] })).toBeNull();
  });

  it('returns null when entity is missing from eventsByEntity', () => {
    expect(getActiveEvent(NOW, ['calendar.a'], {})).toBeNull();
  });

  it('returns the active event when nowMs is within [start, end)', () => {
    const ev = { start: NOW - H, end: NOW + H };
    const result = getActiveEvent(NOW, ['calendar.a'], { 'calendar.a': [ev] });
    expect(result).toEqual(ev);
  });

  it('returns event when nowMs === start (boundary: start is included)', () => {
    const ev = { start: NOW, end: NOW + H };
    const result = getActiveEvent(NOW, ['calendar.a'], { 'calendar.a': [ev] });
    expect(result).toEqual(ev);
  });

  it('returns null when nowMs === end (boundary: end is excluded)', () => {
    const ev = { start: NOW - H, end: NOW };
    const result = getActiveEvent(NOW, ['calendar.a'], { 'calendar.a': [ev] });
    expect(result).toBeNull();
  });

  it('returns null when event is entirely in the past', () => {
    const ev = { start: NOW - 2 * H, end: NOW - H };
    expect(getActiveEvent(NOW, ['calendar.a'], { 'calendar.a': [ev] })).toBeNull();
  });

  it('returns null when event is entirely in the future', () => {
    const ev = { start: NOW + H, end: NOW + 2 * H };
    expect(getActiveEvent(NOW, ['calendar.a'], { 'calendar.a': [ev] })).toBeNull();
  });

  it('returns the first active event when multiple events exist', () => {
    const ev1 = { start: NOW - H, end: NOW + H };
    const ev2 = { start: NOW - 2 * H, end: NOW + 2 * H };
    const result = getActiveEvent(NOW, ['calendar.a'], { 'calendar.a': [ev1, ev2] });
    expect(result).toEqual(ev1);
  });

  it('checks all entities in the group and returns first match', () => {
    const ev = { start: NOW - H, end: NOW + H };
    const result = getActiveEvent(NOW, ['calendar.a', 'calendar.b'], {
      'calendar.a': [],
      'calendar.b': [ev],
    });
    expect(result).toEqual(ev);
  });

  it('returns null when no entity in the group has an active event', () => {
    const result = getActiveEvent(NOW, ['calendar.a', 'calendar.b'], {
      'calendar.a': [{ start: NOW - 2 * H, end: NOW - H }],
      'calendar.b': [{ start: NOW + H, end: NOW + 2 * H }],
    });
    expect(result).toBeNull();
  });
});

// ─── getNextEvent ──────────────────────────────────────────────────────────────

describe('getNextEvent', () => {
  it('returns null when no entities', () => {
    expect(getNextEvent(NOW, [], {})).toBeNull();
  });

  it('returns null when entity has no events', () => {
    expect(getNextEvent(NOW, ['calendar.a'], { 'calendar.a': [] })).toBeNull();
  });

  it('returns null when entity is missing from eventsByEntity', () => {
    expect(getNextEvent(NOW, ['calendar.a'], {})).toBeNull();
  });

  it('returns the upcoming event when start > nowMs', () => {
    const ev = { start: NOW + H, end: NOW + 2 * H };
    const result = getNextEvent(NOW, ['calendar.a'], { 'calendar.a': [ev] });
    expect(result).toEqual(ev);
  });

  it('returns null when event start === nowMs (not future)', () => {
    // An event starting exactly now is "active", not "next"
    const ev = { start: NOW, end: NOW + H };
    const result = getNextEvent(NOW, ['calendar.a'], { 'calendar.a': [ev] });
    expect(result).toBeNull();
  });

  it('returns null when all events are in the past or active', () => {
    const evs = [
      { start: NOW - 2 * H, end: NOW - H },
      { start: NOW - H, end: NOW + H },
    ];
    expect(getNextEvent(NOW, ['calendar.a'], { 'calendar.a': evs })).toBeNull();
  });

  it('returns the nearest future event when multiple exist', () => {
    const closer = { start: NOW + H, end: NOW + 2 * H };
    const farther = { start: NOW + 3 * H, end: NOW + 4 * H };
    const result = getNextEvent(NOW, ['calendar.a'], { 'calendar.a': [farther, closer] });
    expect(result).toEqual(closer);
  });

  it('returns the nearest event across multiple entities', () => {
    const evA = { start: NOW + 3 * H, end: NOW + 4 * H };
    const evB = { start: NOW + H, end: NOW + 2 * H };
    const result = getNextEvent(NOW, ['calendar.a', 'calendar.b'], {
      'calendar.a': [evA],
      'calendar.b': [evB],
    });
    expect(result).toEqual(evB);
  });

  it('ignores active events (start <= nowMs) even if not ended yet', () => {
    const active = { start: NOW - H, end: NOW + 2 * H };
    const next = { start: NOW + 3 * H, end: NOW + 4 * H };
    const result = getNextEvent(NOW, ['calendar.a'], { 'calendar.a': [active, next] });
    expect(result).toEqual(next);
  });
});

// ─── formatLegendSuffix ────────────────────────────────────────────────────────

describe('formatLegendSuffix', () => {
  const group = { entities: ['calendar.a'], color: '#5DCAA5', label: 'HC' };

  it('returns empty string when no event active and no next event', () => {
    const result = formatLegendSuffix(NOW, group, {});
    expect(result).toBe('');
  });

  it('returns " · HH:MM – HH:MM" when an event is currently active', () => {
    // Active event: 12:00 → 14:00
    const start = new Date('2026-03-31T12:00:00Z').getTime();
    const end   = new Date('2026-03-31T14:00:00Z').getTime();
    const evs = { 'calendar.a': [{ start, end }] };

    // Set now to 13:00 (inside the event)
    const nowInside = new Date('2026-03-31T13:00:00Z').getTime();
    const result = formatLegendSuffix(nowInside, group, evs);

    // Should contain the start and end times (HH:MM format)
    expect(result).toMatch(/·/);
    expect(result).toMatch(/–/);
    // Should contain both hour:minute strings (exact values depend on local timezone,
    // so we just verify structure: contains ":" twice)
    const colonCount = (result.match(/:/g) || []).length;
    expect(colonCount).toBe(2);
  });

  it('returns " · → HH:MM (Xh)" when next event is >= 1h away', () => {
    // Next event starts in exactly 1h30
    const nextStart = NOW + 90 * M;
    const nextEnd   = NOW + 3 * H;
    const evs = { 'calendar.a': [{ start: nextStart, end: nextEnd }] };

    const result = formatLegendSuffix(NOW, group, evs);

    expect(result).toMatch(/·/);
    expect(result).toMatch(/→/);
    expect(result).toMatch(/\(/);
    expect(result).toMatch(/\)/);
    // Duration part: 1h30
    expect(result).toContain('1h30');
  });

  it('returns " · → HH:MM (Xhmin)" for exactly 1 hour', () => {
    const nextStart = NOW + H;
    const nextEnd   = NOW + 2 * H;
    const evs = { 'calendar.a': [{ start: nextStart, end: nextEnd }] };

    const result = formatLegendSuffix(NOW, group, evs);

    expect(result).toMatch(/→/);
    expect(result).toContain('1h');
    // Should NOT contain "0" after "h" for "1h00" → just "1h"
    expect(result).not.toContain('1h00');
  });

  it('returns " · → HH:MM (Xmin)" when next event is < 1h away', () => {
    const nextStart = NOW + 45 * M;
    const nextEnd   = NOW + 2 * H;
    const evs = { 'calendar.a': [{ start: nextStart, end: nextEnd }] };

    const result = formatLegendSuffix(NOW, group, evs);

    expect(result).toMatch(/→/);
    expect(result).toContain('45min');
    // Should not contain 'h' in the duration part
    expect(result).not.toMatch(/\d+h/);
  });

  it('prioritises active event over next event (active always shown when present)', () => {
    const active = { start: NOW - H, end: NOW + H };
    const next   = { start: NOW + 2 * H, end: NOW + 3 * H };
    const evs = { 'calendar.a': [active, next] };

    const result = formatLegendSuffix(NOW, group, evs);

    // Should show active bounds, not next arrow
    expect(result).toMatch(/–/);
    expect(result).not.toMatch(/→/);
  });

  it('works with multi-entity group', () => {
    const multiGroup = { entities: ['calendar.a', 'calendar.b'], color: '#f00', label: 'X' };
    const ev = { start: NOW + 30 * M, end: NOW + 2 * H };
    const evs = { 'calendar.a': [], 'calendar.b': [ev] };

    const result = formatLegendSuffix(NOW, multiGroup, evs);

    expect(result).toMatch(/→/);
    expect(result).toContain('30min');
  });

  it('handles exactly 2h duration correctly', () => {
    const nextStart = NOW + 2 * H;
    const nextEnd   = NOW + 4 * H;
    const evs = { 'calendar.a': [{ start: nextStart, end: nextEnd }] };

    const result = formatLegendSuffix(NOW, group, evs);

    expect(result).toContain('2h');
    expect(result).not.toContain('2h00');
  });

  it('handles 1h15 duration correctly', () => {
    const nextStart = NOW + 75 * M;
    const evs = { 'calendar.a': [{ start: nextStart, end: nextStart + H }] };

    const result = formatLegendSuffix(NOW, group, evs);

    expect(result).toContain('1h15');
  });

  it('returns empty string for group with no entities', () => {
    const emptyGroup = { entities: [], color: '#aaa', label: 'Empty' };
    expect(formatLegendSuffix(NOW, emptyGroup, {})).toBe('');
  });
});
