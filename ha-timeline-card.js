// ha-timeline-card.js — Home Assistant custom card
// Generic multi-calendar horizontal timeline
// License: MIT

// ─── Duration parser ──────────────────────────────────────────────────────────
// Parses strings like "24h", "90m", "7d", "30s" → milliseconds
// Falls back to numeric value treated as hours for backward compatibility.
function parseDuration(raw) {
  if (!raw) return 24 * 60 * 60 * 1000; // default: 24h
  if (typeof raw === 'number') return raw * 60 * 60 * 1000; // legacy: plain number = hours
  const s = String(raw).trim().toLowerCase();
  const n = parseFloat(s);
  if (isNaN(n) || n <= 0) return 24 * 60 * 60 * 1000;
  if (s.endsWith('d')) return n * 24 * 60 * 60 * 1000;
  if (s.endsWith('h')) return n * 60 * 60 * 1000;
  if (s.endsWith('m')) return n * 60 * 1000;
  if (s.endsWith('s')) return n * 1000;
  // no unit → assume hours
  return n * 60 * 60 * 1000;
}

// Format a tick label from a timestamp and total duration (ms)
function tickLabel(tsMs, isFirst, durationMs) {
  const d = new Date(tsMs);
  if (durationMs <= 3 * 60 * 60 * 1000) {
    // ≤3h → show HH:MM
    return isFirst ? 'Maint.' : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  if (durationMs <= 7 * 24 * 60 * 60 * 1000) {
    // ≤7d → show "HHh" or day+hour
    const hh = d.getHours();
    if (durationMs > 24 * 60 * 60 * 1000 && hh === 0) {
      // Multi-day: mark midnight with day name
      return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    }
    return isFirst ? 'Maint.' : `${hh}h`;
  }
  // >7d → show date
  return isFirst ? 'Auj.' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Visual Editor ────────────────────────────────────────────────────────────

class HaTimelineCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = config ? { ...config } : {};
    this._render();
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

  // Build the list of calendars from config
  _configCals() {
    const cals = this._config.calendars;
    if (!Array.isArray(cals)) return [];
    return cals.map(c => {
      if (typeof c === 'string') return { entity: c, color: '#5DCAA5', label: c };
      return { entity: c.entity || '', color: c.color || '#5DCAA5', label: c.label || c.entity || '' };
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    const cfg = this._config;
    const cals = this._configCals();

    this.shadowRoot.innerHTML = `
      <style>
        .editor { padding: 16px; display: flex; flex-direction: column; gap: 14px; font-family: sans-serif; }
        h3 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;
             color: var(--secondary-text-color, #888); border-bottom: 1px solid var(--divider-color, #333);
             padding-bottom: 6px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 12px; color: var(--secondary-text-color, #888); }
        input[type="text"], input[type="number"], select {
          border: 1px solid var(--divider-color, #444); border-radius: 6px;
          padding: 6px 10px; background: var(--card-background-color, #1c1c1c);
          color: var(--primary-text-color, #e0e0e0); font-size: 14px;
        }
        .row { display: flex; gap: 8px; align-items: center; }
        .row input[type="color"] { width: 36px; height: 30px; border: none; border-radius: 4px; cursor: pointer; padding:0; }
        .row input[type="text"] { flex: 1; }
        .cal-row { display: flex; gap: 6px; align-items: center; padding: 6px 0;
                   border-bottom: 1px solid var(--divider-color, #2a2a2a); }
        .cal-row input[type="text"] { flex: 1; min-width: 0; }
        .cal-row input[type="color"] { width: 32px; height: 28px; border: none; border-radius: 4px; cursor: pointer; padding:0; flex-shrink:0; }
        .cal-row button { background: transparent; border: none; color: var(--error-color, #e74c3c);
                          cursor: pointer; font-size: 16px; flex-shrink:0; padding: 0 4px; }
        .btn-add { align-self: flex-start; margin-top: 4px; padding: 5px 12px; border-radius: 6px;
                   border: 1px solid var(--primary-color, #5DCAA5); color: var(--primary-color, #5DCAA5);
                   background: transparent; cursor: pointer; font-size: 12px; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; }
        .toggle-row label { font-size: 13px; color: var(--primary-text-color, #e0e0e0); }
        input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
        .hint { font-size: 11px; color: var(--secondary-text-color, #888); }
      </style>
      <div class="editor">

        <h3>Calendriers</h3>
        <div id="cal-list">
          ${cals.map((c, i) => this._calRowHtml(i, c)).join('')}
        </div>
        <div class="field">
          <label class="hint">Ajouter depuis HA :</label>
          <div class="row">
            <select id="cal-picker">
              <option value="">— sélectionner —</option>
            </select>
            <button class="btn-add" id="btn-add-cal">+ Ajouter</button>
          </div>
        </div>

        <h3>Durée</h3>
        <div class="field">
          <label>Durée de la frise</label>
          <input id="duration" type="text" value="${this._esc(cfg.duration || '24h')}" placeholder="24h  90m  7d" />
          <span class="hint">Exemples : 24h, 90m, 7d, 48h</span>
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
      </div>
    `;

    this._populateCalendarOptions();
    this._wireEvents();
    this._syncTitleVisibility();
  }

  _calRowHtml(idx, cal) {
    return `
      <div class="cal-row" data-idx="${idx}">
        <input type="color" class="cal-color" value="${this._esc(cal.color)}" title="Couleur" />
        <input type="text" class="cal-entity" value="${this._esc(cal.entity)}" placeholder="calendar.xxx" />
        <input type="text" class="cal-label" value="${this._esc(cal.label)}" placeholder="Légende" />
        <button class="cal-remove" title="Supprimer">✕</button>
      </div>`;
  }

  _populateCalendarOptions() {
    const sel = this.shadowRoot.getElementById('cal-picker');
    if (!sel) return;
    const entities = this._calendarEntities();
    while (sel.options.length > 1) sel.remove(1);
    entities.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e;
      opt.textContent = e;
      sel.appendChild(opt);
    });
  }

  _syncTitleVisibility() {
    const showTitle = this.shadowRoot.getElementById('show_title')?.checked !== false;
    const tf = this.shadowRoot.getElementById('title-field');
    if (tf) tf.style.display = showTitle ? '' : 'none';
  }

  _wireEvents() {
    const root = this.shadowRoot;

    // Calendar rows: color sync + change
    root.getElementById('cal-list').addEventListener('input', e => {
      const row = e.target.closest('.cal-row');
      if (!row) return;
      if (e.target.classList.contains('cal-color')) {
        const txt = row.querySelector('.cal-color-text');
        if (txt) txt.value = e.target.value;
      }
      this._fireChange();
    });

    // Remove calendar row
    root.getElementById('cal-list').addEventListener('click', e => {
      if (!e.target.classList.contains('cal-remove')) return;
      e.target.closest('.cal-row').remove();
      this._fireChange();
    });

    // Add calendar from picker
    root.getElementById('btn-add-cal').addEventListener('click', () => {
      const sel = root.getElementById('cal-picker');
      if (!sel.value) return;
      const entity = sel.value;
      const list = root.getElementById('cal-list');
      const idx = list.querySelectorAll('.cal-row').length;
      const defaultColors = ['#5DCAA5', '#F0997B', '#7B9FF0', '#F0D97B', '#D07BF0'];
      const color = defaultColors[idx % defaultColors.length];
      const tmp = document.createElement('div');
      tmp.innerHTML = this._calRowHtml(idx, { entity, color, label: entity.replace('calendar.', '') });
      list.appendChild(tmp.firstElementChild);
      sel.value = '';
      this._fireChange();
    });

    // Duration, title, colors
    ['duration', 'title', 'default_color', 'default_color_text'].forEach(id => {
      root.getElementById(id)?.addEventListener('change', () => this._fireChange());
    });

    // Sync color ↔ text
    root.getElementById('default_color')?.addEventListener('input', () => {
      root.getElementById('default_color_text').value = root.getElementById('default_color').value;
      this._fireChange();
    });
    root.getElementById('default_color_text')?.addEventListener('input', () => {
      const v = root.getElementById('default_color_text').value;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) root.getElementById('default_color').value = v;
      this._fireChange();
    });

    // Toggle show_title
    root.getElementById('show_title')?.addEventListener('change', () => {
      this._syncTitleVisibility();
      this._fireChange();
    });

    // Toggle show_legend
    root.getElementById('show_legend')?.addEventListener('change', () => this._fireChange());
  }

  _fireChange() {
    const root = this.shadowRoot;
    const get = id => root.getElementById(id)?.value ?? '';
    const checked = id => root.getElementById(id)?.checked ?? true;

    // Collect calendar rows
    const rows = root.querySelectorAll('#cal-list .cal-row');
    const calendars = [];
    rows.forEach(row => {
      const entity = row.querySelector('.cal-entity')?.value?.trim();
      if (!entity) return;
      calendars.push({
        entity,
        color: row.querySelector('.cal-color')?.value || '#5DCAA5',
        label: row.querySelector('.cal-label')?.value?.trim() || entity,
      });
    });

    const newConfig = {
      ...this._config,
      calendars,
      duration: get('duration') || '24h',
      title: get('title') || undefined,
      show_title: checked('show_title'),
      show_legend: checked('show_legend'),
      default_color: get('default_color') || '#444444',
    };

    // Strip undefined
    Object.keys(newConfig).forEach(k => newConfig[k] === undefined && delete newConfig[k]);

    this._config = newConfig;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig }, bubbles: true }));
  }
}

