import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LineChart } from './line.js';
import { AreaChart } from './area.js';
import { BarChart } from './bar.js';
import { ScatterChart } from './scatter.js';
import { DonutChart } from './donut.js';
import { RadarChart } from './radar.js';
import { GaugeChart } from './gauge.js';
import { HeatmapChart } from './heatmap.js';
import { PolarAreaChart } from './polar.js';
import { FunnelChart } from './funnel.js';
import { WaterfallChart } from './waterfall.js';
import { CandlestickChart } from './candlestick.js';
import { GanttChart } from './gantt.js';
import { forceReducedMotion } from '../motion/reduced-motion.js';
import type { ChartData } from '../core/types.js';

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const data = (): ChartData => ({
  labels: ['a', 'b', 'c', 'd'],
  series: [
    { id: 's1', name: 'One', data: [1, 3, 2, 5] },
    { id: 's2', name: 'Two', data: [2, 1, 4, 3] },
  ],
});

beforeEach(() => forceReducedMotion(true));
afterEach(() => {
  forceReducedMotion(null);
  document.body.textContent = '';
});

describe('LineChart smoke', () => {
  it('renders an svg with one path per series and aria metadata', () => {
    const el = host();
    const chart = new LineChart(el, { data: data() });
    const svg = el.querySelector('svg')!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toContain('Line chart');
    const paths = svg.querySelectorAll('path[stroke]');
    expect(paths.length).toBe(2);
    for (const p of paths) {
      expect(p.getAttribute('d')).toMatch(/^M/);
    }
    chart.destroy();
  });

  it('setData with different point counts does not throw', () => {
    const el = host();
    const chart = new LineChart(el, { data: data() });
    expect(() =>
      chart.setData({
        labels: ['a', 'b', 'c', 'd', 'e', 'f'],
        series: [{ id: 's1', name: 'One', data: [1, 2, 3, 4, 5, 6] }],
      }),
    ).not.toThrow();
    chart.destroy();
  });

  it('toggleSeries hides marks and emits the event', () => {
    const el = host();
    const chart = new LineChart(el, { data: data() });
    let event: { id: string; visible: boolean } | null = null;
    chart.on('series:toggle', (e) => (event = e));
    chart.toggleSeries('s2');
    expect(event).toEqual({ id: 's2', visible: false });
    expect(chart.isSeriesVisible('s2')).toBe(false);
    // reduced motion => exit is immediate, path removed
    expect(el.querySelectorAll('svg path[stroke]').length).toBe(1);
    chart.toggleSeries('s2');
    expect(el.querySelectorAll('svg path[stroke]').length).toBe(2);
    chart.destroy();
  });

  it('renders a legend with pressable buttons', () => {
    const el = host();
    const chart = new LineChart(el, { data: data() });
    const buttons = el.querySelectorAll('.nova-legend button');
    expect(buttons.length).toBe(2);
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    chart.destroy();
  });

  it('destroy removes everything it created', () => {
    const el = host();
    const chart = new LineChart(el, { data: data() });
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('.nova-overlay')).toBeNull();
    expect(el.classList.contains('nova-chart')).toBe(false);
  });
});

describe('AreaChart smoke', () => {
  it('renders fill paths under the lines', () => {
    const el = host();
    const chart = new AreaChart(el, { data: data() });
    const fills = el.querySelectorAll('svg path[fill]:not([fill="none"])');
    expect(fills.length).toBe(2);
    for (const f of fills) {
      expect(f.getAttribute('d')).toMatch(/Z$/);
    }
    chart.destroy();
  });

  it('stacked mode piles bands: second band tops sit above first band tops', () => {
    const el = host();
    const chart = new AreaChart(el, {
      data: {
        labels: ['a', 'b'],
        series: [
          { id: 's1', data: [10, 10] },
          { id: 's2', data: [5, 5] },
        ],
      },
      stacked: true,
      showPoints: false,
      curve: 'linear',
    });
    const fills = [...el.querySelectorAll('svg path[fill]:not([fill="none"])')];
    expect(fills.length).toBe(2);
    // First y coordinate of each fill path: s2's band top (15) must be
    // higher on screen (smaller y) than s1's (10).
    const firstY = (d: string): number => Number(/M[\d.]+,([\d.]+)/.exec(d)![1]);
    const ys = fills.map((f) => firstY(f.getAttribute('d')!));
    expect(Math.min(...ys)).toBeLessThan(Math.max(...ys));
    chart.destroy();
  });
});

