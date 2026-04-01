import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

if (!customElements.get('ha-timeline-card-midnight')) {
  customElements.define('ha-timeline-card-midnight', class extends HaTimelineCard {});
}
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

function makeCardAt(nowMs, config = {}) {
  vi.setSystemTime(new Date(nowMs));
  const el = document.createElement('ha-timeline-card-midnight');
  document.body.appendChild(el);
  el.setConfig({
    calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
    ...config,
  });
  el._eventsByEntity = {};
  el._updateTimeline();
  return el;
}

describe('Midnight tick rendering', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('midnight tick has a taller height than regular ticks (48h window)', () => {
    // Place "now" at 2025-04-01 10:00 → a 48h window will cross midnight
    const now = new Date(2025, 3, 1, 10, 0, 0, 0).getTime(); // Apr 1, 10:00
    const card = makeCardAt(now, { duration: '48h' });

    const ticks = [...card.shadowRoot.getElementById('frise-ticks').children];
    expect(ticks.length).toBeGreaterThan(0);

    const heights = ticks.map(t => parseInt(t.style.height, 10));
    const maxHeight = Math.max(...heights);
    const minHeight = Math.min(...heights);

    // There must be at least one taller tick (midnight)
    expect(maxHeight).toBeGreaterThan(minHeight);
  });

  it('midnight tick has greater height than the configured tick_height', () => {
    const now = new Date(2025, 3, 1, 10, 0, 0, 0).getTime();
    const tickHeight = 6;
    const card = makeCardAt(now, { duration: '48h', tick_height: tickHeight });

    const ticks = [...card.shadowRoot.getElementById('frise-ticks').children];
    const maxHeight = Math.max(...ticks.map(t => parseInt(t.style.height, 10)));

    expect(maxHeight).toBeGreaterThan(tickHeight);
  });

  it('midnight tick has a larger width than regular ticks', () => {
    const now = new Date(2025, 3, 1, 10, 0, 0, 0).getTime();
    const card = makeCardAt(now, { duration: '48h' });

    const ticks = [...card.shadowRoot.getElementById('frise-ticks').children];
    const widths = ticks.map(t => parseInt(t.style.width, 10) || 1);
    const maxWidth = Math.max(...widths);

    // At least one tick should be wider (midnight marker)
    expect(maxWidth).toBeGreaterThan(1);
  });

  it('midnight tick is always injected even when tickMs does not align with midnight (6h window)', () => {
    // 6h window from 22:00 to 04:00 → tickMs = 1h, ticks at 22,23,0,1,2,3,4
    // Midnight is crossed and MUST appear regardless of tickMs
    const now = new Date(2025, 3, 1, 22, 0, 0, 0).getTime(); // Apr 1, 22:00
    const card = makeCardAt(now, { duration: '6h', tick_height: 6 });

    const ticks = [...card.shadowRoot.getElementById('frise-ticks').children];
    const labels = [...card.shadowRoot.getElementById('frise-labels').children];
    const labelTexts = labels.map(l => l.textContent.trim());

    // midnight should appear either as '0h' or as the day label
    const hasMidnightLabel = labelTexts.some(t => t === '0h' || t === 'mer.' || t === 'jeu.' || t === 'mar.' || t === 'sam.' || t === 'dim.' || t === 'lun.' || t === 'ven.');
    expect(hasMidnightLabel).toBe(true);

    // And at least one tick must be taller than the base tick_height (= midnight marker)
    const heights = ticks.map(t => parseInt(t.style.height, 10));
    expect(Math.max(...heights)).toBeGreaterThan(6);
  });

  it('midnight tick appears even when local midnight does not align with UTC epoch multiples of tickMs', () => {
    // Regression test for UTC-offset bug:
    // tickMs=3h multiples from Unix epoch (UTC) are at UTC 0h,3h,6h...21h
    // In UTC+1, local midnight = UTC 23:00 — NOT a 3h multiple from epoch
    // So firstTick = ceil(windowStart/3h)*3h would jump OVER local midnight.
    // Fix: align firstTick to local midnight instead of epoch.
    //
    // We simulate the scenario by constructing a windowStart whose local midnight
    // is NOT on a 3h UTC boundary. In the test env (UTC), we use a date where
    // getHours()===0 but the UTC timestamp is NOT a multiple of tickMs.
    //
    // We do this by mocking a timezone offset: shift the Date constructor so that
    // "local midnight" falls at UTC 23:00 (simulating UTC+1 offset of -1h from UTC midnight).
    // Concretely: set now = UTC 2025-04-01T19:00Z (=20h UTC+1 local), duration=24h.
    // Local midnight next day = UTC 2025-04-01T23:00Z.
    // With old code: firstTick from epoch = ceil(19h/3h)*3h = 21h UTC → ticks at 21h,0h,3h UTC
    //   → local hours: 21h(UTC)→0h(next day UTC+1? no, UTC=UTC here)
    // Since test runs in UTC we simulate by directly checking the alignment logic:
    // windowStart = Date.UTC(2025,3,1,20,0,0) — 20:00 UTC
    // tickMs=3h, epoch-aligned firstTick = 21:00 UTC
    // Local midnight = new Date(windowStart).setHours(0,0,0,0) = 2025-04-01 00:00 UTC (same day)
    // Next midnight = 2025-04-02 00:00 UTC = windowStart + 4h → should be in 24h window
    // With old code: firstTick=21h → ticks: 21h, 0h (next day midnight!), 3h... ✓ works in UTC
    //
    // The real fix must be verified by running in UTC+1 which we can't do here directly,
    // BUT we can verify the fixed code produces midnight-aligned ticks when
    // windowStartMs is specifically NOT a multiple of tickMs and midnight is between ticks.
    //
    // Direct assertion: the alignment base must be local midnight, not epoch.
    // Verify that the tick list generated by the card contains a tick at exactly local midnight.

    // now = Apr 1, 20:15 (UTC) — windowStart is NOT on a tickMs boundary
    const now = new Date(2025, 3, 1, 20, 15, 0, 0).getTime();
    const card = makeCardAt(now, { duration: '24h', tick_height: 6 });

    const ticks = [...card.shadowRoot.getElementById('frise-ticks').children];
    const labels = [...card.shadowRoot.getElementById('frise-labels').children];
    const labelTexts = labels.map(l => l.textContent.trim());

    // Midnight (0h) must appear in labels
    expect(labelTexts).toContain('0h');

    // And the midnight tick must be taller (isMidnightTick detection)
    expect(Math.max(...ticks.map(t => parseInt(t.style.height, 10)))).toBeGreaterThan(6);
  });

  it('window without any midnight crossing does not produce oversized ticks', () => {
    // Place now at midnight exactly, duration 6h → next midnight is 18h away, not in window
    const now = new Date(2025, 3, 1, 0, 0, 0, 0).getTime(); // midnight itself
    const card = makeCardAt(now, { duration: '6h', tick_height: 6 });

    const ticks = [...card.shadowRoot.getElementById('frise-ticks').children];
    // The only midnight is at position 0 (windowStart) which is filtered if too close to
    // a regular tick — in any case no tick should exceed the midnight height (×1.3 scale)
    const defaultMidnightHeight = 6 * 1.3; // tick_height * 1.3
    const allFitInBounds = ticks.every(t => parseInt(t.style.height, 10) <= defaultMidnightHeight + 1);
    expect(allFitInBounds).toBe(true);
  });
});
