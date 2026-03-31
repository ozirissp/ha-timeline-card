import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

if (!customElements.get('ha-timeline-card-lt')) {
  customElements.define('ha-timeline-card-lt', class extends HaTimelineCard {});
}
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

// Fix "now" to 2026-03-31 10:00:00 UTC
const FIXED_NOW = new Date('2026-03-31T10:00:00Z').getTime();
const H = 60 * 60 * 1000;
const M = 60 * 1000;

function makeCard(config, eventsByEntity = {}) {
  const el = document.createElement('ha-timeline-card-lt');
  document.body.appendChild(el);
  el.setConfig(config);
  el._eventsByEntity = eventsByEntity;
  el._updateTimeline();
  return el;
}

function getLegendItems(card) {
  return [...card.shadowRoot.querySelectorAll('.legend-item')];
}

function getLegendInfoText(card, idx = 0) {
  const items = getLegendItems(card);
  if (!items[idx]) return null;
  const span = items[idx].querySelector('.legend-info');
  return span ? span.textContent : null;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Legend times — show_legend_times option', () => {
  it('show_legend_times defaults to true (legend-info spans are rendered)', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }],
    });
    const items = getLegendItems(card);
    expect(items.length).toBe(1);
    // The span.legend-info should exist even if empty
    expect(items[0].querySelector('.legend-info')).not.toBeNull();
  });

  it('show_legend_times: false — no legend-info spans rendered', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }],
      show_legend_times: false,
    });
    const items = getLegendItems(card);
    expect(items.length).toBe(1);
    expect(items[0].querySelector('.legend-info')).toBeNull();
  });

  it('show_legend_times: true — legend-info span exists', () => {
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }],
      show_legend_times: true,
    });
    const items = getLegendItems(card);
    expect(items[0].querySelector('.legend-info')).not.toBeNull();
  });
});

describe('Legend times — no event in window', () => {
  it('legend-info is empty when no events', () => {
    const card = makeCard(
      { calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }] },
      { 'calendar.a': [] },
    );
    const info = getLegendInfoText(card);
    expect(info).toBe('');
  });

  it('legend only shows label text when no events and show_legend_times is true', () => {
    const card = makeCard(
      { calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }] },
      {},
    );
    const item = getLegendItems(card)[0];
    expect(item.textContent).toContain('HC');
    // No arrow or dash in the item text
    expect(item.querySelector('.legend-info').textContent.trim()).toBe('');
  });
});

describe('Legend times — active event', () => {
  it('shows "· HH:MM – HH:MM" when an event is currently active', () => {
    // Active event: 08:00 → 12:00 (now is 10:00, inside)
    const evStart = FIXED_NOW - 2 * H; // 08:00
    const evEnd   = FIXED_NOW + 2 * H; // 12:00
    const card = makeCard(
      { calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }] },
      { 'calendar.a': [{ start: evStart, end: evEnd }] },
    );
    const info = getLegendInfoText(card);
    expect(info).toMatch(/·/);
    expect(info).toMatch(/–/);
    // Should contain time separator colons (two times: HH:MM – HH:MM)
    const colonCount = (info.match(/:/g) || []).length;
    expect(colonCount).toBe(2);
  });

  it('does NOT show → arrow when event is active', () => {
    const evStart = FIXED_NOW - H;
    const evEnd   = FIXED_NOW + H;
    const card = makeCard(
      { calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }] },
      { 'calendar.a': [{ start: evStart, end: evEnd }] },
    );
    const info = getLegendInfoText(card);
    expect(info).not.toMatch(/→/);
  });
});

describe('Legend times — next event', () => {
  it('shows "· → HH:MM (Xh)" when next event is >= 1h away', () => {
    const nextStart = FIXED_NOW + 90 * M; // in 1h30
    const nextEnd   = FIXED_NOW + 3 * H;
    const card = makeCard(
      { calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }] },
      { 'calendar.a': [{ start: nextStart, end: nextEnd }] },
    );
    const info = getLegendInfoText(card);
    expect(info).toMatch(/·/);
    expect(info).toMatch(/→/);
    expect(info).toContain('1h30');
    expect(info).toMatch(/\(.*\)/); // has parentheses
  });

  it('shows "· → HH:MM (Xmin)" when next event is < 1h away', () => {
    const nextStart = FIXED_NOW + 45 * M;
    const nextEnd   = FIXED_NOW + 2 * H;
    const card = makeCard(
      { calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }] },
      { 'calendar.a': [{ start: nextStart, end: nextEnd }] },
    );
    const info = getLegendInfoText(card);
    expect(info).toMatch(/→/);
    expect(info).toContain('45min');
  });

  it('does NOT show – dash when showing next event', () => {
    const nextStart = FIXED_NOW + H;
    const nextEnd   = FIXED_NOW + 2 * H;
    const card = makeCard(
      { calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }] },
      { 'calendar.a': [{ start: nextStart, end: nextEnd }] },
    );
    const info = getLegendInfoText(card);
    expect(info).not.toMatch(/–/);
  });
});