customElements.define('ha-timeline-card-editor', HaTimelineCardEditor);

// ─── Main Card ────────────────────────────────────────────────────────────────

class HaTimelineCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    // Map: entity → [{start, end}]
    this._eventsByCalendar = {};
    this._lastFetch = 0;
    this._fetchInterval = 5 * 60 * 1000;
    this._tickInterval = null;
  }

  // ── Config ─────────────────────────────────────────────────────────────────

  setConfig(config) {
    if (!config.calendars || !Array.isArray(config.calendars) || config.calendars.length === 0) {
      throw new Error('ha-timeline-card: "calendars" est requis (tableau de {entity, color, label})');
    }

    this._config = {
      calendars: config.calendars.map(c =>
        typeof c === 'string'
          ? { entity: c, color: '#5DCAA5', label: c }
          : { entity: c.entity, color: c.color || '#5DCAA5', label: c.label || c.entity }
      ),
      duration: config.duration ?? '24h',
      default_color: config.default_color || '#444444',
      title: config.title ?? null,
      show_title: config.show_title !== false,
      show_legend: config.show_legend !== false,
    };
    // Force re-fetch on every config change (duration may have changed)
    this._lastFetch = 0;
    this._render();
    if (this._hass) this._fetchEvents();
  }

  set hass(hass) {
    this._hass = hass;
    const now = Date.now();
    if (now - this._lastFetch > this._fetchInterval) {
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
    const startMs = Date.now();
    // Fetch a bit extra to cover boundary events
    const endMs = startMs + durationMs + 60 * 60 * 1000;
    const start = new Date(startMs).toISOString();
    const end = new Date(endMs).toISOString();

    const results = await Promise.all(
      this._config.calendars.map(async cal => {
        try {
          const events = await this._hass.callApi('GET',
            `calendars/${cal.entity}?start=${start}&end=${end}`);
          return { entity: cal.entity, events: Array.isArray(events) ? events : [] };
        } catch (e) {
          console.warn(`[ha-timeline-card] Erreur fetch ${cal.entity}:`, e);
          return { entity: cal.entity, events: [] };
        }
      })
    );

    this._eventsByCalendar = {};
    results.forEach(({ entity, events }) => {
      this._eventsByCalendar[entity] = events.map(ev => ({
        start: new Date(ev.start.dateTime || ev.start.date).getTime(),
        end:   new Date(ev.end.dateTime   || ev.end.date).getTime(),
      }));
    });

    this._updateTimeline();
  }

  // ── Timeline rendering ─────────────────────────────────────────────────────

  /**
   * For a given timestamp (ms), returns the color to display.
   * Calendars are evaluated in order: the FIRST calendar in the list that has
   * an event covering that time wins (highest priority = first in list).
   */
  _colorAt(tsMs) {
    for (const cal of this._config.calendars) {
      const evs = this._eventsByCalendar[cal.entity] || [];
      if (evs.some(ev => tsMs >= ev.start && tsMs < ev.end)) {
        return cal.color;
      }
    }
    return this._config.default_color;
  }

  _updateTimeline() {
    const root = this.shadowRoot;
    if (!root) return;

    const nowMs = Date.now();
    const durationMs = parseDuration(this._config.duration);

    // ── Build color segments ─────────────────────────────────────────────────
    // Adaptive step: ~1440 samples max regardless of duration
    const STEP_MS = Math.max(60 * 1000, Math.ceil(durationMs / 1440 / 60000) * 60000);
    const friseEl = root.getElementById('frise-bar');
    if (!friseEl) return;

    let segments = [];
    let curColor = null, curStart = nowMs;
    for (let t = nowMs; t <= nowMs + durationMs; t += STEP_MS) {
      const c = this._colorAt(t);
      if (c !== curColor) {
        if (curColor !== null) segments.push({ color: curColor, from: curStart, to: t });
        curColor = c;
        curStart = t;
      }
    }
    if (curColor) segments.push({ color: curColor, from: curStart, to: nowMs + durationMs });

    friseEl.innerHTML = '';
    segments.forEach(seg => {
      const div = document.createElement('div');
      const pct = (seg.to - seg.from) / durationMs * 100;
      div.style.cssText = `flex:0 0 ${pct.toFixed(3)}%;height:100%;background:${seg.color};`;
      const fromStr = new Date(seg.from).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const toStr   = new Date(seg.to).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      div.title = `${fromStr} → ${toStr}`;
      friseEl.appendChild(div);
    });

    // ── Time labels ──────────────────────────────────────────────────────────
    const labelsEl = root.getElementById('frise-labels');
    if (labelsEl) {
      labelsEl.innerHTML = '';

      // Choose tick interval
      const tickMs = _chooseTickInterval(durationMs);
      // Align first tick to next clean boundary after now
      const ticks = [];
      // Always include t=0 (now)
      ticks.push(0);
      // Round up first interior tick
      const firstTick = Math.ceil(nowMs / tickMs) * tickMs;
      for (let t = firstTick; t < nowMs + durationMs; t += tickMs) {
        ticks.push(t - nowMs);
      }
      ticks.push(durationMs);

      // Deduplicate and sort
      const unique = [...new Set(ticks)].sort((a, b) => a - b);

      unique.forEach((offsetMs, i) => {
        const span = document.createElement('span');
        const tsMs = nowMs + offsetMs;
        const pct = offsetMs / durationMs * 100;
        const label = tickLabel(tsMs, offsetMs === 0, durationMs);

        let css = 'position:absolute;font-size:10px;color:#aaa;white-space:nowrap;';
        if (offsetMs === 0) {
          css += 'left:0%;';
        } else if (offsetMs === durationMs) {
          css += 'left:100%;transform:translateX(-100%);';
        } else {
          css += `left:${pct.toFixed(2)}%;transform:translateX(-50%);`;
        }
        span.textContent = label;
        span.style.cssText = css;
        labelsEl.appendChild(span);
      });
    }
  }

  // ── HTML skeleton ──────────────────────────────────────────────────────────

  _render() {
    const cfg = this._config;
    const showTitle = cfg.show_title && cfg.title;
    const showLegend = cfg.show_legend;

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
          font-size: 14px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--secondary-text-color, #888);
          margin-bottom: 12px;
        }
        .frise-wrap { position: relative; }
        .frise-bar {
          display: flex;
          height: 36px;
          border-radius: 6px;
          overflow: hidden;
          width: 100%;
        }
        .labels-row {
          position: relative;
          height: 18px;
          margin-top: 4px;
        }
        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 10px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--secondary-text-color, #aaa);
        }
        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 3px;
          flex-shrink: 0;
        }
      </style>
      <ha-card>
        ${showTitle ? `<div class="card-title">${_esc(cfg.title)}</div>` : ''}
        <div class="frise-wrap">
          <div id="frise-bar" class="frise-bar"></div>
        </div>
        <div id="frise-labels" class="labels-row"></div>
        ${showLegend ? `
        <div class="legend">
          ${cfg.calendars.map(c => `
            <div class="legend-item">
              <div class="legend-dot" style="background:${_esc(c.color)};"></div>
              ${_esc(c.label)}
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
        { entity: 'calendar.example_a', color: '#5DCAA5', label: 'Calendrier A' },
        { entity: 'calendar.example_b', color: '#F0997B', label: 'Calendrier B' },
      ],
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _esc(v) {
  return (v == null ? '' : String(v))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Choose a tick interval (ms) that gives ~5–9 ticks for the given duration.
 */
function _chooseTickInterval(durationMs) {
  const MINUTE = 60 * 1000;
  const HOUR   = 60 * MINUTE;
  const DAY    = 24 * HOUR;

  const candidates = [
    5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
    HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
    DAY, 2 * DAY, 7 * DAY,
  ];

  for (const c of candidates) {
    const ticks = Math.floor(durationMs / c);
    if (ticks >= 4 && ticks <= 10) return c;
  }
  return candidates[candidates.length - 1];
}

// ─── Registration ─────────────────────────────────────────────────────────────

customElements.define('ha-timeline-card', HaTimelineCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-timeline-card',
  name: 'HA Timeline Card',
  description: 'Frise temporelle multi-calendriers configurable',
  preview: true,
  documentationURL: 'https://github.com/ozirissp/ha-timeline-card',
});