describe('PolarAreaChart smoke', () => {
  it('renders petals with value-scaled radii and ring grid', () => {
    const el = host();
    const chart = new PolarAreaChart(el, {
      data: { labels: ['A', 'B', 'C'], series: [{ id: 'p', data: [10, 20, 30] }] },
    });
    expect(el.querySelectorAll('svg path').length).toBe(3);
    expect(el.querySelectorAll('svg circle').length).toBe(4); // rings
    chart.toggleSeries('B');
    const ds = [...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d'));
    expect(ds.filter((d) => d === '').length).toBe(1); // collapsed slice
    chart.destroy();
  });
});

describe('FunnelChart smoke', () => {
  it('renders one trapezoid per stage with labels and percentages', () => {
    const el = host();
    const chart = new FunnelChart(el, {
      data: { labels: ['Top', 'Mid', 'Low'], series: [{ id: 'f', data: [100, 50, 25] }] },
    });
    expect(el.querySelectorAll('svg path').length).toBe(3);
    const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(texts).toContain('Top');
    expect(texts.some((t) => t?.includes('50%'))).toBe(true);
    chart.setData({ labels: ['Top', 'Low'], series: [{ id: 'f', data: [80, 20] }] });
    expect(el.querySelectorAll('svg path').length).toBe(2);
    chart.destroy();
  });
});

describe('CandlestickChart smoke', () => {
  it('renders body + wick per candle with up/down colors', () => {
    const el = host();
    const chart = new CandlestickChart(el, {
      data: {
        labels: ['d1', 'd2'],
        series: [
          {
            id: 'p',
            data: [
              { o: 10, h: 15, l: 8, c: 14 }, // up
              { o: 14, h: 16, l: 9, c: 10 }, // down
            ],
          },
        ],
      },
      upColor: '#00ff00',
      downColor: '#ff0000',
    });
    const bodies = [...el.querySelectorAll('svg rect')];
    expect(bodies.length).toBe(2);
    expect(bodies[0]!.getAttribute('fill')).toBe('#00ff00');
    expect(bodies[1]!.getAttribute('fill')).toBe('#ff0000');
    const wicks = el.querySelectorAll('svg .nova-candle line');
    expect(wicks.length).toBe(2);
    // Body spans open..close; wick spans high..low (taller or equal).
    const bodyH = Number(bodies[0]!.getAttribute('height'));
    const wick = wicks[0]!;
    const wickH = Math.abs(Number(wick.getAttribute('y2')) - Number(wick.getAttribute('y1')));
    expect(wickH).toBeGreaterThan(bodyH);
    chart.setData({
      labels: ['d1'],
      series: [{ id: 'p', data: [{ o: 5, h: 6, l: 4, c: 5.5 }] }],
    });
    expect(el.querySelectorAll('svg rect').length).toBe(1);
    chart.destroy();
  });
});

describe('GanttChart smoke', () => {
  const day = 86_400_000;
  const t0 = new Date(2026, 0, 5).getTime();
  const tasks = () => [
    { id: 'a', name: 'Alpha', start: t0, end: t0 + 3 * day, progress: 0.5 },
    { id: 'b', name: 'Beta', start: t0 + 2 * day, end: t0 + 6 * day, dependsOn: ['a'] },
  ];

  it('renders task bars, progress overlays, labels, and connectors', () => {
    const el = host();
    const chart = new GanttChart(el, { tasks: tasks(), margin: { left: 80 } });
    // 2 bars + 2 progress overlays
    expect(el.querySelectorAll('svg rect').length).toBe(4);
    const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(texts).toContain('Alpha');
    expect(texts).toContain('Beta');
    // One dependency connector
    expect(el.querySelectorAll('svg path[stroke-dasharray]').length).toBe(1);
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });

  it('setTasks reschedules and progress overlay width follows', () => {
    const el = host();
    const chart = new GanttChart(el, { tasks: tasks(), margin: { left: 80 } });
    const overlayBefore = Number(
      el.querySelectorAll('svg rect')[1]!.getAttribute('width'),
    );
    chart.setTasks(tasks().map((t) => ({ ...t, progress: 1 })));
    const overlayAfter = Number(
      el.querySelectorAll('svg rect')[1]!.getAttribute('width'),
    );
    expect(overlayAfter).toBeGreaterThan(overlayBefore);
    chart.destroy();
  });
});

describe('WaterfallChart smoke', () => {
  it('renders delta bars, a total bar, and connectors at running levels', () => {
    const el = host();
    const chart = new WaterfallChart(el, {
      data: { labels: ['Start', 'Up', 'Down'], series: [{ id: 'w', data: [50, 20, -30] }] },
      total: 'Net',
    });
    const rects = [...el.querySelectorAll('svg rect')];
    expect(rects.length).toBe(4); // 3 deltas + total
    const connectors = el.querySelectorAll(
      'svg line[stroke-dasharray]:not(.nova-crosshair)',
    );
    expect(connectors.length).toBe(3);
    // Net = 40: total bar height equals the |50+20-30| span.
    const heights = rects.map((r) => Number(r.getAttribute('height')));
    const startH = heights[0]!;
    const totalH = heights[3]!;
    expect(totalH).toBeCloseTo(startH * (40 / 50), 1);
    chart.destroy();
  });
});

describe('BarChart smoke', () => {
  it('renders one rect per series per column and morphs on setData', () => {
    const el = host();
    const chart = new BarChart(el, { data: data() });
    expect(el.querySelectorAll('svg rect').length).toBe(8); // 2 series x 4 columns
    expect(() =>
      chart.setData({
        labels: ['a', 'b', 'c'],
        series: [{ id: 's1', data: [4, 2, 6] }],
      }),
    ).not.toThrow();
    expect(el.querySelectorAll('svg rect').length).toBe(3);
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });

  it('toggling a series re-lays-out the survivors', () => {
    const el = host();
    const chart = new BarChart(el, { data: data() });
    const widthBefore = Number(el.querySelector('svg rect')!.getAttribute('width'));
    chart.toggleSeries('s2');
    const widthAfter = Number(el.querySelector('svg rect')!.getAttribute('width'));
    expect(widthAfter).toBeGreaterThan(widthBefore);
    chart.destroy();
  });

  it('stacked mode piles series and widens bars to the full band', () => {
    const el = host();
    const chart = new BarChart(el, { data: data() });
    const groupedW = Number(el.querySelector('svg rect')!.getAttribute('width'));
    chart.setOptions({ stacked: true });
    const rects = [...el.querySelectorAll('svg rect')];
    const stackedW = Number(rects[0]!.getAttribute('width'));
    expect(stackedW).toBeGreaterThan(groupedW);
    // Same column, two series: segments must not overlap (s2 sits on s1).
    const col0 = rects.filter((r) => r.getAttribute('x') === rects[0]!.getAttribute('x'));
    expect(col0.length).toBe(2);
    const tops = col0.map((r) => Number(r.getAttribute('y')));
    const heights = col0.map((r) => Number(r.getAttribute('height')));
    const lower = tops[0]! > tops[1]! ? 0 : 1;
    expect(tops[1 - lower]! + heights[1 - lower]!).toBeCloseTo(tops[lower]!, 3);
    chart.destroy();
  });
});

describe('RadarChart smoke', () => {
  const radarData = () => ({
    labels: ['A', 'B', 'C', 'D'],
    series: [
      { id: 'r1', name: 'One', data: [10, 20, 30, 40] },
      { id: 'r2', name: 'Two', data: [40, 30, 20, 10] },
    ],
  });

  it('renders one closed polygon per series plus spokes', () => {
    const el = host();
    const chart = new RadarChart(el, { data: radarData() });
    const polys = [...el.querySelectorAll('svg path')].filter((p) =>
      p.getAttribute('d')?.endsWith('Z'),
    );
    // 2 series polygons + 4 grid rings (all closed)
    expect(polys.length).toBe(6);
    expect(el.querySelectorAll('svg line').length).toBe(4); // spokes
    chart.setData({ labels: ['A', 'B', 'C'], series: [{ id: 'r1', data: [1, 2, 3] }] });
    expect(el.querySelectorAll('svg line').length).toBe(3);
    chart.destroy();
  });
});

describe('GaugeChart smoke', () => {
  it('renders track, value arc, and formatted readout', () => {
    const el = host();
    const chart = new GaugeChart(el, {
      data: { series: [{ id: 'v', name: 'CPU', data: [42] }] },
      max: 100,
      format: (v) => `${Math.round(v)}%`,
    });
    expect(el.querySelectorAll('svg path').length).toBe(2);
    const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(texts).toContain('42%');
    expect(texts).toContain('CPU');
    chart.setValue(80);
    expect([...el.querySelectorAll('svg text')].map((t) => t.textContent)).toContain('80%');
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });
});

describe('HeatmapChart smoke', () => {
  it('renders rows × columns cells with ramped colors', () => {
    const el = host();
    const chart = new HeatmapChart(el, {
      data: {
        labels: ['c1', 'c2', 'c3'],
        series: [
          { id: 'r1', name: 'Row 1', data: [0, 50, 100] },
          { id: 'r2', name: 'Row 2', data: [100, 50, 0] },
        ],
      },
      colorRange: ['#000000', '#ffffff'],
    });
    const rects = [...el.querySelectorAll('svg rect')];
    expect(rects.length).toBe(6);
    const fills = rects.map((r) => r.getAttribute('fill'));
    expect(fills).toContain('rgb(0, 0, 0)');
    expect(fills).toContain('rgb(255, 255, 255)');
    expect(fills).toContain('rgb(128, 128, 128)');
    chart.setData({ labels: ['c1'], series: [{ id: 'r1', data: [5] }] });
    expect(el.querySelectorAll('svg rect').length).toBe(1);
    chart.destroy();
  });
});

describe('ScatterChart smoke', () => {
  it('renders circles with bubble radii from the r encoding', () => {
    const el = host();
    const chart = new ScatterChart(el, {
      data: {
        series: [
          {
            id: 'pts',
            data: [
              { x: 1, y: 2, r: 10 },
              { x: 3, y: 4, r: 40 },
            ],
          },
        ],
      },
    });
    const circles = [...el.querySelectorAll('svg circle')];
    expect(circles.length).toBe(2);
    const radii = circles.map((c) => Number(c.getAttribute('r')));
    expect(radii[1]!).toBeGreaterThan(radii[0]!);
    chart.setData({ series: [{ id: 'pts', data: [{ x: 0, y: 0 }] }] });
    expect(el.querySelectorAll('svg circle').length).toBe(1);
    chart.destroy();
  });
});

describe('DonutChart smoke', () => {
  const donutData = () => ({
    labels: ['A', 'B', 'C'],
    series: [{ id: 'd', data: [10, 20, 30] }],
  });

  it('renders one slice path per label plus a counting center total', () => {
    const el = host();
    const chart = new DonutChart(el, { data: donutData() });
    const paths = el.querySelectorAll('svg path');
    expect(paths.length).toBe(3);
    expect(el.querySelector('svg text')!.textContent).toBe('60');
    chart.destroy();
  });

  it('toggling a slice collapses it and the rest re-span the ring', () => {
    const el = host();
    const chart = new DonutChart(el, { data: donutData() });
    chart.toggleSeries('B');
    expect(el.querySelector('svg text')!.textContent).toBe('40');
    // Hidden slice has zero extent -> empty d.
    const ds = [...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d'));
    expect(ds.filter((d) => d === '').length).toBe(1);
    chart.destroy();
  });

  it('innerRadius 0 renders a pie with center wedges and no total', () => {
    const el = host();
    const chart = new DonutChart(el, { data: donutData(), innerRadius: 0 });
    expect(el.querySelector('svg text')).toBeNull();
    const d = el.querySelector('svg path')!.getAttribute('d')!;
    expect(d).toMatch(/^M[\d.]+,[\d.]+L/); // wedge starts at the center
    chart.destroy();
  });
});
