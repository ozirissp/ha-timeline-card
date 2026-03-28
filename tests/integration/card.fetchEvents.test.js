import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

if (!customElements.get('ha-timeline-card-fetch')) {
  customElements.define('ha-timeline-card-fetch', class extends HaTimelineCard {});
}
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

function makeHass(responses = {}) {
  return {
    states: {},
    callApi: vi.fn(async (method, path) => {
      const entity = path.split('/')[1]?.split('?')[0];
      return responses[entity] ?? [];
    }),
  };
}

function makeCard(config) {
  const el = document.createElement('ha-timeline-card-fetch');
  document.body.appendChild(el);
  el.setConfig(config);
  return el;
}

describe('HaTimelineCard._fetchEvents', () => {
  it('calls callApi once per unique entity', async () => {
    const hass = makeHass();
    const card = makeCard({
      calendars: [
        { entity: 'calendar.a', color: '#fff', label: 'A' },
        { entity: 'calendar.b', color: '#000', label: 'B' },
      ],
    });
    card._hass = hass;
    await card._fetchEvents();
    expect(hass.callApi).toHaveBeenCalledTimes(2);
  });

  it('deduplicates entities shared across groups', async () => {
    const hass = makeHass();
    const card = makeCard({
      calendars: [
        { entities: ['calendar.a', 'calendar.b'], color: '#fff', label: 'G1' },
        { entities: ['calendar.b', 'calendar.c'], color: '#000', label: 'G2' },
      ],
    });
    card._hass = hass;
    await card._fetchEvents();
    // calendar.b appears in both groups — should only be fetched once
    expect(hass.callApi).toHaveBeenCalledTimes(3);
    const calledPaths = hass.callApi.mock.calls.map(c => c[1].split('?')[0]);
    const uniquePaths = [...new Set(calledPaths)];
    expect(uniquePaths).toHaveLength(3);
  });

  it('stores parsed events in _eventsByEntity', async () => {
    const hass = makeHass({
      'calendar.a': [
        { start: { dateTime: '2026-03-28T08:00:00Z' }, end: { dateTime: '2026-03-28T10:00:00Z' } },
      ],
    });
    const card = makeCard({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    card._hass = hass;
    await card._fetchEvents();
    expect(card._eventsByEntity['calendar.a']).toHaveLength(1);
    expect(card._eventsByEntity['calendar.a'][0].start).toBe(new Date('2026-03-28T08:00:00Z').getTime());
  });

  it('handles API errors gracefully (empty events for that entity)', async () => {
    const hass = {
      states: {},
      callApi: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    const card = makeCard({ calendars: [{ entity: 'calendar.err', color: '#fff', label: 'Err' }] });
    card._hass = hass;
    await expect(card._fetchEvents()).resolves.toBeUndefined();
    expect(card._eventsByEntity['calendar.err']).toEqual([]);
  });

  it('sets _lastFetch to current time after fetch', async () => {
    const before = Date.now();
    const card = makeCard({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    card._hass = makeHass();
    await card._fetchEvents();
    expect(card._lastFetch).toBeGreaterThanOrEqual(before);
  });

  it('uses correct ISO date range in API call', async () => {
    const hass = makeHass();
    const card = makeCard({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
    });
    card._hass = hass;
    await card._fetchEvents();
    const path = hass.callApi.mock.calls[0][1];
    expect(path).toMatch(/start=\d{4}-\d{2}-\d{2}T/);
    expect(path).toMatch(/end=\d{4}-\d{2}-\d{2}T/);
  });
});
