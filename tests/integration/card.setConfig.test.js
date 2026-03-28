import { describe, it, expect, beforeEach } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

// Register the custom element for jsdom
if (!customElements.get('ha-timeline-card')) {
  customElements.define('ha-timeline-card', HaTimelineCard);
}
// Stub ha-card (used in _render innerHTML)
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

function makeCard() {
  const el = document.createElement('ha-timeline-card');
  document.body.appendChild(el);
  return el;
}

describe('HaTimelineCard.setConfig', () => {
  let card;
  beforeEach(() => {
    card = makeCard();
  });

  it('throws when calendars is missing', () => {
    expect(() => card.setConfig({})).toThrow();
  });

  it('throws when calendars is empty array', () => {
    expect(() => card.setConfig({ calendars: [] })).toThrow();
  });

  it('throws when all groups have no valid entity', () => {
    expect(() => card.setConfig({ calendars: [{ color: '#fff' }] })).toThrow();
  });

  it('accepts legacy single entity format', () => {
    card.setConfig({ calendars: [{ entity: 'calendar.test', color: '#aabbcc', label: 'T' }] });
    expect(card._config.calendars[0].entities).toEqual(['calendar.test']);
  });

  it('accepts new entities[] format', () => {
    card.setConfig({
      calendars: [{ entities: ['calendar.a', 'calendar.b'], color: '#aabbcc', label: 'AB' }],
    });
    expect(card._config.calendars[0].entities).toEqual(['calendar.a', 'calendar.b']);
  });

  it('mixes entity and entities formats in same config', () => {
    card.setConfig({
      calendars: [
        { entity: 'calendar.solo', color: '#fff', label: 'Solo' },
        { entities: ['calendar.x', 'calendar.y'], color: '#000', label: 'Multi' },
      ],
    });
    expect(card._config.calendars).toHaveLength(2);
    expect(card._config.calendars[0].entities).toEqual(['calendar.solo']);
    expect(card._config.calendars[1].entities).toEqual(['calendar.x', 'calendar.y']);
  });

  it('uses defaults for optional fields', () => {
    card.setConfig({ calendars: [{ entity: 'calendar.x' }] });
    expect(card._config.duration).toBe('24h');
    expect(card._config.default_color).toBe('#444444');
    expect(card._config.show_title).toBe(true);
    expect(card._config.show_legend).toBe(true);
  });

  it('applies provided optional fields', () => {
    card.setConfig({
      calendars: [{ entity: 'calendar.x' }],
      duration: '7d',
      default_color: '#ff0000',
      title: 'Test',
      show_title: false,
      show_legend: false,
    });
    expect(card._config.duration).toBe('7d');
    expect(card._config.default_color).toBe('#ff0000');
    expect(card._config.title).toBe('Test');
    expect(card._config.show_title).toBe(false);
    expect(card._config.show_legend).toBe(false);
  });

  it('resets _lastFetch to 0 on each setConfig call', () => {
    card._lastFetch = 9999999;
    card.setConfig({ calendars: [{ entity: 'calendar.x' }] });
    expect(card._lastFetch).toBe(0);
  });

  it('renders frise-bar and frise-labels into shadowRoot', () => {
    card.setConfig({ calendars: [{ entity: 'calendar.x' }] });
    expect(card.shadowRoot.getElementById('frise-bar')).not.toBeNull();
    expect(card.shadowRoot.getElementById('frise-labels')).not.toBeNull();
  });
});
