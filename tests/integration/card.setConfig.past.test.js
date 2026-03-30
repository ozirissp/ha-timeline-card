import { describe, it, expect, beforeEach } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

// Use a distinct tag name to avoid conflicts with other test files
if (!customElements.get('ha-timeline-card-past-cfg')) {
  customElements.define('ha-timeline-card-past-cfg', class extends HaTimelineCard {});
}
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

function makeCard() {
  const el = document.createElement('ha-timeline-card-past-cfg');
  document.body.appendChild(el);
  return el;
}

describe('HaTimelineCard.setConfig — past option', () => {
  let card;
  beforeEach(() => {
    card = makeCard();
  });

  it('defaults past to "0" when not provided', () => {
    card.setConfig({ calendars: [{ entity: 'calendar.x' }] });
    expect(card._config.past).toBe('0');
  });

  it('stores past value when provided as string', () => {
    card.setConfig({ calendars: [{ entity: 'calendar.x' }], past: '2h' });
    expect(card._config.past).toBe('2h');
  });

  it('stores past value when provided as number (hours)', () => {
    card.setConfig({ calendars: [{ entity: 'calendar.x' }], past: 1 });
    expect(card._config.past).toBe(1);
  });

  it('stores past value with minutes format', () => {
    card.setConfig({ calendars: [{ entity: 'calendar.x' }], past: '30m' });
    expect(card._config.past).toBe('30m');
  });

  it('stores past value with days format', () => {
    card.setConfig({ calendars: [{ entity: 'calendar.x' }], past: '1d' });
    expect(card._config.past).toBe('1d');
  });

  it('renders frise-bar correctly with past option set', () => {
    card.setConfig({ calendars: [{ entity: 'calendar.x' }], past: '2h', duration: '6h' });
    expect(card.shadowRoot.getElementById('frise-bar')).not.toBeNull();
    expect(card.shadowRoot.getElementById('frise-labels')).not.toBeNull();
  });
});
