// index.js — Entry point: registers custom elements and declares card to HA

import { HaTimelineCard } from './timeline-card.js';
import { HaTimelineCardEditor } from './editor.js';

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
