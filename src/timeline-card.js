// timeline-card.js — HaTimelineCard custom element

import {
  DEFAULT_COLORS,
  parseDuration,
  normalizeGroup,
  parseEventDate,
  colorAt,
  chooseTickInterval,
  tickLabel,
  esc,
} from './utils.js';

export class HaTimelineCard extends HTMLElement {
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
    const defaultColor = this._config.default_color;
    const groups = this._config.calendars;

    // Adaptive step: ~1440 samples max
    const STEP_MS = Math.max(60 * 1000, Math.ceil(durationMs / 1440 / 60000) * 60000);

    const friseEl = root.getElementById('frise-bar');
    if (!friseEl) return;

    // Build color segments
    const segments = [];
    let curColor = null;
    let curStart = nowMs;

    for (let t = nowMs; t <= nowMs + durationMs; t += STEP_MS) {
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
      const pct = (seg.to - seg.from) / durationMs * 100;
      div.style.cssText = `flex:0 0 ${pct.toFixed(3)}%;height:100%;background:${seg.color};`;
      const fromStr = new Date(seg.from).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const toStr   = new Date(seg.to).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      div.title = `${fromStr} → ${toStr}`;
      friseEl.appendChild(div);
    });

    // Time labels
    const labelsEl = root.getElementById('frise-labels');
    if (!labelsEl) return;

    labelsEl.innerHTML = '';
    const tickMs = chooseTickInterval(durationMs);
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
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px;
                       color: var(--secondary-text-color, #aaa); }
        .legend-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
      </style>
      <ha-card>
        ${showTitle ? `<div class="card-title">${esc(cfg.title)}</div>` : ''}
        <div class="frise-wrap">
          <div id="frise-bar" class="frise-bar"></div>
        </div>
        <div id="frise-labels" class="labels-row"></div>
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
