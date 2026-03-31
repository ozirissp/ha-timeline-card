/**
 * Regression tests for the UTC-offset midnight tick bug.
 *
 * Root cause: tick alignment used Math.ceil(windowStartMs / tickMs) * tickMs,
 * which aligns to multiples from the Unix epoch (UTC midnight 1970-01-01).
 * In non-UTC timezones (e.g. UTC+1, UTC+2), local midnight falls at e.g. UTC 23:00
 * or UTC 22:00, which are NOT multiples of tickMs (3h = 10800000ms).
 * Result: firstTick jumps OVER local midnight → no midnight tick generated.
 *
 * Fix: align firstTick to local midnight instead of the epoch.
 * i.e. const localMidnight = new Date(windowStartMs); localMidnight.setHours(0,0,0,0);
 *      firstTick = localMidnight.getTime() + Math.ceil((windowStartMs - localMidnight) / tickMs) * tickMs
 *
 * To test this without changing the process timezone, we patch Date.prototype.getHours
 * to simulate a UTC+1 offset: every Date object reports local hours as UTC hours + 1 (mod 24)
 * and setHours adjusts accordingly. This faithfully replicates the UTC+1 scenario.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HaTimelineCard } from '../../src/timeline-card.js';

if (!customElements.get('ha-timeline-card-utcoff')) {
  customElements.define('ha-timeline-card-utcoff', class extends HaTimelineCard {});
}
if (!customElements.get('ha-card')) {
  customElements.define('ha-card', class extends HTMLElement {});
}

// ── UTC+1 simulation helpers ─────────────────────────────────────────────────
const OFFSET_MS = 1 * 60 * 60 * 1000; // +1h

/** Patch Date instance methods to simulate a UTC+1 local time */
function patchDateForUTCPlus1() {
  const OrigDate = globalThis.Date;

  // Override the methods that depend on local timezone
  const proto = OrigDate.prototype;

  proto._getHours   = proto.getHours;
  proto._getMinutes = proto.getMinutes;
  proto._getSeconds = proto.getSeconds;
  proto._getMilliseconds = proto.getMilliseconds;
  proto._setHours   = proto.setHours;

  proto.getHours   = function () { return new OrigDate(this.getTime() + OFFSET_MS).getUTCHours(); };
  proto.getMinutes = function () { return new OrigDate(this.getTime() + OFFSET_MS).getUTCMinutes(); };
  proto.getSeconds = function () { return new OrigDate(this.getTime() + OFFSET_MS).getUTCSeconds(); };
  proto.getMilliseconds = function () { return new OrigDate(this.getTime() + OFFSET_MS).getUTCMilliseconds(); };
  proto.setHours   = function (h, m = 0, s = 0, ms = 0) {
    // Compute the UTC timestamp that corresponds to h:m:s.ms in UTC+1
    const utcEquiv = OrigDate.UTC(
      this.getUTCFullYear(), this.getUTCMonth(), this.getUTCDate(),
      h, m, s, ms
    ) - OFFSET_MS;
    this.setTime(utcEquiv);
    return this.getTime();
  };
}

function unpatchDate() {
  const proto = globalThis.Date.prototype;
  if (proto._getHours) {
    proto.getHours   = proto._getHours;
    proto.getMinutes = proto._getMinutes;
    proto.getSeconds = proto._getSeconds;
    proto.getMilliseconds = proto._getMilliseconds;
    proto.setHours   = proto._setHours;
    delete proto._getHours;
    delete proto._getMinutes;
    delete proto._getSeconds;
    delete proto._getMilliseconds;
    delete proto._setHours;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Midnight tick — UTC+1 simulation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    patchDateForUTCPlus1();
  });

  afterEach(() => {
    unpatchDate();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  afterAll(() => {
    unpatchDate();
    vi.useRealTimers();
  });

  it('midnight label appears in 24h window starting at 20:00 local (UTC+1)', () => {
    // In UTC+1: "20:00 local" = UTC 19:00
    // tickMs=3h. Epoch-aligned firstTick from UTC 19:00 = UTC 21:00.
    // Local midnight (00:00 UTC+1) = UTC 23:00 — NOT on a 3h UTC boundary.
    // Old code: ticks at UTC 21h,0h,3h... → local hours 22h,1h,4h → NO '0h' tick!
    // Fixed code: aligns to local midnight → tick at UTC 23h = local 0h ✓

    const nowUTC = Date.UTC(2025, 3, 1, 19, 0, 0, 0); // UTC 19:00 = local 20:00 in UTC+1
    vi.setSystemTime(new Date(nowUTC));

    const el = document.createElement('ha-timeline-card-utcoff');
    document.body.appendChild(el);
    el.setConfig({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
      tick_height: 6,
    });
    el._eventsByEntity = {};
    el._updateTimeline();

    const labels = [...el.shadowRoot.getElementById('frise-labels').children];
    const labelTexts = labels.map(l => l.textContent.trim());

    // '0h' must be present — that's local midnight
    expect(labelTexts).toContain('0h');

    // Midnight tick must be taller than base tick_height
    const ticks = [...el.shadowRoot.getElementById('frise-ticks').children];
    const maxHeight = Math.max(...ticks.map(t => parseInt(t.style.height, 10)));
    expect(maxHeight).toBeGreaterThan(6);
  });

  it('midnight label appears in 24h window starting at 22:00 local (UTC+1)', () => {
    // now = UTC 21:00 = local 22:00 in UTC+1
    // tickMs=3h. Epoch-aligned firstTick = UTC 0h (next day).
    // Local midnight = UTC 23:00 — between UTC 21h and UTC 0h next day.
    // Old code: misses UTC 23h because firstTick jumps to UTC 0h directly.
    // Fixed code: aligns to local midnight → tick at UTC 23h = local 0h ✓
    const nowUTC = Date.UTC(2025, 3, 1, 21, 0, 0, 0);
    vi.setSystemTime(new Date(nowUTC));

    const el = document.createElement('ha-timeline-card-utcoff');
    document.body.appendChild(el);
    el.setConfig({
      calendars: [{ entity: 'calendar.a', color: '#fff', label: 'A' }],
      duration: '24h',
      tick_height: 6,
    });
    el._eventsByEntity = {};
    el._updateTimeline();

    const labels = [...el.shadowRoot.getElementById('frise-labels').children];
    const labelTexts = labels.map(l => l.textContent.trim());
    expect(labelTexts).toContain('0h');
  });
});
