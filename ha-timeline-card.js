// ha-timeline-card.js — Home Assistant custom card
// Displays a configurable timeline of calendar events (HP/HC tariffs or any schedule)
// License: MIT

// ─── Visual Editor ────────────────────────────────────────────────────────────

class HaTimelineCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._calendarsPopulated) this._populateCalendars();
  }

  _populateCalendars() {
    if (!this._hass) return;
    const select = this.shadowRoot.getElementById('cal-select');
    if (!select) return;
    this._calendarsPopulated = true;
    const entities = Object.keys(this._hass.states).filter(e => e.startsWith('calendar.'));
    // Remove existing options except the placeholder
    while (select.options.length > 1) select.remove(1);
    entities.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e;
      opt.textContent = e;
      select.appendChild(opt);
    });
  }

  _field(label, id, value, placeholder = '') {
    return `
      <div class="field">
        <label for="${id}">${label}</label>
        <input id="${id}" type="text" value="${this._esc(value)}" placeholder="${placeholder}" />
      </div>`;
  }

  _colorField(label, id, value) {
    return `
      <div class="field field-color">
        <label for="${id}">${label}</label>
        <input id="${id}" type="color" value="${this._esc(value)}" />
      </div>`;
  }

  _esc(v) {
    return (v || '').toString().replace(/"/g, '&quot;');
  }

  _render() {
    const cfg = this._config;
    const cals = Array.isArray(cfg.calendars) ? cfg.calendars.join(', ') : (cfg.calendars || '');
    this.shadowRoot.innerHTML = `
      <style>
        .editor { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 12px; color: var(--secondary-text-color, #888); font-weight: 500; }
        .field input[type="text"] {
          border: 1px solid var(--divider-color, #444);
          border-radius: 6px;
          padding: 6px 10px;
          background: var(--card-background-color, #1c1c1c);
          color: var(--primary-text-color, #e0e0e0);
          font-size: 14px;
        }
        .field-color { flex-direction: row; align-items: center; gap: 10px; }
        .field-color label { flex: 1; }
        input[type="color"] { width: 40px; height: 30px; border: none; border-radius: 4px; cursor: pointer; }
        .hint { font-size: 11px; color: var(--secondary-text-color, #888); margin-top: 2px; }
        select {
          border: 1px solid var(--divider-color, #444);
          border-radius: 6px;
          padding: 6px 10px;
          background: var(--card-background-color, #1c1c1c);
          color: var(--primary-text-color, #e0e0e0);
          font-size: 14px;
        }
        h3 { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em;
             color: var(--secondary-text-color, #888); border-bottom: 1px solid var(--divider-color, #333);
             padding-bottom: 6px; }
      </style>
      <div class="editor">
        <h3>Calendriers</h3>
        <div class="field">
          <label for="calendars">Entités calendrier (séparées par des virgules)</label>
          <input id="calendars" type="text" value="${this._esc(cals)}" placeholder="calendar.hc_semaine, calendar.hc_weekend" />
          <div class="hint">Ou choisissez un calendrier existant :</div>
          <select id="cal-select">
            <option value="">— sélectionner —</option>
          </select>
        </div>

        <h3>Affichage</h3>
        ${this._field('Titre', 'title', cfg.title, 'Prochaines 24 heures')}
        <div class="field">
          <label for="hours">Durée de la frise (heures)</label>
          <input id="hours" type="text" value="${this._esc(cfg.hours || 24)}" placeholder="24" />
        </div>

        <h3>Étiquettes</h3>
        ${this._field('Label état HC', 'hc_label', cfg.hc_label, 'HC – heures creuses')}
        ${this._field('Label état HP', 'hp_label', cfg.hp_label, 'HP – heures pleines')}

        <h3>Couleurs</h3>
        ${this._colorField('Couleur HC', 'hc_color', cfg.hc_color || '#5DCAA5')}
        ${this._colorField('Couleur HP', 'hp_color', cfg.hp_color || '#F0997B')}
      </div>
    `;

    // Wire up cal-select to append to calendars field
    const calSelect = this.shadowRoot.getElementById('cal-select');
    calSelect.addEventListener('change', () => {
      if (!calSelect.value) return;
      const inp = this.shadowRoot.getElementById('calendars');
      const existing = inp.value.split(',').map(s => s.trim()).filter(Boolean);
      if (!existing.includes(calSelect.value)) {
        existing.push(calSelect.value);
        inp.value = existing.join(', ');
      }
      calSelect.value = '';
      this._fireChange();
    });

    this._populateCalendars();

    // Wire up all inputs
    const ids = ['calendars', 'title', 'hours', 'hc_label', 'hp_label', 'hc_color', 'hp_color'];
    ids.forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.addEventListener('change', () => this._fireChange());
    });
  }

  _fireChange() {
    const get = id => this.shadowRoot.getElementById(id)?.value ?? '';
    const rawCals = get('calendars');
    const calendars = rawCals.split(',').map(s => s.trim()).filter(Boolean);
    const hours = parseInt(get('hours'), 10);

    const newConfig = {
      ...this._config,
      calendars,
      title: get('title') || undefined,
      hours: isNaN(hours) ? undefined : hours,
      hc_label: get('hc_label') || undefined,
      hp_label: get('hp_label') || undefined,
      hc_color: get('hc_color') || undefined,
      hp_color: get('hp_color') || undefined,
    };

    // Strip undefined keys
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
    this._events = [];
    this._lastFetch = 0;
    this._fetchInterval = 5 * 60 * 1000; // re-fetch every 5 min
    this._tickInterval = null;
  }

  setConfig(config) {
    if (!config.calendars && !config.calendar) {
      throw new Error('Paramètre "calendars" requis (liste de calendriers)');
    }
    const cals = config.calendars || [config.calendar];
    this._config = {
      calendars: Array.isArray(cals) ? cals : [cals],
      title: config.title || 'Prochaines 24 heures',
      hours: typeof config.hours === 'number' && config.hours > 0 ? config.hours : 24,
      hc_label: config.hc_label || 'HC – heures creuses',
      hp_label: config.hp_label || 'HP – heures pleines',
      hc_color: config.hc_color || '#5DCAA5',
      hp_color: config.hp_color || '#F0997B',
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const now = Date.now();
    if (now - this._lastFetch > this._fetchInterval) {
      this._fetchEvents();
    }
  }

  connectedCallback() {
    this._tickInterval = setInterval(() => this._updateFrise(), 30000);
  }

  disconnectedCallback() {
    if (this._tickInterval) clearInterval(this._tickInterval);
  }

  async _fetchEvents() {
    if (!this._hass) return;
    this._lastFetch = Date.now();

    const hours = this._config.hours;
    const start = new Date();
    // Fetch 1h extra to avoid edge cases at boundary
    const end = new Date(start.getTime() + (hours + 1) * 60 * 60 * 1000);

    try {
      const results = await Promise.all(
        this._config.calendars.map(cal =>
          this._hass.callApi(
            'GET',
            `calendars/${cal}?start=${start.toISOString()}&end=${end.toISOString()}`
          ).catch(e => {
            console.warn(`[ha-timeline-card] Erreur fetch ${cal}:`, e);
            return [];
          })
        )
      );
      this._events = results.flat();
    } catch (e) {
      console.warn('[ha-timeline-card] Erreur fetch calendriers:', e);
      this._events = [];
    }
    this._updateFrise();
  }

  /** Returns true if the moment (nowMs + minuteOffset) falls inside an HC event */
  _isHC(minuteOffset, nowMs) {
    const t = new Date(nowMs + minuteOffset * 60000);
    return this._events.some(ev => {
      const s = new Date(ev.start.dateTime || ev.start.date);
      const e = new Date(ev.end.dateTime || ev.end.date);
      return t >= s && t < e;
    });
  }

  _minutesToLabel(min, nowMs) {
    const t = new Date(nowMs + min * 60000);
    return t.getHours() + 'h';
  }

  _updateFrise() {
    const root = this.shadowRoot;
    if (!root) return;

    const nowMs = Date.now();
    const now = new Date(nowMs);
    const hours = this._config.hours;
    const totalMin = hours * 60;
    const step = 5;

    // ── Current state ──────────────────────────────────────────────────────
    const currentHC = this._isHC(0, nowMs);

    const badge = root.getElementById('badge');
    const stateLabel = root.getElementById('state-label');
    const stateSub = root.getElementById('state-sub');
    if (badge && stateLabel) {
      badge.textContent = currentHC ? 'HC' : 'HP';
      badge.className = 'badge ' + (currentHC ? 'hc' : 'hp');
      stateLabel.textContent = currentHC ? 'Heures Creuses' : 'Heures Pleines';
      stateSub.textContent = currentHC ? 'Tarif réduit actif' : 'Tarif plein actif';
    }

    // ── Next transition ────────────────────────────────────────────────────
    const nextEl = root.getElementById('next-transition');
    if (nextEl) {
      let found = null;
      for (let i = step; i <= totalMin; i += step) {
        if (this._isHC(i, nowMs) !== currentHC) { found = i; break; }
      }
      if (found !== null) {
        const transTime = new Date(nowMs + found * 60000);
        const hh = String(transTime.getHours()).padStart(2, '0');
        const mm = String(transTime.getMinutes()).padStart(2, '0');
        const dh = Math.floor(found / 60);
        const dm = found % 60;
        const deltaStr = dh > 0
          ? `dans ${dh}h${dm > 0 ? String(dm).padStart(2, '0') : ''}`
          : `dans ${dm} min`;
        const toLabel = currentHC ? 'Heures Pleines' : 'Heures Creuses';
        nextEl.innerHTML = `→ <strong>${toLabel}</strong> à ${hh}:${mm} <span class="delta">(${deltaStr})</span>`;
      } else {
        nextEl.textContent = 'Aucune transition détectée';
      }
    }

    // ── Timeline bar ────────────────────────────────────────────────────────
    const friseEl = root.getElementById('frise-bar');
    const labelsEl = root.getElementById('frise-labels');
    if (!friseEl || !labelsEl) return;

    // Build segments
    let segments = [];
    let curState = null, curStart = 0;
    for (let i = 0; i <= totalMin; i += step) {
      const s = this._isHC(i, nowMs) ? 'hc' : 'hp';
      if (s !== curState) {
        if (curState !== null) segments.push({ state: curState, from: curStart, to: i });
        curState = s;
        curStart = i;
      }
    }
    if (curState) segments.push({ state: curState, from: curStart, to: totalMin });

    const cfg = this._config;
    friseEl.innerHTML = '';
    segments.forEach(seg => {
      const div = document.createElement('div');
      const pct = (seg.to - seg.from) / totalMin * 100;
      const color = seg.state === 'hc' ? cfg.hc_color : cfg.hp_color;
      div.style.cssText = `flex:0 0 ${pct}%;height:100%;background:${color};`;
      const label = seg.state === 'hc' ? 'HC' : 'HP';
      div.title = `${label} — ${this._minutesToLabel(seg.from, nowMs)} → ${this._minutesToLabel(seg.to, nowMs)}`;
      friseEl.appendChild(div);
    });

    // ── Time labels ────────────────────────────────────────────────────────
    labelsEl.innerHTML = '';

    // Choose tick density based on duration
    let tickStep;
    if (hours <= 6) tickStep = 1;
    else if (hours <= 12) tickStep = 2;
    else if (hours <= 24) tickStep = 3;
    else tickStep = Math.ceil(hours / 8);

    const ticks = [];
    for (let h = 0; h <= hours; h += tickStep) ticks.push(h);
    if (ticks[ticks.length - 1] !== hours) ticks.push(hours);

    ticks.forEach(h => {
      const span = document.createElement('span');
      const t = new Date(nowMs + h * 60 * 60000);
      const label = h === 0 ? 'Maint.' : t.getHours() + 'h';
      const pct = h / hours * 100;

      let css = `position:absolute;font-size:11px;color:#aaa;`;
      if (h === 0) {
        css += `left:0%;`;
      } else if (h === hours) {
        css += `left:100%;transform:translateX(-100%);`;
      } else {
        css += `left:${pct}%;transform:translateX(-50%);`;
      }
      span.textContent = label;
      span.style.cssText = css;
      labelsEl.appendChild(span);
    });

    // ── Current time marker ────────────────────────────────────────────────
    const timeEl = root.getElementById('current-time');
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
  }

  _render() {
    const cfg = this._config;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          background: var(--card-background-color, #1c1c1c);
          border-radius: 12px;
          padding: 16px 20px 20px;
          font-family: var(--primary-font-family, sans-serif);
          color: var(--primary-text-color, #e0e0e0);
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .header-left { display: flex; align-items: center; gap: 10px; }
        .badge {
          display: inline-block;
          padding: 3px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .badge.hc { background: #0F6E5622; color: #5DCAA5; border: 1px solid #5DCAA540; }
        .badge.hp { background: #993C1D22; color: #F0997B; border: 1px solid #F0997B40; }
        .state-label { font-size: 16px; font-weight: 500; }
        .state-sub { font-size: 12px; color: var(--secondary-text-color, #888); margin-top: 2px; }
        .current-time {
          font-size: 12px;
          color: var(--secondary-text-color, #888);
          font-variant-numeric: tabular-nums;
        }
        .next-line {
          font-size: 13px;
          color: var(--secondary-text-color, #aaa);
          margin-bottom: 14px;
        }
        .next-line strong { color: var(--primary-text-color, #e0e0e0); }
        .delta { color: var(--secondary-text-color, #888); }
        .frise-title {
          font-size: 12px;
          color: var(--secondary-text-color, #888);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
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
          gap: 5px;
          font-size: 12px;
          color: var(--secondary-text-color, #aaa);
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .divider {
          border: none;
          border-top: 1px solid var(--divider-color, #333);
          margin: 14px 0;
        }
      </style>
      <ha-card>
        <div class="card">
          <div class="header">
            <div class="header-left">
              <span id="badge" class="badge hc">HC</span>
              <div>
                <div id="state-label" class="state-label">—</div>
                <div id="state-sub" class="state-sub">—</div>
              </div>
            </div>
            <div id="current-time" class="current-time"></div>
          </div>

          <div id="next-transition" class="next-line">Chargement…</div>

          <hr class="divider">

          <div class="frise-title">${cfg.title}</div>
          <div class="frise-wrap">
            <div id="frise-bar" class="frise-bar"></div>
          </div>
          <div id="frise-labels" class="labels-row"></div>

          <div class="legend">
            <div class="legend-item">
              <div class="legend-dot" style="background:${cfg.hc_color};"></div>
              ${cfg.hc_label}
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background:${cfg.hp_color};"></div>
              ${cfg.hp_label}
            </div>
          </div>
        </div>
      </ha-card>
    `;
    this._updateFrise();
  }

  getCardSize() { return 3; }

  static getConfigElement() {
    return document.createElement('ha-timeline-card-editor');
  }

  static getStubConfig() {
    return {
      calendars: ['calendar.hc_semaine', 'calendar.hc_weekend'],
      hours: 24,
    };
  }
}

customElements.define('ha-timeline-card', HaTimelineCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-timeline-card',
  name: 'HA Timeline Card',
  description: 'Affiche une frise horaire depuis des calendriers Home Assistant (HP/HC ou tout autre planning)',
  preview: true,
  documentationURL: 'https://github.com/your-repo/ha-timeline-card',
});
