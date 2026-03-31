import { describe, it, expect } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

if (!customElements.get('ha-timeline-card-past-tl')) {
  customElements.define('ha-timeline-card-past-tl', class extends HaTimelineCard {});
}
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

function makeCard(config, eventsByEntity = {}) {
  const el = document.createElement('ha-timeline-card-past-tl');
  document.body.appendChild(el);
  el.setConfig(config);
  el._eventsByEntity = eventsByEntity;
  el._updateTimeline();
  return el;
}

describe('HaTimelineCard._updateTimeline — past window', () => {
  it('renders a now-marker element when past is set', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    const marker = card.shadowRoot.querySelector('.now-marker');
    expect(marker).not.toBeNull();
  });

  it('does not render now-marker when past is "0"', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
      past: '0',
    });
    const marker = card.shadowRoot.querySelector('.now-marker');
    expect(marker).toBeNull();
  });

  it('does not render now-marker when past is not set', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
    });
    const marker = card.shadowRoot.querySelector('.now-marker');
    expect(marker).toBeNull();
  });

  it('now-marker is positioned at correct percentage', () => {
    // past=2h, duration=6h → total=8h, now is at 2/8 = 25%
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    const marker = card.shadowRoot.querySelector('.now-marker');
    expect(marker).not.toBeNull();
    // left should be around 25%
    const leftStr = marker.style.left;
    const leftPct = parseFloat(leftStr);
    expect(leftPct).toBeCloseTo(25, 0);
  });

  it('segment percentages still sum to ~100% with past window', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    const segments = [...card.shadowRoot.getElementById('frise-bar').children];
    // Filter out tick-bar-marks (position:absolute, no flexBasis) and now-marker
    const colorSegments = segments.filter(el =>
      !el.classList.contains('now-marker') && el.style.flexBasis !== ''
    );
    const total = colorSegments.reduce((sum, seg) => {
      const pct = parseFloat(seg.style.flexBasis);
      return isNaN(pct) ? sum : sum + pct;
    }, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('first label in labels row reflects past start (not "Maint.")', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    const labels = [...card.shadowRoot.getElementById('frise-labels').children];
    // With past active, first tick is NOT "Maint." anymore — it's a time label
    // and "Maint." (or "•" if close to a regular tick) appears somewhere in the middle
    const texts = labels.map(l => l.textContent.trim());
    // "Maint." or "•" (collision fallback) should still be present at the now position
    const hasNowLabel = texts.includes('Maint.') || texts.includes('•');
    expect(hasNowLabel).toBe(true);
    // The first label should NOT be "Maint." or "•" when past > 0
    expect(texts[0]).not.toBe('Maint.');
    expect(texts[0]).not.toBe('•');
  });

  it('renders segments covering the past AND future windows', () => {
    // With past=2h, duration=6h → 8h total window, segments cover everything
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    const segments = [...card.shadowRoot.getElementById('frise-bar').children];
    // Filter out tick-bar-marks (no flexBasis) and now-marker
    const colorSegments = segments.filter(el =>
      !el.classList.contains('now-marker') && el.style.flexBasis !== ''
    );
    expect(colorSegments.length).toBeGreaterThan(0);
  });

  it('renders tick marks in frise-ticks with past window', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    const ticks = card.shadowRoot.getElementById('frise-ticks').children;
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('now tick uses now_color in past mode', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
      now_color: '#ff00ff',
    });
    const subMarks = [...card.shadowRoot.getElementById('frise-ticks').children];
    // jsdom may normalise hex to rgb — rgb(255, 0, 255) = #ff00ff
    const hasNowColor = subMarks.some(m =>
      m.style.background === '#ff00ff' || m.style.background === 'rgb(255, 0, 255)'
    );
    expect(hasNowColor).toBe(true);
  });

  it('now-marker is inside frise-wrap (positional context)', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '4h',
      past: '1h',
    });
    const friseWrap = card.shadowRoot.querySelector('.frise-wrap');
    const marker = friseWrap?.querySelector('.now-marker');
    expect(marker).not.toBeNull();
  });
});
