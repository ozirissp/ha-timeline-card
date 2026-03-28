# ha-timeline-card

A Home Assistant custom Lovelace card that displays a generic, color-coded horizontal timeline of calendar events.

Supports multiple calendars, multi-entity groups, configurable duration, optional title and legend, and a full visual editor — no YAML required.

## Features

- Multi-calendar support: each calendar group gets its own color and label
- **Multi-entity groups**: merge several calendars into a single color/label
- Priority-based overlap: the first group in the list wins when events overlap
- Flexible duration: `24h`, `90m`, `7d`, etc.
- Optional title and legend (individually show/hide)
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

### Full example

```yaml
type: custom:ha-timeline-card

# Title (hidden if show_title: false)
title: Planning semaine
show_title: true

# Legend (hidden if show_legend: false)
show_legend: true

# Duration: number + unit  (h = hours, m = minutes, d = days)
duration: 24h

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
| `duration` | string | `24h` | Timeline window — e.g. `90m`, `24h`, `7d` |
| `default_color` | string | `#444444` | Color for time slots with no event |
| `title` | string | — | Card title (empty = no title) |
| `show_title` | boolean | `true` | Show/hide the title |
| `show_legend` | boolean | `true` | Show/hide the legend |

#### Calendar group object

| Field | Type | Default | Description |
|---|---|---|---|
| `entity` | string | — | Single HA calendar entity ID |
| `entities` | list | — | Multiple HA calendar entity IDs (merged into one group) |
| `color` | string | `#5DCAA5` | Hex color for this group's segments |
| `label` | string | entity ID | Legend label |

> Use either `entity` (single) or `entities` (multiple) — not both. Both forms are fully supported and interchangeable.

### Duration format

| Value | Meaning |
|---|---|
| `30m` | 30 minutes |
| `6h` | 6 hours |
| `24h` | 24 hours (default) |
| `3d` | 3 days |

### Priority (overlapping events)

When two groups have events at the same time, the **first group in the list** takes priority and its color is shown.

## License

MIT
