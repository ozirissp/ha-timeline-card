# ha-timeline-card

A Home Assistant custom card that displays a configurable timeline of calendar events — perfect for visualizing time-of-use electricity tariffs (HP/HC) or any recurring schedule.

![screenshot](https://raw.githubusercontent.com/your-repo/ha-timeline-card/main/screenshot.png)

## Features

- Fetches events from one or more HA calendar entities in parallel
- Renders a color-coded horizontal timeline strip
- Shows the current state (HC/HP or any label) with a badge
- Shows the next transition with a countdown
- Configurable timeline duration (default 24 h, can be set to any value)
- Refreshes the display every 30 s; re-fetches calendar data every 5 min
- Visual editor (no YAML required)
- HACS compatible

## Installation

### Via HACS (recommended)

1. In HACS → **Frontend** → click the three-dot menu → **Custom repositories**
2. Add `https://github.com/your-repo/ha-timeline-card` with category **Lovelace**
3. Install **HA Timeline Card** from the list
4. Add the resource (HACS usually does this automatically)

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
  - calendar.hc_semaine
  - calendar.hc_weekend
```

### Full example

```yaml
type: custom:ha-timeline-card
calendars:
  - calendar.hc_semaine
  - calendar.hc_weekend
  - calendar.hc_ferie
title: Prochaines 24 heures
hours: 24
hc_color: "#5DCAA5"
hp_color: "#F0997B"
hc_label: HC – heures creuses
hp_label: HP – heures pleines
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `calendars` | list | **required** | One or more HA calendar entity IDs |
| `title` | string | `Prochaines 24 heures` | Label shown above the timeline |
| `hours` | number | `24` | Duration of the timeline window in hours |
| `hc_label` | string | `HC – heures creuses` | Legend label for HC (in-event) periods |
| `hp_label` | string | `HP – heures pleines` | Legend label for HP (out-of-event) periods |
| `hc_color` | string | `#5DCAA5` | Color for HC segments |
| `hp_color` | string | `#F0997B` | Color for HP segments |

> The card treats any time slot covered by at least one calendar event as **HC**; everything else is **HP**.  
> You can use it for any binary schedule — just rename the labels and colors to suit your use case.

## License

MIT
