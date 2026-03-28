import { describe, it, expect, beforeEach } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

if (!customElements.get('ha-timeline-card-tl')) {
  customElements.define('ha-timeline-card-tl', class extends HaTimelineCard {});
}
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

function makeCard(config, eventsByEntity = {}) {
  const el = document.createElement('ha-timeline-card-tl');
  document.body.appendChild(el);
  el.setConfig(config);
  el._eventsByEntity = eventsByEntity;
  el._updateTimeline();
  return el;
}

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
    const segments = [...card.shadowRoot.getElementById('frise-bar').children];
    // jsdom normalises hex colors to rgb() — check none uses the calendar color
    segments.forEach(seg => {
      expect(seg.style.background).not.toMatch(/255,\s*0,\s*0/); // not #ff0000
    });
    // All segments share the same (default) color
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

  it('first label is "Maint." for standard durations', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
    });
    const labels = [...card.shadowRoot.getElementById('frise-labels').children];
    expect(labels[0].textContent).toBe('Maint.');
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
