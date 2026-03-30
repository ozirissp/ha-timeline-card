import { describe, it, expect, vi } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

if (!customElements.get('ha-timeline-card-past-fetch')) {
  customElements.define('ha-timeline-card-past-fetch', class extends HaTimelineCard {});
}
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

function makeHass(responses = {}) {
  return {
    states: {},
    callApi: vi.fn(async (_method, path) => {
      const entity = path.split('/')[1]?.split('?')[0];
      return responses[entity] ?? [];
    }),
  };
}

function makeCard(config) {
  const el = document.createElement('ha-timeline-card-past-fetch');
  document.body.appendChild(el);
  el.setConfig(config);
  return el;
}

describe('HaTimelineCard._fetchEvents — past window', () => {
  it('API start date is before now when past is set', async () => {
    const before = Date.now();
    const hass = makeHass();
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    card._hass = hass;
    await card._fetchEvents();

    const path = hass.callApi.mock.calls[0][1];
    // Extract start ISO param
    const startMatch = path.match(/start=([^&]+)/);
    expect(startMatch).not.toBeNull();
    const startMs = new Date(decodeURIComponent(startMatch[1])).getTime();
    // start should be approximately now - 2h (≤ before)
    expect(startMs).toBeLessThan(before);
    // and no more than 2h + small tolerance (30s) before the fetch
    const twoHoursMs = 2 * 60 * 60 * 1000;
    expect(startMs).toBeGreaterThanOrEqual(before - twoHoursMs - 30000);
  });

  it('API start equals now when past is "0"', async () => {
    const before = Date.now();
    const hass = makeHass();
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
      past: '0',
    });
    card._hass = hass;
    await card._fetchEvents();

    const path = hass.callApi.mock.calls[0][1];
    const startMatch = path.match(/start=([^&]+)/);
    const startMs = new Date(decodeURIComponent(startMatch[1])).getTime();
    // past=0 → start should be >= before (no past)
    expect(startMs).toBeGreaterThanOrEqual(before - 1000); // 1s tolerance
  });

  it('API end covers duration + 1h buffer beyond now', async () => {
    const before = Date.now();
    const hass = makeHass();
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '6h',
      past: '2h',
    });
    card._hass = hass;
    await card._fetchEvents();

    const path = hass.callApi.mock.calls[0][1];
    const endMatch = path.match(/end=([^&]+)/);
    const endMs = new Date(decodeURIComponent(endMatch[1])).getTime();
    // end should be at least now + 6h
    const sixHoursMs = 6 * 60 * 60 * 1000;
    expect(endMs).toBeGreaterThanOrEqual(before + sixHoursMs);
  });
});
