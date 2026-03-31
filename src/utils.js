// utils.js — Pure helper functions (no DOM, no HA dependency)

export const DEFAULT_COLORS = [
  '#5DCAA5', '#F0997B', '#7B9FF0', '#F0D97B',
  '#D07BF0', '#F07BB5', '#7BF0E4',
];

// ─── Duration parser ──────────────────────────────────────────────────────────
// Parses strings like "24h", "90m", "7d", "30s" → milliseconds
// Falls back to numeric value treated as hours for backward compatibility.
export function parseDuration(raw) {
  if (!raw && raw !== 0) return 24 * 60 * 60 * 1000;
  if (typeof raw === 'number') {
    if (raw === 0) return 0;
    return raw * 60 * 60 * 1000;
  }
  const s = String(raw).trim().toLowerCase();
  // Bare "0" (no unit suffix) = explicit zero, used e.g. for past: '0'
  if (s === '0') return 0;
  const n = parseFloat(s);
  if (isNaN(n) || n <= 0) return 24 * 60 * 60 * 1000;
  if (s.endsWith('d')) return n * 24 * 60 * 60 * 1000;
  if (s.endsWith('h')) return n * 60 * 60 * 1000;
  if (s.endsWith('m')) return n * 60 * 1000;
  if (s.endsWith('s')) return n * 1000;
  return n * 60 * 60 * 1000;
}

// ─── Calendar group normalizer ────────────────────────────────────────────────
// Accepts:
//   "calendar.xxx"                             → bare string
//   { entity: "calendar.xxx", color, label }   → legacy single entity
//   { entities: ["cal.a", "cal.b"], color, label } → new multi-entity group
// Always returns: { entities: [...], color, label }
export function normalizeGroup(c, fallbackColor) {
  if (typeof c === 'string') {
    return {
      entities: [c],
      color: fallbackColor,
      label: c.replace('calendar.', ''),
    };
  }
  const entities = Array.isArray(c.entities)
    ? c.entities.filter(Boolean)
    : c.entity
      ? [c.entity]
      : [];
  return {
    entities,
    color: c.color || fallbackColor,
    label: c.label || entities[0] || '',
  };
}

// ─── Event date parser ────────────────────────────────────────────────────────
// Parses a HA calendar event date object { dateTime } or { date } to ms.
// All-day events use "YYYY-MM-DD" → parsed as LOCAL midnight to avoid UTC offset.
export function parseEventDate(dateObj) {
  if (!dateObj) return 0;
  if (dateObj.dateTime) return new Date(dateObj.dateTime).getTime();
  if (dateObj.date) {
    const [y, m, d] = dateObj.date.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  return 0;
}

// ─── Color resolver ───────────────────────────────────────────────────────────
// Given a timestamp (ms), returns the color of the first matching group,
// or defaultColor if no group has an active event at that time.
// eventsByEntity: Map<entityId, [{start, end}]>
export function colorAt(tsMs, groups, eventsByEntity, defaultColor) {
  for (const group of groups) {
    for (const entity of group.entities) {
      const evs = eventsByEntity[entity] || [];
      if (evs.some(ev => tsMs >= ev.start && tsMs < ev.end)) {
        return group.color;
      }
    }
  }
  return defaultColor;
}

// ─── Tick interval chooser ────────────────────────────────────────────────────
// Returns a tick interval (ms) that produces ~4–10 ticks for the given duration.
export function chooseTickInterval(durationMs) {
  const MINUTE = 60 * 1000;
  const HOUR   = 60 * MINUTE;
  const DAY    = 24 * HOUR;
  const candidates = [
    5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
    HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
    DAY, 2 * DAY, 7 * DAY,
  ];
  for (const c of candidates) {
    if (Math.floor(durationMs / c) >= 4 && Math.floor(durationMs / c) <= 10) return c;
  }
  return candidates[candidates.length - 1];
}

// ─── Tick label formatter ─────────────────────────────────────────────────────
// isNow: true when the tick represents the current moment (shows "Maint." / "Auj.")
// isFirst: true when the tick is at the very start of the displayed window
export function tickLabel(tsMs, isFirst, durationMs, isNow = false) {
  const d = new Date(tsMs);
  if (durationMs <= 3 * 60 * 60 * 1000) {
    return isNow
      ? 'Maint.'
      : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (durationMs <= 7 * 24 * 60 * 60 * 1000) {
    const hh = d.getHours();
    if (durationMs > 24 * 60 * 60 * 1000 && hh === 0 && !isNow) {
      return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    }
    return isNow ? 'Maint.' : `${hh}h`;
  }
  return isNow ? 'Auj.' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Midnight tick detector ───────────────────────────────────────────────────
// Returns true when the given timestamp (ms) falls exactly at local midnight
// (00:00:00.000), i.e. a day boundary.
export function isMidnightTick(tsMs) {
  const d = new Date(tsMs);
  return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
}

// ─── HTML escaping ────────────────────────────────────────────────────────────
export function esc(v) {
  return (v == null ? '' : String(v))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
