// ha-timeline-card.js — Home Assistant custom card v0.2.1
// Generic multi-calendar horizontal timeline
// License: MIT
// Source: https://github.com/ozirissp/ha-timeline-card

(function () {
  'use strict';

  // utils.js — Pure helper functions (no DOM, no HA dependency)

  const DEFAULT_COLORS = [
    '#5DCAA5', '#F0997B', '#7B9FF0', '#F0D97B',
    '#D07BF0', '#F07BB5', '#7BF0E4',
  ];

  // ─── Duration parser ──────────────────────────────────────────────────────────
  // Parses strings like "24h", "90m", "7d", "30s" → milliseconds
  // Falls back to numeric value treated as hours for backward compatibility.
  function parseDuration(raw) {
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
  function normalizeGroup(c, fallbackColor) {
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
  function parseEventDate(dateObj) {
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
  function colorAt(tsMs, groups, eventsByEntity, defaultColor) {
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
  function chooseTickInterval(durationMs) {
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
  function tickLabel(tsMs, isFirst, durationMs, isNow = false) {
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

  // ─── HTML escaping ────────────────────────────────────────────────────────────
  function esc(v) {
    return (v == null ? '' : String(v))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // timeline-card.js — HaTimelineCard custom element


  class HaTimelineCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = {};
      this._hass = null;
      // Map: entity string → [{start, end}]
      this._eventsByEntity = {};
      this._lastFetch = 0;
      this._fetchInterval = 5 * 60 * 1000;
      this._tickInterval = null;
    }

    // ── Config ─────────────────────────────────────────────────────────────────

    setConfig(config) {
      if (!config.calendars || !Array.isArray(config.calendars) || config.calendars.length === 0) {
        throw new Error('ha-timeline-card: "calendars" est requis');
      }

      const groups = config.calendars
        .map((c, i) => normalizeGroup(c, DEFAULT_COLORS[i % DEFAULT_COLORS.length]))
        .filter(g => g.entities.length > 0);

      if (groups.length === 0) {
        throw new Error('ha-timeline-card: aucun calendrier valide dans "calendars"');
      }

      this._config = {
        calendars: groups,
        duration: config.duration ?? '24h',
        past: config.past ?? '0',
        default_color: config.default_color || '#444444',
        title: config.title ?? null,
        show_title: config.show_title !== false,
        show_legend: config.show_legend !== false,
        tick_color:  config.tick_color  || '#aaaaaa',
        now_color:   config.now_color   || '#ffffff',
        tick_height: Math.max(1, parseInt(config.tick_height, 10) || 6),
      };

      this._lastFetch = 0;
      this._render();
      if (this._hass) this._fetchEvents();
    }

    set hass(hass) {
      this._hass = hass;
      if (Date.now() - this._lastFetch > this._fetchInterval) {
        this._fetchEvents();
      }
    }

    connectedCallback() {
      this._tickInterval = setInterval(() => this._updateTimeline(), 30000);
    }

    disconnectedCallback() {
      if (this._tickInterval) clearInterval(this._tickInterval);
    }

    // ── Data fetching ──────────────────────────────────────────────────────────

    async _fetchEvents() {
      if (!this._hass) return;
      this._lastFetch = Date.now();

      const durationMs = parseDuration(this._config.duration);
      const pastMs = parseDuration(this._config.past);
      const nowMs = Date.now();
      const startMs = nowMs - pastMs;
      const endMs = nowMs + durationMs + 60 * 60 * 1000;
      const start = new Date(startMs).toISOString();
      const end = new Date(endMs).toISOString();

      // Deduplicate entities across all groups
      const allEntities = [...new Set(this._config.calendars.flatMap(g => g.entities))];

      const results = await Promise.all(
        allEntities.map(async entity => {
          try {
            const events = await this._hass.callApi(
              'GET',
              `calendars/${entity}?start=${start}&end=${end}`,
            );
            return { entity, events: Array.isArray(events) ? events : [] };
          } catch (e) {
            console.warn(`[ha-timeline-card] Erreur fetch ${entity}:`, e);
            return { entity, events: [] };
          }
        }),
      );

      this._eventsByEntity = {};
      results.forEach(({ entity, events }) => {
        this._eventsByEntity[entity] = events.map(ev => ({
          start: parseEventDate(ev.start),
          end:   parseEventDate(ev.end),
        }));
      });

      this._updateTimeline();
    }

    // ── Timeline rendering ─────────────────────────────────────────────────────

    _updateTimeline() {
      const root = this.shadowRoot;
      if (!root) return;

      const nowMs = Date.now();
      const durationMs = parseDuration(this._config.duration);
      const pastMs = parseDuration(this._config.past);
      const totalMs = pastMs + durationMs;
      const windowStartMs = nowMs - pastMs;
      const defaultColor = this._config.default_color;
      const groups = this._config.calendars;
      const hasPast = pastMs > 0;
      const tickColor  = this._config.tick_color;
      const nowColor   = this._config.now_color;
      const tickHeight = this._config.tick_height;

      // Adaptive step: ~1440 samples max over the full window
      const STEP_MS = Math.max(60 * 1000, Math.ceil(totalMs / 1440 / 60000) * 60000);

      const friseEl = root.getElementById('frise-bar');
      if (!friseEl) return;

      // Build color segments over the full window [windowStartMs, nowMs + durationMs]
      const segments = [];
      let curColor = null;
      let curStart = windowStartMs;

      for (let t = windowStartMs; t <= nowMs + durationMs; t += STEP_MS) {
        const c = colorAt(t, groups, this._eventsByEntity, defaultColor);
        if (c !== curColor) {
          if (curColor !== null) segments.push({ color: curColor, from: curStart, to: t });
          curColor = c;
          curStart = t;
        }
      }
      if (curColor !== null) segments.push({ color: curColor, from: curStart, to: nowMs + durationMs });

      friseEl.innerHTML = '';
      segments.forEach(seg => {
        const div = document.createElement('div');
        const pct = (seg.to - seg.from) / totalMs * 100;
        div.style.cssText = `flex:0 0 ${pct.toFixed(3)}%;height:100%;background:${seg.color};`;
        const fromStr = new Date(seg.from).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const toStr   = new Date(seg.to).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        div.title = `${fromStr} → ${toStr}`;
        friseEl.appendChild(div);
      });

      // Now-marker: render inside frise-wrap when past is active
      const friseWrap = root.querySelector('.frise-wrap');
      if (friseWrap) {
        // Remove any existing marker before re-rendering
        friseWrap.querySelector('.now-marker')?.remove();
        if (hasPast) {
          const marker = document.createElement('div');
          marker.className = 'now-marker';
          const nowPct = pastMs / totalMs * 100;
          marker.style.cssText = `position:absolute;top:0;height:36px;left:${nowPct.toFixed(3)}%;width:2px;background:rgba(255,255,255,0.85);pointer-events:none;z-index:2;`;
          friseWrap.appendChild(marker);
        }
      }

      // ── Tick marks + labels ──────────────────────────────────────────────────
      const labelsEl  = root.getElementById('frise-labels');
      const ticksEl   = root.getElementById('frise-ticks');
      if (!labelsEl || !ticksEl) return;

      labelsEl.innerHTML = '';
      ticksEl.innerHTML  = '';

      // Update ticks-row height from config
      ticksEl.style.height = `${tickHeight}px`;

      // Choose tick interval based on the total visible window
      const tickMs = chooseTickInterval(totalMs);

      // Build ticks (offsets in ms relative to windowStartMs)
      const rawTicks = [0]; // always include start
      const firstTick = Math.ceil(windowStartMs / tickMs) * tickMs;
      for (let t = firstTick; t < nowMs + durationMs; t += tickMs) {
        rawTicks.push(t - windowStartMs);
      }
      rawTicks.push(totalMs); // always include end
      if (hasPast) {
        rawTicks.push(pastMs); // "now" tick
      }

      const unique = [...new Set(rawTicks)].sort((a, b) => a - b);

      // Identify regular ticks (not borders, not pastMs)
      const regularTicks = unique.filter(o => o !== 0 && o !== totalMs && !(hasPast && o === pastMs));

      // Collision threshold: 8% of total width
      const THRESHOLD = totalMs * 0.08;

      // Helper: nearest regular tick distance
      const nearestRegularDist = (offsetMs) => {
        if (regularTicks.length === 0) return Infinity;
        return Math.min(...regularTicks.map(r => Math.abs(r - offsetMs)));
      };

      // Is the "now" tick (pastMs) too close to a regular tick?
      const isNowClose = hasPast && nearestRegularDist(pastMs) < THRESHOLD;

      // Filter out border ticks that are too close to a regular tick
      const filtered = unique.filter(offsetMs => {
        if (offsetMs === 0 || offsetMs === totalMs) {
          return nearestRegularDist(offsetMs) >= THRESHOLD;
        }
        return true;
      });

      filtered.forEach(offsetMs => {
        const tsMs        = windowStartMs + offsetMs;
        const pct         = offsetMs / totalMs * 100;
        const isWindowStart = offsetMs === 0;
        const isNowTick   = hasPast ? offsetMs === pastMs : isWindowStart;
        const color       = isNowTick ? nowColor : tickColor;

        // ── Trait dans la barre (bottom de la barre, remonte vers le haut) ──
        const barMark = document.createElement('div');
        let barCss = `position:absolute;bottom:0;width:1px;height:8px;background:${color};opacity:0.45;pointer-events:none;z-index:3;`;
        if (isWindowStart) {
          barCss += 'left:0%;';
        } else if (offsetMs === totalMs) {
          barCss += 'left:100%;transform:translateX(-1px);';
        } else {
          barCss += `left:${pct.toFixed(2)}%;transform:translateX(-50%);`;
        }
        barMark.style.cssText = barCss;
        friseEl.appendChild(barMark);

        // ── Trait sous la barre (dans .ticks-row) ──
        const subMark = document.createElement('div');
        let subCss = `position:absolute;top:0;width:1px;height:${tickHeight}px;background:${color};pointer-events:none;`;
        if (isWindowStart) {
          subCss += 'left:0%;';
        } else if (offsetMs === totalMs) {
          subCss += 'left:100%;transform:translateX(-1px);';
        } else {
          subCss += `left:${pct.toFixed(2)}%;transform:translateX(-50%);`;
        }
        subMark.style.cssText = subCss;
        ticksEl.appendChild(subMark);

        // ── Label ──
        const span = document.createElement('span');
        // "now" tick trop proche d'un régulier → point, sinon label texte
        const labelText = (isNowTick && isNowClose)
          ? '•'
          : tickLabel(tsMs, isWindowStart, totalMs, isNowTick);

        let labelCss = `position:absolute;font-size:10px;white-space:nowrap;color:${color};`;
        if (isWindowStart) {
          labelCss += 'left:0%;';
        } else if (offsetMs === totalMs) {
          labelCss += 'left:100%;transform:translateX(-100%);';
        } else {
          labelCss += `left:${pct.toFixed(2)}%;transform:translateX(-50%);`;
        }
        span.textContent = labelText;
        span.style.cssText = labelCss;
        labelsEl.appendChild(span);
      });
    }

    // ── HTML skeleton ──────────────────────────────────────────────────────────

    _render() {
      const cfg = this._config;
      const showTitle  = cfg.show_title && cfg.title;
      const showLegend = cfg.show_legend;
      const tickHeight = cfg.tick_height;

      this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          padding: 16px 20px 20px;
          font-family: var(--primary-font-family, sans-serif);
          color: var(--primary-text-color, #e0e0e0);
          box-sizing: border-box;
        }
        .card-title {
          font-size: 14px; font-weight: 500; text-transform: uppercase;
          letter-spacing: 0.07em; color: var(--secondary-text-color, #888);
          margin-bottom: 12px;
        }
        .frise-wrap { position: relative; }
        /* Wrapper pour préserver les border-radius tout en laissant dépasser les traits */
        .frise-bar-wrap { border-radius: 6px; overflow: hidden; width: 100%; }
        .frise-bar { display: flex; height: 36px; width: 100%; position: relative; }
        .now-marker { position: absolute; top: 0; height: 36px; width: 2px; background: rgba(255,255,255,0.85); pointer-events: none; z-index: 2; }
        .ticks-row { position: relative; height: ${tickHeight}px; }
        .labels-row { position: relative; height: 18px; margin-top: 2px; }
        .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px;
                       color: var(--secondary-text-color, #aaa); }
        .legend-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
      </style>
      <ha-card>
        ${showTitle ? `<div class="card-title">${esc(cfg.title)}</div>` : ''}
        <div class="frise-wrap">
          <div class="frise-bar-wrap">
            <div id="frise-bar" class="frise-bar"></div>
          </div>
          <div id="frise-ticks" class="ticks-row"></div>
          <div id="frise-labels" class="labels-row"></div>
        </div>
        ${showLegend ? `
        <div class="legend">
          ${cfg.calendars.map(g => `
            <div class="legend-item">
              <div class="legend-dot" style="background:${esc(g.color)};"></div>
              ${esc(g.label)}
            </div>`).join('')}
        </div>` : ''}
      </ha-card>
    `;

      this._updateTimeline();
    }

    getCardSize() { return 2; }

    static getConfigElement() {
      return document.createElement('ha-timeline-card-editor');
    }

    static getStubConfig() {
      return {
        duration: '24h',
        default_color: '#444444',
        show_title: true,
        show_legend: true,
        title: 'Mon planning',
        calendars: [
          { entities: ['calendar.example_a', 'calendar.example_b'], color: '#5DCAA5', label: 'Groupe fusionné' },
          { entity: 'calendar.example_c', color: '#F0997B', label: 'Calendrier seul' },
        ],
      };
    }
  }

  // editor.js — HaTimelineCardEditor custom element (visual editor for HA)


  class HaTimelineCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = {};
      this._hass = null;
    }

    setConfig(config) {
      this._config = config ? { ...config } : {};
      // Only full-render once (shadowRoot empty).
      // Subsequent setConfig calls come from HA reflecting our own config-changed
      // event back — re-rendering would lose focused input state.
      if (!this.shadowRoot.getElementById('cal-list')) {
        this._render();
      }
    }

    set hass(hass) {
      this._hass = hass;
      this._populateCalendarOptions();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    _esc(v) { return (v == null ? '' : String(v)).replace(/"/g, '&quot;'); }

    _calendarEntities() {
      if (!this._hass) return [];
      return Object.keys(this._hass.states).filter(e => e.startsWith('calendar.')).sort();
    }

    _configGroups() {
      const cals = this._config.calendars;
      if (!Array.isArray(cals)) return [];
      return cals.map((c, i) => normalizeGroup(c, DEFAULT_COLORS[i % DEFAULT_COLORS.length]));
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    _render() {
      const cfg = this._config;
      const groups = this._configGroups();

      this.shadowRoot.innerHTML = `
      <style>
        .editor { padding: 16px; display: flex; flex-direction: column; gap: 14px; font-family: sans-serif; }
        h3 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;
             color: var(--secondary-text-color, #888); border-bottom: 1px solid var(--divider-color, #333);
             padding-bottom: 6px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 12px; color: var(--secondary-text-color, #888); }
        input[type="text"], select {
          border: 1px solid var(--divider-color, #444); border-radius: 6px;
          padding: 6px 10px; background: var(--card-background-color, #1c1c1c);
          color: var(--primary-text-color, #e0e0e0); font-size: 14px;
        }
        .row { display: flex; gap: 8px; align-items: center; }
        .row input[type="color"] { width: 36px; height: 30px; border: none; border-radius: 4px; cursor: pointer; padding:0; }
        .row input[type="text"] { flex: 1; }
        .group-card {
          border: 1px solid var(--divider-color, #333); border-radius: 8px; padding: 10px 12px;
          display: flex; flex-direction: column; gap: 8px;
          background: var(--secondary-background-color, #1a1a1a);
        }
        .group-header { display: flex; gap: 8px; align-items: center; }
        .group-header input[type="color"] { width: 32px; height: 28px; border: none; border-radius: 4px; cursor: pointer; padding:0; flex-shrink:0; }
        .group-header input[type="text"] { flex: 1; }
        .group-header button.grp-remove { background: transparent; border: none;
          color: var(--error-color, #e74c3c); cursor: pointer; font-size: 16px; padding: 0 4px; flex-shrink:0; }
        .entities-wrap { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 28px; }
        .entity-tag { display: inline-flex; align-items: center; gap: 4px;
          background: var(--divider-color, #333); border-radius: 12px;
          padding: 2px 8px; font-size: 11px; color: var(--primary-text-color, #e0e0e0); }
        .entity-tag button { background: none; border: none; color: var(--secondary-text-color, #888);
          cursor: pointer; font-size: 13px; padding: 0; line-height: 1; }
        .entity-tag button:hover { color: var(--error-color, #e74c3c); }
        .entity-add-row { display: flex; gap: 6px; align-items: center; }
        .entity-add-row select { flex: 1; font-size: 12px; padding: 4px 8px; }
        .btn-add-entity { padding: 4px 10px; border-radius: 6px; font-size: 11px;
          border: 1px solid var(--primary-color, #5DCAA5); color: var(--primary-color, #5DCAA5);
          background: transparent; cursor: pointer; white-space: nowrap; }
        .btn-add-group { align-self: flex-start; padding: 5px 12px; border-radius: 6px;
          border: 1px solid var(--primary-color, #5DCAA5); color: var(--primary-color, #5DCAA5);
          background: transparent; cursor: pointer; font-size: 12px; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; }
        .toggle-row label { font-size: 13px; color: var(--primary-text-color, #e0e0e0); }
        input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
        .hint { font-size: 11px; color: var(--secondary-text-color, #888); }
      </style>
      <div class="editor">
        <h3>Groupes de calendriers</h3>
        <div id="cal-list">
          ${groups.map((g, i) => this._groupHtml(i, g)).join('')}
        </div>
        <button class="btn-add-group" id="btn-add-group">+ Nouveau groupe</button>

        <h3>Durée</h3>
        <div class="field">
          <label>Durée de la frise (futur)</label>
          <input id="duration" type="text" value="${this._esc(cfg.duration || '24h')}" placeholder="24h  90m  7d" />
          <span class="hint">Exemples : 24h, 90m, 7d, 48h</span>
        </div>
        <div class="field">
          <label>Passé affiché (avant maintenant)</label>
          <input id="past" type="text" value="${this._esc(cfg.past ?? '0')}" placeholder="0  2h  30m  1d" />
          <span class="hint">Exemples : 0 (désactivé), 2h, 30m, 1d — affiche un repère "maintenant"</span>
        </div>

        <h3>Affichage</h3>
        <div class="toggle-row">
          <label for="show_title">Afficher le titre</label>
          <input id="show_title" type="checkbox" ${cfg.show_title !== false ? 'checked' : ''} />
        </div>
        <div class="field" id="title-field">
          <label>Titre</label>
          <input id="title" type="text" value="${this._esc(cfg.title)}" placeholder="Mon planning" />
        </div>
        <div class="toggle-row">
          <label for="show_legend">Afficher la légende</label>
          <input id="show_legend" type="checkbox" ${cfg.show_legend !== false ? 'checked' : ''} />
        </div>

        <h3>Couleur par défaut</h3>
        <div class="field">
          <label>Couleur hors événement</label>
          <div class="row">
            <input id="default_color" type="color" value="${this._esc(cfg.default_color || '#444444')}" />
            <input id="default_color_text" type="text" value="${this._esc(cfg.default_color || '#444444')}" placeholder="#444444" />
          </div>
        </div>

        <h3>Graduation temporelle</h3>
        <div class="field">
          <label>Couleur des graduations (heures)</label>
          <div class="row">
            <input id="tick_color" type="color" value="${this._esc(cfg.tick_color || '#aaaaaa')}" />
            <input id="tick_color_text" type="text" value="${this._esc(cfg.tick_color || '#aaaaaa')}" placeholder="#aaaaaa" />
          </div>
        </div>
        <div class="field">
          <label>Couleur "Maintenant"</label>
          <div class="row">
            <input id="now_color" type="color" value="${this._esc(cfg.now_color || '#ffffff')}" />
            <input id="now_color_text" type="text" value="${this._esc(cfg.now_color || '#ffffff')}" placeholder="#ffffff" />
          </div>
        </div>
        <div class="field">
          <label>Hauteur des traits (px)</label>
          <input id="tick_height" type="text" value="${this._esc(cfg.tick_height ?? '6')}" placeholder="6" />
          <span class="hint">Hauteur de la graduation visible sous la barre (ex : 4, 6, 8)</span>
        </div>
      </div>
    `;

      this._populateCalendarOptions();
      this._wireEvents();
      this._syncTitleVisibility();
    }

    _groupHtml(idx, group) {
      const tagsHtml = group.entities.map(e => `
      <span class="entity-tag" data-entity="${this._esc(e)}">
        ${this._esc(e.replace('calendar.', ''))}
        <button class="tag-remove" title="Retirer">✕</button>
      </span>`).join('');

      return `
      <div class="group-card" data-idx="${idx}">
        <div class="group-header">
          <input type="color" class="grp-color" value="${this._esc(group.color)}" title="Couleur du groupe" />
          <input type="text" class="grp-label" value="${this._esc(group.label)}" placeholder="Légende du groupe" />
          <button class="grp-remove" title="Supprimer le groupe">✕</button>
        </div>
        <div class="entities-wrap">
          ${tagsHtml}
        </div>
        <div class="entity-add-row">
          <select class="grp-entity-picker">
            <option value="">— ajouter un calendrier —</option>
          </select>
          <button class="btn-add-entity">+ Ajouter</button>
        </div>
      </div>`;
    }

    _populateCalendarOptions() {
      const entities = this._calendarEntities();
      this.shadowRoot.querySelectorAll('.grp-entity-picker').forEach(sel => {
        const current = sel.value;
        while (sel.options.length > 1) sel.remove(1);
        entities.forEach(e => {
          const opt = document.createElement('option');
          opt.value = e;
          opt.textContent = e;
          sel.appendChild(opt);
        });
        sel.value = current;
      });
    }

    _syncTitleVisibility() {
      const showTitle = this.shadowRoot.getElementById('show_title')?.checked !== false;
      const tf = this.shadowRoot.getElementById('title-field');
      if (tf) tf.style.display = showTitle ? '' : 'none';
    }

    _wireEvents() {
      const root = this.shadowRoot;
      const list = root.getElementById('cal-list');

      list.addEventListener('input', e => {
        if (e.target.closest('.group-card')) this._fireChange();
      });

      list.addEventListener('click', e => {
        if (e.target.classList.contains('tag-remove')) {
          e.target.closest('.entity-tag').remove();
          this._fireChange();
          return;
        }
        if (e.target.classList.contains('grp-remove')) {
          e.target.closest('.group-card').remove();
          this._fireChange();
          return;
        }
        if (e.target.classList.contains('btn-add-entity')) {
          const card = e.target.closest('.group-card');
          const sel = card.querySelector('.grp-entity-picker');
          if (!sel.value) return;
          const entity = sel.value;
          const existing = [...card.querySelectorAll('.entity-tag')].map(t => t.dataset.entity);
          if (existing.includes(entity)) { sel.value = ''; return; }
          const wrap = card.querySelector('.entities-wrap');
          const tag = document.createElement('span');
          tag.className = 'entity-tag';
          tag.dataset.entity = entity;
          tag.innerHTML = `${this._esc(entity.replace('calendar.', ''))} <button class="tag-remove" title="Retirer">✕</button>`;
          wrap.appendChild(tag);
          sel.value = '';
          this._fireChange();
        }
      });

      root.getElementById('btn-add-group').addEventListener('click', () => {
        const idx = root.getElementById('cal-list').querySelectorAll('.group-card').length;
        const color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
        const tmp = document.createElement('div');
        tmp.innerHTML = this._groupHtml(idx, { entities: [], color, label: '' });
        root.getElementById('cal-list').appendChild(tmp.firstElementChild);
        this._populateCalendarOptions();
        this._fireChange();
      });

      ['duration', 'past', 'title', 'default_color', 'default_color_text', 'tick_height'].forEach(id => {
        root.getElementById(id)?.addEventListener('change', () => this._fireChange());
      });

      root.getElementById('default_color')?.addEventListener('input', () => {
        root.getElementById('default_color_text').value = root.getElementById('default_color').value;
        this._fireChange();
      });
      root.getElementById('default_color_text')?.addEventListener('input', () => {
        const v = root.getElementById('default_color_text').value;
        if (/^#[0-9a-fA-F]{6}$/.test(v)) root.getElementById('default_color').value = v;
        this._fireChange();
      });

      root.getElementById('tick_color')?.addEventListener('input', () => {
        root.getElementById('tick_color_text').value = root.getElementById('tick_color').value;
        this._fireChange();
      });
      root.getElementById('tick_color_text')?.addEventListener('input', () => {
        const v = root.getElementById('tick_color_text').value;
        if (/^#[0-9a-fA-F]{6}$/.test(v)) root.getElementById('tick_color').value = v;
        this._fireChange();
      });

      root.getElementById('now_color')?.addEventListener('input', () => {
        root.getElementById('now_color_text').value = root.getElementById('now_color').value;
        this._fireChange();
      });
      root.getElementById('now_color_text')?.addEventListener('input', () => {
        const v = root.getElementById('now_color_text').value;
        if (/^#[0-9a-fA-F]{6}$/.test(v)) root.getElementById('now_color').value = v;
        this._fireChange();
      });

      root.getElementById('show_title')?.addEventListener('change', () => {
        this._syncTitleVisibility();
        this._fireChange();
      });
      root.getElementById('show_legend')?.addEventListener('change', () => this._fireChange());
    }

    _fireChange() {
      const root = this.shadowRoot;
      const get = id => root.getElementById(id)?.value ?? '';
      const checked = id => root.getElementById(id)?.checked ?? true;

      const calendars = [];
      root.querySelectorAll('#cal-list .group-card').forEach(card => {
        const entities = [...card.querySelectorAll('.entity-tag')]
          .map(t => t.dataset.entity)
          .filter(Boolean);
        const color = card.querySelector('.grp-color')?.value || '#5DCAA5';
        const label = card.querySelector('.grp-label')?.value?.trim() || '';
        // Groups with no entities are kept in the config so they survive
        // the setConfig() reflection from HA and remain visible in the editor.
        if (entities.length === 0) {
          calendars.push({ entities: [], color, label });
        } else if (entities.length === 1) {
          // Single entity → use `entity` key for cleaner YAML
          calendars.push({ entity: entities[0], color, label });
        } else {
          calendars.push({ entities, color, label });
        }
      });

      const newConfig = {
        ...this._config,
        calendars,
        duration: get('duration') || '24h',
        past: get('past') || '0',
        title: get('title') || undefined,
        show_title: checked('show_title'),
        show_legend: checked('show_legend'),
        default_color: get('default_color') || '#444444',
        tick_color:  get('tick_color')  || '#aaaaaa',
        now_color:   get('now_color')   || '#ffffff',
        tick_height: get('tick_height') || '6',
      };

      Object.keys(newConfig).forEach(k => newConfig[k] === undefined && delete newConfig[k]);
      this._config = newConfig;
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig }, bubbles: true }));
    }
  }

  // index.js — Entry point: registers custom elements and declares card to HA


  customElements.define('ha-timeline-card-editor', HaTimelineCardEditor);
  customElements.define('ha-timeline-card', HaTimelineCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'ha-timeline-card',
    name: 'HA Timeline Card',
    description: 'Frise temporelle multi-calendriers configurable',
    preview: true,
    documentationURL: 'https://github.com/ozirissp/ha-timeline-card',
  });

})();
