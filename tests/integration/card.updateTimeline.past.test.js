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
    // frise-bar contains only color segments (no tick-bar-marks anymore)
    const total = segments.reduce((sum, seg) => {
      const pct = parseFloat(seg.style.flexBasis);
      return isNaN(pct) ? sum : sum + pct;
    }, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('"•" appears in frise-now-dot, not in frise-labels, with past window', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    // "•" lives in the dedicated now-dot row
    const nowDot = card.shadowRoot.getElementById('frise-now-dot');
    expect(nowDot).not.toBeNull();
    const nowDotTexts = [...nowDot.children].map(l => l.textContent.trim());
    expect(nowDotTexts).toContain('•');
    // frise-labels should NOT contain "•"
    const labels = [...card.shadowRoot.getElementById('frise-labels').children];
    const texts = labels.map(l => l.textContent.trim());
    expect(texts).not.toContain('•');
    // "Maint." must never appear
    expect(card.shadowRoot.textContent).not.toContain('Maint.');
  });

  it('renders segments covering the past AND future windows', () => {
    // With past=2h, duration=6h → 8h total window, segments cover everything
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    const segments = [...card.shadowRoot.getElementById('frise-bar').children];
    expect(segments.length).toBeGreaterThan(0);
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

  it('now tick "•" uses now_color in frise-now-dot, not in frise-ticks sub-marks', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
      now_color: '#ff00ff',
    });
    // The "•" label lives in frise-now-dot and should use now_color
    const nowDot = card.shadowRoot.getElementById('frise-now-dot');
    const dotLabel = [...nowDot.children].find(l => l.textContent.trim() === '•');
    expect(dotLabel).not.toBeUndefined();
    // jsdom may normalise hex to rgb — rgb(255, 0, 255) = #ff00ff
    expect(
      dotLabel.style.color === '#ff00ff' || dotLabel.style.color === 'rgb(255, 0, 255)'
    ).toBe(true);
    // The now tick must NOT produce a sub-mark in frise-ticks
    const subMarks = [...card.shadowRoot.getElementById('frise-ticks').children];
    const labels = [...card.shadowRoot.getElementById('frise-labels').children];
    expect(subMarks.length).toBeLessThanOrEqual(labels.length);
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
