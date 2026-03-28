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
  return n * 60 * 60 * 1000;
}

// ─── Calendar group normalizer ────────────────────────────────────────────────
// A calendar entry in YAML can be:
//   { entity: "calendar.xxx", color, label }         ← legacy single entity
//   { entities: ["calendar.a", "calendar.b"], color, label }  ← new multi-entity group
//   "calendar.xxx"                                   ← bare string shorthand
// Returns a normalized group: { entities: [...], color, label }
function _normalizeGroup(c, fallbackColor) {
  if (typeof c === 'string') {
    return { entities: [c], color: fallbackColor, label: c.replace('calendar.', '') };
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

const DEFAULT_COLORS = ['#5DCAA5', '#F0997B', '#7B9FF0', '#F0D97B', '#D07BF0', '#F07BB5', '#7BF0E4'];

// ─── Tick label ───────────────────────────────────────────────────────────────
function tickLabel(tsMs, isFirst, durationMs) {
  const d = new Date(tsMs);
  if (durationMs <= 3 * 60 * 60 * 1000) {
    return isFirst ? 'Maint.' : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  if (durationMs <= 7 * 24 * 60 * 60 * 1000) {
    const hh = d.getHours();
    if (durationMs > 24 * 60 * 60 * 1000 && hh === 0) {
      return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    }
    return isFirst ? 'Maint.' : `${hh}h`;
  }
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

  // Returns normalized groups from current config
  _configGroups() {
    const cals = this._config.calendars;
    if (!Array.isArray(cals)) return [];
    return cals.map((c, i) => _normalizeGroup(c, DEFAULT_COLORS[i % DEFAULT_COLORS.length]));
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

        /* Group card */
        .group-card {
          border: 1px solid var(--divider-color, #333);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: var(--secondary-background-color, #1a1a1a);
        }
        .group-header { display: flex; gap: 8px; align-items: center; }
        .group-header input[type="color"] { width: 32px; height: 28px; border: none; border-radius: 4px; cursor: pointer; padding:0; flex-shrink:0; }
        .group-header input[type="text"] { flex: 1; }
        .group-header button.grp-remove { background: transparent; border: none;
          color: var(--error-color, #e74c3c); cursor: pointer; font-size: 16px; padding: 0 4px; flex-shrink:0; }

        /* Entity tags */
        .entities-wrap { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 28px; }
        .entity-tag {
          display: inline-flex; align-items: center; gap: 4px;
          background: var(--divider-color, #333); border-radius: 12px;
          padding: 2px 8px; font-size: 11px; color: var(--primary-text-color, #e0e0e0);
        }
        .entity-tag button {
          background: none; border: none; color: var(--secondary-text-color, #888);
          cursor: pointer; font-size: 13px; padding: 0; line-height: 1;
        }
        .entity-tag button:hover { color: var(--error-color, #e74c3c); }

        /* Entity picker inside group */
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
    // Populate all pickers (global + per-group)
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

    // Group-level color / label changes
    list.addEventListener('input', e => {
      const card = e.target.closest('.group-card');
      if (!card) return;
      this._fireChange();
    });

    // Remove an entity tag from a group
    list.addEventListener('click', e => {
      // Remove entity tag
      if (e.target.classList.contains('tag-remove')) {
        e.target.closest('.entity-tag').remove();
        this._fireChange();
        return;
      }
      // Remove entire group
      if (e.target.classList.contains('grp-remove')) {
        e.target.closest('.group-card').remove();
        this._fireChange();
        return;
      }
      // Add entity to group
      if (e.target.classList.contains('btn-add-entity')) {
        const card = e.target.closest('.group-card');
        const sel = card.querySelector('.grp-entity-picker');
        if (!sel.value) return;
        const entity = sel.value;
        // Check not already present
        const existing = [...card.querySelectorAll('.entity-tag')].map(t => t.dataset.entity);
        if (existing.includes(entity)) { sel.value = ''; return; }
        // Insert tag
        const wrap = card.querySelector('.entities-wrap');
        const tag = document.createElement('span');
        tag.className = 'entity-tag';
        tag.dataset.entity = entity;
        tag.innerHTML = `${this._esc(entity.replace('calendar.', ''))} <button class="tag-remove" title="Retirer">✕</button>`;
        wrap.appendChild(tag);
        sel.value = '';
        this._fireChange();
        return;
      }
    });

    // Add new empty group
    root.getElementById('btn-add-group').addEventListener('click', () => {
      const list = root.getElementById('cal-list');
      const idx = list.querySelectorAll('.group-card').length;
      const color = DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      const tmp = document.createElement('div');
      tmp.innerHTML = this._groupHtml(idx, { entities: [], color, label: '' });
      list.appendChild(tmp.firstElementChild);
      this._populateCalendarOptions();
      this._fireChange();
    });

    // Duration, title, colors
    ['duration', 'title', 'default_color', 'default_color_text'].forEach(id => {
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

    // Collect groups
    const calendars = [];
    root.querySelectorAll('#cal-list .group-card').forEach(card => {
      const entities = [...card.querySelectorAll('.entity-tag')].map(t => t.dataset.entity).filter(Boolean);
      const color = card.querySelector('.grp-color')?.value || '#5DCAA5';
      const label = card.querySelector('.grp-label')?.value?.trim() || '';
      // Only include groups that have at least one entity
      if (entities.length === 0) return;
      // Use entity (string) if single entity for YAML readability, entities[] if multiple
      if (entities.length === 1) {
        calendars.push({ entity: entities[0], color, label });
      } else {
        calendars.push({ entities, color, label });
      }
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

    this._config = {
      // Normalize all groups: always { entities[], color, label }
      calendars: config.calendars.map((c, i) =>
        _normalizeGroup(c, DEFAULT_COLORS[i % DEFAULT_COLORS.length])
      ).filter(g => g.entities.length > 0),
      duration: config.duration ?? '24h',
      default_color: config.default_color || '#444444',
      title: config.title ?? null,
      show_title: config.show_title !== false,
      show_legend: config.show_legend !== false,
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
    const startMs = Date.now();
    const endMs = startMs + durationMs + 60 * 60 * 1000;
    const start = new Date(startMs).toISOString();
    const end = new Date(endMs).toISOString();

    // Collect all unique entities across all groups
    const allEntities = [...new Set(
      this._config.calendars.flatMap(g => g.entities)
    )];

    const results = await Promise.all(
      allEntities.map(async entity => {
        try {
          const events = await this._hass.callApi('GET',
            `calendars/${entity}?start=${start}&end=${end}`);
          return { entity, events: Array.isArray(events) ? events : [] };
        } catch (e) {
          console.warn(`[ha-timeline-card] Erreur fetch ${entity}:`, e);
          return { entity, events: [] };
        }
      })
    );

    this._eventsByEntity = {};
    results.forEach(({ entity, events }) => {
      this._eventsByEntity[entity] = events.map(ev => ({
        start: _parseEventDate(ev.start),
        end:   _parseEventDate(ev.end),
      }));
    });

    this._updateTimeline();
  }

  // ── Timeline rendering ─────────────────────────────────────────────────────

  /**
   * For a given timestamp (ms), returns the color to display.
   * Groups are evaluated in order (first = highest priority).
   * A group matches if ANY of its entities has an event covering tsMs.
   */
  _colorAt(tsMs) {
    for (const group of this._config.calendars) {
      for (const entity of group.entities) {
        const evs = this._eventsByEntity[entity] || [];
        if (evs.some(ev => tsMs >= ev.start && tsMs < ev.end)) {
          return group.color;
        }
      }
    }
    return this._config.default_color;
  }

  _updateTimeline() {
    const root = this.shadowRoot;
    if (!root) return;

    const nowMs = Date.now();
    const durationMs = parseDuration(this._config.duration);

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
      const tickMs = _chooseTickInterval(durationMs);
      const ticks = [0];
      const firstTick = Math.ceil(nowMs / tickMs) * tickMs;
      for (let t = firstTick; t < nowMs + durationMs; t += tickMs) {
        ticks.push(t - nowMs);
      }
      ticks.push(durationMs);
      const unique = [...new Set(ticks)].sort((a, b) => a - b);

      unique.forEach(offsetMs => {
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
          font-size: 14px; font-weight: 500; text-transform: uppercase;
          letter-spacing: 0.07em; color: var(--secondary-text-color, #888);
          margin-bottom: 12px;
        }
        .frise-wrap { position: relative; }
        .frise-bar { display: flex; height: 36px; border-radius: 6px; overflow: hidden; width: 100%; }
        .labels-row { position: relative; height: 18px; margin-top: 4px; }
        .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color, #aaa); }
        .legend-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
      </style>
      <ha-card>
        ${showTitle ? `<div class="card-title">${_esc(cfg.title)}</div>` : ''}
        <div class="frise-wrap">
          <div id="frise-bar" class="frise-bar"></div>
        </div>
        <div id="frise-labels" class="labels-row"></div>
        ${showLegend ? `
        <div class="legend">
          ${cfg.calendars.map(g => `
            <div class="legend-item">
              <div class="legend-dot" style="background:${_esc(g.color)};"></div>
              ${_esc(g.label)}
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a HA calendar event date object to a timestamp (ms).
 * - dateTime: ISO string with timezone → parse directly.
 * - date (all-day): "YYYY-MM-DD" → parse as LOCAL midnight (not UTC).
 */
function _parseEventDate(dateObj) {
  if (!dateObj) return 0;
  if (dateObj.dateTime) return new Date(dateObj.dateTime).getTime();
  if (dateObj.date) {
    const [y, m, d] = dateObj.date.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  return 0;
}

function _esc(v) {
  return (v == null ? '' : String(v))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
