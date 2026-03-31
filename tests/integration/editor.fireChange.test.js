import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HaTimelineCardEditor } from '../../src/editor.js';

if (!customElements.get('ha-timeline-card-editor')) {
  customElements.define('ha-timeline-card-editor', HaTimelineCardEditor);
}

function makeEditor(config = {}) {
  const el = document.createElement('ha-timeline-card-editor');
  document.body.appendChild(el);
  el.setConfig(config);
  return el;
}

describe('HaTimelineCardEditor._fireChange', () => {
  it('dispatches config-changed event', () => {
    const editor = makeEditor({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const handler = vi.fn();
    editor.addEventListener('config-changed', handler);
    editor._fireChange();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits entity (string) key for single-entity group', () => {
    const editor = makeEditor({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor._fireChange();
    const cal = events[0].calendars[0];
    expect(cal.entity).toBe('calendar.a');
    expect(cal.entities).toBeUndefined();
  });

  it('emits entities (array) key for multi-entity group', () => {
    const editor = makeEditor({
      calendars: [{ entities: ['calendar.a', 'calendar.b'], color: '#fff', label: 'AB' }],
    });
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor._fireChange();
    const cal = events[0].calendars[0];
    expect(cal.entities).toEqual(['calendar.a', 'calendar.b']);
    expect(cal.entity).toBeUndefined();
  });

  it('includes empty groups in emitted config (entities: [])', () => {
    // Empty groups must survive the HA setConfig() reflection so they remain
    // visible in the editor while the user adds entities to them.
    const editor = makeEditor({ calendars: [] });
    // Manually inject a group card with no entity tags into the DOM
    const calList = editor.shadowRoot.getElementById('cal-list');
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <div class="group-header">
        <input type="color" class="grp-color" value="#5DCAA5" />
        <input type="text" class="grp-label" value="Nouveau groupe" />
      </div>
      <div class="entities-wrap"></div>
    `;
    calList.appendChild(card);
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor._fireChange();
    expect(events[0].calendars).toHaveLength(1);
    expect(events[0].calendars[0].entities).toEqual([]);
    expect(events[0].calendars[0].label).toBe('Nouveau groupe');
  });

  it('new group added via btn-add-group is saved in config', () => {
    // Regression test: clicking "+ Nouveau groupe" must include the new empty
    // group in the dispatched config so HA persists it and setConfig() keeps
    // it visible while the user fills in calendar entities.
    const editor = makeEditor({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor.shadowRoot.getElementById('btn-add-group').click();
    // The last fired event should contain both the existing group and the new empty one
    const lastConfig = events[events.length - 1];
    expect(lastConfig.calendars).toHaveLength(2);
    // First group: the existing one with an entity
    expect(lastConfig.calendars[0].entity).toBe('calendar.a');
    // Second group: the new empty one
    expect(lastConfig.calendars[1].entities).toEqual([]);
  });

  it('preserves duration and default_color in emitted config', () => {
    const editor = makeEditor({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '7d',
      default_color: '#123456',
    });
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor._fireChange();
    expect(events[0].duration).toBe('7d');
    expect(events[0].default_color).toBe('#123456');
  });

  it('emits default tick_color, now_color and tick_height when not configured', () => {
    const editor = makeEditor({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor._fireChange();
    expect(events[0].tick_color).toBe('#aaaaaa');
    expect(events[0].now_color).toBe('#ffffff');
    expect(events[0].tick_height).toBe('6');
  });

  it('preserves custom tick_color, now_color and tick_height in emitted config', () => {
    const editor = makeEditor({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      tick_color: '#ff0000',
      now_color: '#00ff00',
      tick_height: '8',
    });
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor._fireChange();
    expect(events[0].tick_color).toBe('#ff0000');
    expect(events[0].now_color).toBe('#00ff00');
    expect(events[0].tick_height).toBe('8');
  });
});
