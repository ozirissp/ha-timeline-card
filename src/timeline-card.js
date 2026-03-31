// timeline-card.js — HaTimelineCard custom element

import {
  DEFAULT_COLORS,
  parseDuration,
  normalizeGroup,
  parseEventDate,
  colorAt,
  chooseTickInterval,
  tickLabel,
  isMidnightTick,
  formatLegendSuffix,
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
      past: config.past ?? '0',
      default_color: config.default_color || '#444444',
      title: config.title ?? null,
      show_title: config.show_title !== false,
      show_legend: config.show_legend !== false,
      show_legend_times: config.show_legend_times !== false,
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

    // Ticks-row must be tall enough for midnight markers (×2.5 the base height)
    ticksEl.style.height = `${Math.round(tickHeight * 2.5)}px`;

    // Choose tick interval based on the total visible window
    const tickMs = chooseTickInterval(totalMs);

    // Build ticks (offsets in ms relative to windowStartMs)
    const rawTicks = [0]; // always include start
    // Align firstTick to LOCAL midnight, not to the Unix epoch (UTC).
    // Without this, in non-UTC timezones (e.g. UTC+1/+2) local midnight falls
    // between two epoch-aligned multiples of tickMs and is never generated.
    const _localMidnight = new Date(windowStartMs);
    _localMidnight.setHours(0, 0, 0, 0);
    const _localMidnightMs = _localMidnight.getTime();
    const firstTick = _localMidnightMs + Math.ceil((windowStartMs - _localMidnightMs) / tickMs) * tickMs;
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

    // Filter out border ticks that are too close to a regular tick
    const filtered = unique.filter(offsetMs => {
      if (offsetMs === 0 || offsetMs === totalMs) {
        return nearestRegularDist(offsetMs) >= THRESHOLD;
      }
      return true;
    });

    // ── Legend times update ──────────────────────────────────────────────────
    if (this._config.show_legend_times) {
      const root2 = this.shadowRoot;
      groups.forEach((group, i) => {
        const span = root2.querySelector(`.legend-info[data-group-idx="${i}"]`);
        if (span) {
          span.textContent = formatLegendSuffix(nowMs, group, this._eventsByEntity);
        }
      });
    }

    filtered.forEach(offsetMs => {
      const tsMs          = windowStartMs + offsetMs;
      const pct           = offsetMs / totalMs * 100;
      const isWindowStart = offsetMs === 0;
      const isNowTick     = hasPast ? offsetMs === pastMs : isWindowStart;
      const color         = isNowTick ? nowColor : tickColor;

      // ── Trait sous la barre (dans .ticks-row) — seulement pour les ticks non-now ──
      if (!isNowTick) {
        const isMidnight = isMidnightTick(tsMs);
        // Midnight ticks: taller (×2.5) and slightly wider (2px) to mark day changes
        const markHeight = isMidnight ? Math.round(tickHeight * 2.5) : tickHeight;
        const markWidth  = isMidnight ? 2 : 1;

        const subMark = document.createElement('div');
        let subCss = `position:absolute;top:0;width:${markWidth}px;height:${markHeight}px;background:${color};pointer-events:none;`;
        if (isWindowStart) {
          subCss += 'left:0%;';
        } else if (offsetMs === totalMs) {
          subCss += `left:100%;transform:translateX(-${markWidth}px);`;
        } else {
          subCss += `left:${pct.toFixed(2)}%;transform:translateX(-50%);`;
        }
        subMark.style.cssText = subCss;
        ticksEl.appendChild(subMark);
      }

      // ── Label ──
      const span = document.createElement('span');
      // "now" tick → toujours un gros point •, jamais un trait
      const labelText = isNowTick
        ? '•'
        : tickLabel(tsMs, isWindowStart, totalMs, false);

      // Taille : gros point pour now (22px), texte normal pour les autres (10px)
      const fontSize = isNowTick ? '22px' : '10px';
      // Ajustement vertical : le • à 22px dépasse un peu, on le remonte légèrement
      const lineHeight = isNowTick ? '1' : 'inherit';

      let labelCss = `position:absolute;font-size:${fontSize};line-height:${lineHeight};white-space:nowrap;color:${color};`;
      if (isWindowStart) {
        labelCss += 'left:0%;';
      } else if (offsetMs === totalMs) {
        labelCss += 'left:100%;transform:translateX(-100%);';
      } else if (isNowTick) {
        labelCss += `left:${pct.toFixed(2)}%;transform:translateX(-50%) translateY(-15%);`;
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
    const showTitle       = cfg.show_title && cfg.title;
    const showLegend      = cfg.show_legend;
    const showLegendTimes = cfg.show_legend_times;
    const tickHeight      = cfg.tick_height;

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
        .now-marker { position: absolute; top: 0; height: 36px; width: 2px; background: rgba(255,255,255,0.85); pointer-events: none; z-index: 2; }
        .ticks-row { position: relative; height: ${Math.round(tickHeight * 2.5)}px; }
        .labels-row { position: relative; height: 18px; margin-top: 2px; }
        .legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px;
                       color: var(--secondary-text-color, #aaa); }
        .legend-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
        .legend-info { opacity: 0.8; font-variant-numeric: tabular-nums; }
      </style>
      <ha-card>
        ${showTitle ? `<div class="card-title">${esc(cfg.title)}</div>` : ''}
        <div class="frise-wrap">
          <div id="frise-bar" class="frise-bar"></div>
          <div id="frise-ticks" class="ticks-row"></div>
          <div id="frise-labels" class="labels-row"></div>
        </div>
        ${showLegend ? `
        <div class="legend">
          ${cfg.calendars.map((g, i) => `
            <div class="legend-item">
              <div class="legend-dot" style="background:${esc(g.color)};"></div>
              ${esc(g.label)}${showLegendTimes ? `<span class="legend-info" data-group-idx="${i}"></span>` : ''}
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
