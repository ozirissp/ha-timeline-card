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

  it('excludes groups with no entities', () => {
    const editor = makeEditor({ calendars: [] });
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor._fireChange();
    expect(events[0].calendars).toEqual([]);
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
});
