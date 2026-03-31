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

  it('window without any midnight crossing does not produce oversized ticks', () => {
    // Place now at midnight exactly, duration 6h → next midnight is 18h away, not in window
    const now = new Date(2025, 3, 1, 0, 0, 0, 0).getTime(); // midnight itself
    const card = makeCardAt(now, { duration: '6h', tick_height: 6 });

    const ticks = [...card.shadowRoot.getElementById('frise-ticks').children];
    // The only midnight is at position 0 (windowStart) which is filtered if too close to
    // a regular tick — in any case no tick should exceed the midnight height (×2.5 scale)
    const defaultMidnightHeight = 6 * 2.5; // tick_height * 2.5
    const allFitInBounds = ticks.every(t => parseInt(t.style.height, 10) <= defaultMidnightHeight + 1);
    expect(allFitInBounds).toBe(true);
  });
});
