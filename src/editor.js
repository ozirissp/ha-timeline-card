// editor.js — HaTimelineCardEditor custom element (visual editor for HA)

import { DEFAULT_COLORS, normalizeGroup, esc as _esc } from './utils.js';

export class HaTimelineCardEditor extends HTMLElement {
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
