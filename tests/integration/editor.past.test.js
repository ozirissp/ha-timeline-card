import { describe, it, expect, vi } from 'vitest';
import { HaTimelineCardEditor } from '../../src/editor.js';

if (!customElements.get('ha-timeline-card-editor-past')) {
  customElements.define('ha-timeline-card-editor-past', class extends HaTimelineCardEditor {});
}

function makeEditor(config = {}) {
  const el = document.createElement('ha-timeline-card-editor-past');
  document.body.appendChild(el);
  el.setConfig(config);
  return el;
}

describe('HaTimelineCardEditor — past field', () => {
  it('renders a past input field in the editor', () => {
    const editor = makeEditor({ calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }] });
    const pastInput = editor.shadowRoot.getElementById('past');
    expect(pastInput).not.toBeNull();
  });

  it('past input shows current past value from config', () => {
    const editor = makeEditor({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      past: '2h',
    });
    const pastInput = editor.shadowRoot.getElementById('past');
    expect(pastInput.value).toBe('2h');
  });

  it('past input defaults to "0" when not set in config', () => {
    const editor = makeEditor({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
    });
    const pastInput = editor.shadowRoot.getElementById('past');
    expect(pastInput.value).toBe('0');
  });

  it('emits past value in config-changed event', () => {
    const editor = makeEditor({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      past: '1h',
    });
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor._fireChange();
    expect(events[0].past).toBe('1h');
  });

  it('preserves past in config when other fields change', () => {
    const editor = makeEditor({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '12h',
      past: '3h',
    });
    const events = [];
    editor.addEventListener('config-changed', e => events.push(e.detail.config));
    editor._fireChange();
    expect(events[0].past).toBe('3h');
    expect(events[0].duration).toBe('12h');
  });
});
