import resolve from '@rollup/plugin-node-resolve';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const banner = `\
// ha-timeline-card.js — Home Assistant custom card v${pkg.version}
// Generic multi-calendar horizontal timeline
// License: MIT
// Source: https://github.com/ozirissp/ha-timeline-card
`;

export default {
  input: 'src/index.js',
  output: {
    file: 'ha-timeline-card.js',
    format: 'iife',  // Immediately Invoked Function Expression — no module system needed
    name: 'HaTimelineCardBundle',
    banner,
  },
  plugins: [resolve()],
};