describe('Legend times — multiple groups', () => {
  it('each group gets its own legend-info', () => {
    // Group A: active event (10:00 is inside 08:00-12:00)
    const evA = { start: FIXED_NOW - 2 * H, end: FIXED_NOW + 2 * H };
    // Group B: no active, next in 2h
    const evB = { start: FIXED_NOW + 2 * H, end: FIXED_NOW + 4 * H };

    const card = makeCard(
      {
        calendars: [
          { entity: 'calendar.a', color: '#5DCAA5', label: 'HC' },
          { entity: 'calendar.b', color: '#F0997B', label: 'OFF' },
        ],
      },
      {
        'calendar.a': [evA],
        'calendar.b': [evB],
      },
    );

    const infoA = getLegendInfoText(card, 0);
    const infoB = getLegendInfoText(card, 1);

    // Group A: active → shows bounds (contains –)
    expect(infoA).toMatch(/–/);
    expect(infoA).not.toMatch(/→/);

    // Group B: next event → shows arrow
    expect(infoB).toMatch(/→/);
    expect(infoB).not.toMatch(/–/);
  });

  it('group with no events shows empty legend-info', () => {
    const evA = { start: FIXED_NOW + H, end: FIXED_NOW + 2 * H };

    const card = makeCard(
      {
        calendars: [
          { entity: 'calendar.a', color: '#5DCAA5', label: 'HC' },
          { entity: 'calendar.b', color: '#F0997B', label: 'OFF' },
        ],
      },
      {
        'calendar.a': [evA],
        'calendar.b': [],
      },
    );

    const infoB = getLegendInfoText(card, 1);
    expect(infoB.trim()).toBe('');
  });
});

describe('Legend times — live update', () => {
  it('legend-info updates when _updateTimeline() is called again', () => {
    // Initially no active event
    const card = makeCard(
      { calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }] },
      { 'calendar.a': [] },
    );

    const infoBefore = getLegendInfoText(card);
    expect(infoBefore.trim()).toBe('');

    // Simulate event becoming active
    card._eventsByEntity = {
      'calendar.a': [{ start: FIXED_NOW - H, end: FIXED_NOW + H }],
    };
    card._updateTimeline();

    const infoAfter = getLegendInfoText(card);
    expect(infoAfter).toMatch(/–/);
  });

  it('legend-info clears when event ends', () => {
    // Active event
    card1: {
      const card = makeCard(
        { calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }] },
        { 'calendar.a': [{ start: FIXED_NOW - 2 * H, end: FIXED_NOW + H }] },
      );

      const infoDuring = getLegendInfoText(card);
      expect(infoDuring).toMatch(/–/);

      // Advance time past event end → event is no longer active
      vi.setSystemTime(FIXED_NOW + 2 * H);
      card._updateTimeline();

      const infoAfter = getLegendInfoText(card);
      // Event started before the new "now", ended after the old "now" but before new now
      // The event start=FIXED_NOW-2H end=FIXED_NOW+H — new now is FIXED_NOW+2H → past
      expect(infoAfter.trim()).toBe('');
    }
  });
});

describe('Legend times — show_legend: false', () => {
  it('no legend-info spans when show_legend is false', () => {
    const card = makeCard(
      {
        calendars: [{ entity: 'calendar.a', color: '#5DCAA5', label: 'HC' }],
        show_legend: false,
      },
      { 'calendar.a': [{ start: FIXED_NOW - H, end: FIXED_NOW + H }] },
    );
    expect(card.shadowRoot.querySelector('.legend')).toBeNull();
    expect(card.shadowRoot.querySelector('.legend-info')).toBeNull();
  });
});
