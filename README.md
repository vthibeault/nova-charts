# nova-charts

**A fluid, animated chart library where everything is a transition.**

Framework-agnostic. SVG-first. Zero dependencies. Built around one rule: *no code path ever sets a final value directly* — every visual change flows through a spring-physics animation engine, so data updates morph, entrances are choreographed, axes glide, and hover states breathe.

## Why it feels different

- **Retargetable springs everywhere.** Update the data five times a second and the chart never stutters — in-flight animations keep their velocity and curve toward the new target. Interruption isn't an edge case; it's the core mechanic.
- **Per-vertex path morphing.** Every point on a line is an independent spring with a left-to-right stagger, so lines *flow* into new shapes instead of crossfading. Mismatched point counts are reconciled by resampling, then invisibly snapped back.
- **Animated chrome.** Axis ticks and grid lines are keyed, animated citizens: entering ticks fade in, leaving ticks fade out, surviving ticks glide to their new positions.
- **Living interactions.** The crosshair springs between points with a hint of overshoot, the tooltip chases the cursor, hovered marks pop while siblings dim — all spring-driven, all interruptible.
- **Respectful by default.** `prefers-reduced-motion` collapses every animation to an instant update, live. ARIA roles, screen-reader announcements, and keyboard-operable legends are built in.

## Charts

`LineChart` · `AreaChart` · `BarChart` (grouped or stacked) · `DonutChart` (or pie) · `ScatterChart` (or bubble) · `RadarChart` · `GaugeChart` · `HeatmapChart`

## Quick start

```bash
npm install nova-charts
```

```ts
import { LineChart } from 'nova-charts';

const chart = new LineChart(document.querySelector('#chart'), {
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [
      { id: 'revenue', name: 'Revenue', data: [42, 58, 51, 63, 72, 68] },
      { id: 'cost', name: 'Cost', data: [28, 31, 26, 35, 38, 33] },
    ],
  },
  curve: 'catmull-rom',           // 'linear' | 'step' | 'catmull-rom'
});

// The headline feature: every call below is an animated morph.
chart.setData(nextData);          // paths flow to the new shape
chart.toggleSeries('cost');       // series exits, axes re-fit, everything glides
chart.setOptions({ curve: 'linear' });

chart.on('point:enter', (e) => console.log(e.seriesId, e.value));
chart.destroy();
```

### Bar, donut, scatter

```ts
import { BarChart, DonutChart, ScatterChart } from 'nova-charts';

new BarChart(el, {
  data: {
    labels: ['Mon', 'Tue', 'Wed'],
    series: [
      { id: 'online', name: 'Online', data: [62, 71, 55] },
      { id: 'retail', name: 'Retail', data: [34, 29, 41] },
    ],
  },
  stacked: false,  // flip at runtime with setOptions({ stacked: true }) — bars morph between layouts
});

new DonutChart(el, {
  data: { labels: ['Search', 'Direct', 'Social'], series: [{ id: 't', data: [55, 30, 15] }] },
  innerRadius: 0.62,              // 0 = pie; the center total counts up as values change
});

new ScatterChart(el, {
  data: {
    series: [{
      id: 'pts',
      name: 'Points',
      data: [{ x: 12, y: 34, r: 8 }, { x: 45, y: 61, r: 22 }],  // r = bubble size
    }],
  },
});
```

### Radar, gauge, heatmap

```ts
import { RadarChart, GaugeChart, HeatmapChart } from 'nova-charts';

new RadarChart(el, {
  data: {
    labels: ['Speed', 'Power', 'Range', 'Comfort', 'Style'],
    series: [{ id: 'a', name: 'Nova GT', data: [80, 65, 90, 70, 85] }],
  },
  max: 100,
});

const gauge = new GaugeChart(el, {
  data: { series: [{ id: 'cpu', name: 'CPU LOAD', data: [42] }] },
  min: 0, max: 100,
  format: (v) => `${Math.round(v)}%`,
  colorStops: [           // the arc's color springs through rgba space across stops
    { until: 50, color: 'var(--nova-c4)' },
    { until: 80, color: 'var(--nova-c5)' },
    { until: 100, color: 'var(--nova-c7)' },
  ],
});
gauge.setValue(87);        // arc sweeps, color shifts, number counts

new HeatmapChart(el, {
  data: {
    labels: ['6am', '12pm', '6pm'],        // columns
    series: [                              // rows
      { id: 'mon', name: 'Mon', data: [12, 80, 44] },
      { id: 'tue', name: 'Tue', data: [25, 64, 71] },
    ],
  },
  colorRange: ['#312e81', '#22d3ee'],
});
```

## Tuning the motion

```ts
new LineChart(el, {
  data,
  motion: {
    spring: { stiffness: 170, damping: 24 },   // morphs & hover states
    enter: { duration: 900, stagger: 40 },     // entrance choreography
    disabled: false,                            // force-skip all animation
  },
});
```

## Theming

Paint lives in CSS custom properties — override them anywhere in your stylesheet (dark mode comes free with a media query):

```css
.my-dashboard .nova-chart {
  --nova-c1: #f97316;
  --nova-c2: #14b8a6;
  --nova-fg: #e2e8f0;
  --nova-grid: rgba(148, 163, 184, 0.12);
  --nova-tooltip-bg: rgba(15, 23, 42, 0.94);
}
```

Or per chart in JS: `colors: ['#f97316', '#14b8a6']`, `series[i].color`.

## Events

`point:enter` · `point:leave` · `point:click` · `series:toggle`

## Development

```bash
npm install
npm run dev          # demo playground (mash the Randomize buttons)
npm test             # unit + smoke tests
npm run typecheck
npm run build        # ESM + d.ts via tsup
```

The demo playground (`npm run dev`) has a page per chart type with Randomize / add-remove point / legend toggle / live-stream controls, plus a stress page running four charts on offset timers.

## License

MIT
