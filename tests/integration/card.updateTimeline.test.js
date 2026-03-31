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
    // Filter out tick-bar-marks (they use position:absolute, no flexBasis)
    const colorSegments = segments.filter(s => s.style.flexBasis !== '');
    const total = colorSegments.reduce((sum, seg) => {
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

  it('renders tick marks in frise-ticks', () => {
    const card = makeCard({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const ticks = card.shadowRoot.getElementById('frise-ticks').children;
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('renders tick-bar-marks inside frise-bar', () => {
    const card = makeCard({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const all = [...card.shadowRoot.getElementById('frise-bar').children];
    // tick-bar-marks have position:absolute (no flexBasis)
    const barMarks = all.filter(s => s.style.flexBasis === '');
    expect(barMarks.length).toBeGreaterThan(0);
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

  it('ticks-row height reflects tick_height config', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      tick_height: 10,
    });
    const ticksRow = card.shadowRoot.getElementById('frise-ticks');
    expect(ticksRow.style.height).toBe('10px');
  });

  it('no label text overlap between border tick and regular tick when close', () => {
    // With no past (duration 24h), "Maint." is at offset 0 (window start).
    // The border tick at offset 0 and the first regular tick should not both be labelled
    // if they are within the 8% threshold — border is filtered out.
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
    });
    const labels = [...card.shadowRoot.getElementById('frise-labels').children];
    const texts = labels.map(l => l.textContent.trim());
    // No duplicate labels
    const unique = new Set(texts);
    expect(unique.size).toBe(texts.length);
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
