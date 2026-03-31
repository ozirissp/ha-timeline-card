# ha-timeline-card

A Home Assistant custom Lovelace card that displays a generic, color-coded horizontal timeline of calendar events.

Supports multiple calendars, multi-entity groups, configurable duration, optional past window with a visual "now" marker, optional title and legend with live event times, and a full visual editor — no YAML required.

## Features

- Multi-calendar support: each calendar group gets its own color and label
- **Multi-entity groups**: merge several calendars into a single color/label
- Priority-based overlap: the first group in the list wins when events overlap
- Flexible duration: `24h`, `90m`, `7d`, etc.
- **Past window**: display history before "now" with a visual "now" marker (`past` option)
- Optional title and legend (individually show/hide)
- **Legend with live event times**: each legend entry shows active event bounds (`· 12:00 – 14:00`) or time until next event (`· → 14:00 (1h30)`)
- Visual editor (no YAML required)
- Refreshes display every 30 s; re-fetches calendar data every 5 min
- HACS compatible

## Installation

### Via HACS (recommended)

1. In HACS → **Frontend** → three-dot menu → **Custom repositories**
2. Add `https://github.com/ozirissp/ha-timeline-card` with category **Lovelace**
3. Install **HA Timeline Card** and reload

### Manual

1. Copy `ha-timeline-card.js` to `<config>/www/ha-timeline-card.js`
2. In **Settings → Dashboards → Resources**, add:
   - URL: `/local/ha-timeline-card.js`
   - Type: JavaScript module

## Configuration

### Minimal

```yaml
type: custom:ha-timeline-card
calendars:
  - entity: calendar.my_calendar
    color: "#5DCAA5"
    label: Mon calendrier
```

### Multi-entity group

Multiple calendars can share the same color and label. The group is active if **any** of its entities has an event at a given time.

```yaml
type: custom:ha-timeline-card
calendars:
  - entities:
      - calendar.jours_feries_france
      - calendar.edf_zen_weekend_plus
    color: "#9df07a"
    label: Jours OFF
  - entity: calendar.conges
    color: "#7B9FF0"
    label: Congés
```

### Past window (history before now)

Use `past` to display events from the past in addition to the future. A thin vertical marker indicates the current moment on the timeline.

```yaml
type: custom:ha-timeline-card
duration: 6h      # show 6 hours into the future
past: 2h          # show 2 hours of history before now
calendars:
  - entity: calendar.my_calendar
    color: "#5DCAA5"
    label: Mon calendrier
```

The total visible window is `past + duration` (8 hours in the example above). The "now" marker appears at 25% from the left (2h / 8h).

### Full example

```yaml
type: custom:ha-timeline-card

# Title (hidden if show_title: false)
title: Planning semaine
show_title: true

# Legend (hidden if show_legend: false)
show_legend: true
show_legend_times: true  # show active event bounds or time-to-next in legend

# Duration: number + unit  (h = hours, m = minutes, d = days)
duration: 24h

# Past window: show history before now (0 = disabled, shows no past)
past: 2h

# Color for time slots not covered by any event
default_color: "#444444"

# Groups — listed in priority order (first = highest priority on overlaps)
calendars:
  - entities:
      - calendar.jours_feries_france
      - calendar.edf_zen_weekend_plus
    color: "#9df07a"
    label: Jours OFF
  - entity: calendar.conges
    color: "#7B9FF0"
    label: Congés
  - entity: calendar.astreinte
    color: "#F0997B"
    label: Astreinte
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `calendars` | list | **required** | List of calendar groups (see below) |
| `duration` | string | `24h` | Future window — e.g. `90m`, `24h`, `7d` |
| `past` | string | `0` | Past window before now — e.g. `0` (disabled), `2h`, `30m`, `1d`. Adds a visual "now" marker when > 0 |
| `default_color` | string | `#444444` | Color for time slots with no event |
| `title` | string | — | Card title (empty = no title) |
| `show_title` | boolean | `true` | Show/hide the title |
| `show_legend` | boolean | `true` | Show/hide the legend |
| `show_legend_times` | boolean | `true` | Show live event times in the legend (see below) |

#### Calendar group object

| Field | Type | Default | Description |
|---|---|---|---|
| `entity` | string | — | Single HA calendar entity ID |
| `entities` | list | — | Multiple HA calendar entity IDs (merged into one group) |
| `color` | string | `#5DCAA5` | Hex color for this group's segments |
| `label` | string | entity ID | Legend label |

> Use either `entity` (single) or `entities` (multiple) — not both. Both forms are fully supported and interchangeable.

### Legend event times

When `show_legend_times: true` (the default), each legend entry displays dynamic time information next to the group label:

| Situation | Display example |
|---|---|
| An event is currently active | `HC · 12:00 – 14:00` |
| No active event, next event upcoming | `HC · → 14:00 (1h30)` |
| No event in the visible window | `HC` (label only) |

The suffix is updated automatically at every timeline refresh (every 30 s).

- **Active event**: shows the start and end time of the current event (`HH:MM – HH:MM`).
- **Next event**: shows the start time of the nearest upcoming event and the time remaining in parentheses — `Xh` or `Xh30` for durations ≥ 1 h, `Xmin` for durations < 1 h.

To disable:

```yaml
show_legend_times: false
```

### Duration / Past format

Both `duration` and `past` accept the same format:

| Value | Meaning |
|---|---|
| `0` | Zero / disabled (only valid for `past`) |
| `30m` | 30 minutes |
| `6h` | 6 hours |
| `24h` | 24 hours (`duration` default) |
| `3d` | 3 days |

### Priority (overlapping events)

When two groups have events at the same time, the **first group in the list** takes priority and its color is shown.

## Development

### Prerequisites

```bash
npm install
```

### Project structure

```
src/
  utils.js          # Pure helpers: parseDuration, colorAt, normalizeGroup, etc.
  timeline-card.js  # HaTimelineCard custom element
  editor.js         # HaTimelineCardEditor custom element
  index.js          # Entry point: registers elements, declares card to HA
tests/
  unit/             # TU — pure functions, no DOM
  integration/      # TI — DOM simulation with jsdom + mocked hass
ha-timeline-card.js # Built file (generated by rollup — do not edit manually)
```

### Commands

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Build the distributable file
npm run build
```

### Workflow

1. **New feature** → always create a dedicated branch: `git checkout -b feat/<name>`
2. Write / update tests in `tests/`
3. Implement in `src/`
4. `npm test` — all tests must pass
5. `npm run build` — rebuilds `ha-timeline-card.js`
6. Update `README.md` if the feature adds new config options or behaviors
7. Merge to `main` and create a release

## License

MIT
