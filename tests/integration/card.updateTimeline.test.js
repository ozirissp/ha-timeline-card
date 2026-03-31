import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

if (!customElements.get('ha-timeline-card-tl')) {
  customElements.define('ha-timeline-card-tl', class extends HaTimelineCard {});
}
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

// Fix "now" to 2025-04-02 10:00 UTC so the 24h window starts at 10h.
// firstTick = ceil(10h / 3h) * 3h = 12h → offset = 2h.
// THRESHOLD = 24h * 0.08 = 1.92h. 2h > 1.92h → offset 0 survives filter → label '•'. ✓
const FIXED_NOW = new Date(2025, 3, 2, 10, 0, 0, 0).getTime(); // 2025-04-02 10:00 local

function makeCard(config, eventsByEntity = {}) {
  const el = document.createElement('ha-timeline-card-tl');
  document.body.appendChild(el);
  el.setConfig(config);
  el._eventsByEntity = eventsByEntity;
  el._updateTimeline();
  return el;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('HaTimelineCard._updateTimeline', () => {
  it('renders at least one segment in frise-bar', () => {
    const card = makeCard({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const segments = card.shadowRoot.getElementById('frise-bar').children;
    expect(segments.length).toBeGreaterThan(0);
  });

  it('renders only default_color segments when no events', () => {
    const card = makeCard(
      { calendars: [{ entity: 'calendar.a', color: '#ff0000', label: 'A' }], default_color: '#444444' },
      { 'calendar.a': [] },
    );
    const all = [...card.shadowRoot.getElementById('frise-bar').children];
    // Filter out tick-bar-marks (position:absolute, no flexBasis)
    const segments = all.filter(s => s.style.flexBasis !== '');
    // jsdom normalises hex colors to rgb() — check none uses the calendar color
    segments.forEach(seg => {
      expect(seg.style.background).not.toMatch(/255,\s*0,\s*0/); // not #ff0000
    });
    // All color segments share the same (default) color
    const colors = new Set(segments.map(s => s.style.background));
    expect(colors.size).toBe(1);
  });

  it('segment percentages sum to ~100%', () => {
    const card = makeCard({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const segments = [...card.shadowRoot.getElementById('frise-bar').children];
    const total = segments.reduce((sum, seg) => {
      const pct = parseFloat(seg.style.flexBasis);
      return sum + pct;
    }, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('renders time labels in frise-labels', () => {
    const card = makeCard({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const labels = card.shadowRoot.getElementById('frise-labels').children;
    expect(labels.length).toBeGreaterThan(0);
  });

  it('first label is "•" (now marker) for standard durations without past', () => {
    // Without past, windowStart = now → first tick is the now marker → always "•"
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
    });
    const labels = [...card.shadowRoot.getElementById('frise-labels').children];
    expect(labels[0].textContent).toBe('•');
  });

  it('renders tick marks in frise-ticks', () => {
    const card = makeCard({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const ticks = card.shadowRoot.getElementById('frise-ticks').children;
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('frise-bar contains only flex color segments (no tick-bar-marks)', () => {
    const card = makeCard({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const all = [...card.shadowRoot.getElementById('frise-bar').children];
    // All children should be color segments (have flexBasis set)
    all.forEach(child => {
      expect(child.style.flexBasis).not.toBe('');
    });
  });

  it('tick marks use tick_color by default', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      tick_color: '#112233',
    });
    const subMarks = [...card.shadowRoot.getElementById('frise-ticks').children];
    expect(subMarks.length).toBeGreaterThan(0);
    // jsdom may normalise hex to rgb — check against both forms
    // rgb(17, 34, 51) = #112233
    const hasColor = subMarks.some(m =>
      m.style.background === '#112233' || m.style.background === 'rgb(17, 34, 51)'
    );
    expect(hasColor).toBe(true);
  });

  it('ticks-row height reflects tick_height config (scaled for midnight markers)', () => {
    // The ticks-row is sized at tick_height × 2.5 to accommodate midnight taller marks
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      tick_height: 10,
    });
    const ticksRow = card.shadowRoot.getElementById('frise-ticks');
    expect(ticksRow.style.height).toBe('25px'); // 10 × 2.5
  });

  it('now marker always renders as "•" (never as "Maint.")', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
    });
    const labels = [...card.shadowRoot.getElementById('frise-labels').children];
    const texts = labels.map(l => l.textContent.trim());
    expect(texts).not.toContain('Maint.');
    expect(texts).toContain('•');
  });

  it('now tick does not create a sub-mark in frise-ticks', () => {
    // Without past, the now tick is at offset 0 (windowStart).
    // It should NOT produce a sub-mark in frise-ticks (only the dot label).
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
    });
    // The number of sub-marks should be less than the number of labels
    // (now tick skips the sub-mark)
    const subMarks = card.shadowRoot.getElementById('frise-ticks').children.length;
    const labelCount = card.shadowRoot.getElementById('frise-labels').children.length;
    expect(subMarks).toBeLessThan(labelCount);
  });

  it('renders legend when show_legend is true', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#aabbcc', label: 'Mon Cal' }],
      show_legend: true,
    });
    expect(card.shadowRoot.innerHTML).toContain('Mon Cal');
    expect(card.shadowRoot.innerHTML).toContain('#aabbcc');
  });

  it('does not render legend when show_legend is false', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#aabbcc', label: 'Mon Cal' }],
      show_legend: false,
    });
    expect(card.shadowRoot.querySelector('.legend')).toBeNull();
  });

  it('renders title when show_title is true and title is set', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      title: 'Mon Planning',
      show_title: true,
    });
    expect(card.shadowRoot.innerHTML).toContain('Mon Planning');
  });

  it('does not render title when show_title is false', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      title: 'Mon Planning',
      show_title: false,
    });
    expect(card.shadowRoot.querySelector('.card-title')).toBeNull();
  });
});
