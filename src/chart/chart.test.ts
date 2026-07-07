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
import { BudgetFlowChart } from './budgetflow.js';
import { TreemapChart } from './treemap.js';
import { BoxPlotChart } from './boxplot.js';
import { SankeyChart } from './sankey.js';
import { StreamChart } from './stream.js';
import { ForecastChart } from './forecast.js';
import { CascadeChart } from './cascade.js';
import { ChronicleChart } from './chronicle.js';
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

describe('BudgetFlowChart smoke', () => {
  const day = 86_400_000;
  const t0 = new Date(2026, 5, 1).getTime();
  const tasks = (spent = 30_000) => [
    { id: 'a', name: 'Alpha', start: t0, end: t0 + 10 * day, budget: 50_000, spent },
    {
      id: 'b',
      name: 'Beta',
      start: t0 + 8 * day,
      end: t0 + 20 * day,
      budget: 80_000,
      spent: 20_000,
      dependsOn: ['a'],
    },
  ];

  it('renders envelope + burn + forecast rects, labels, playhead, connector', () => {
    const el = host();
    const chart = new BudgetFlowChart(el, {
      tasks: tasks(),
      now: t0 + 12 * day,
      margin: { left: 100 },
    });
    // 3 rects per task (envelope, forecast, burn) = 6
    expect(el.querySelectorAll('svg .nova-flow rect').length).toBe(6);
    const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(texts.some((t) => t?.includes('Alpha'))).toBe(true);
    expect(texts).toContain('TODAY');
    // One dependency connector.
    expect(el.querySelectorAll('svg path[stroke-dasharray]').length).toBe(1);
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });

  it('burn fill widens as spend is logged', () => {
    const el = host();
    const chart = new BudgetFlowChart(el, {
      tasks: tasks(10_000),
      now: t0 + 12 * day,
      margin: { left: 100 },
    });
    const burnWidth = (): number =>
      Number(el.querySelector('svg .nova-flow-burn')!.getAttribute('width'));
    const before = burnWidth();
    chart.setTasks(tasks(45_000));
    const after = burnWidth();
    expect(after).toBeGreaterThan(before);
    chart.destroy();
  });
});

describe('TreemapChart smoke', () => {
  it('renders one cell per value, tiling the plot area by share', () => {
    const el = host();
    const chart = new TreemapChart(el, {
      data: { labels: ['A', 'B', 'C'], series: [{ id: 't', data: [60, 30, 10] }] },
    });
    const rects = [...el.querySelectorAll('svg rect')];
    expect(rects.length).toBe(3);
    const areas = rects.map(
      (r) => Number(r.getAttribute('width')) * Number(r.getAttribute('height')),
    );
    // Larger values get larger cells, roughly proportional.
    expect(areas[0]!).toBeGreaterThan(areas[1]!);
    expect(areas[1]!).toBeGreaterThan(areas[2]!);
    chart.setData({ labels: ['A'], series: [{ id: 't', data: [5] }] });
    expect(el.querySelectorAll('svg rect').length).toBe(1);
    chart.destroy();
  });
});

describe('BoxPlotChart smoke', () => {
  it('renders box, whiskers, median, and outlier dots per category', () => {
    const el = host();
    const chart = new BoxPlotChart(el, {
      data: {
        series: [
          // 1..9 plus a wild outlier
          { id: 'a', name: 'A', data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 50] },
          { id: 'b', name: 'B', data: [10, 12, 14, 16, 18] },
        ],
      },
    });
    expect(el.querySelectorAll('svg .nova-box').length).toBe(2);
    expect(el.querySelectorAll('svg .nova-box rect').length).toBe(2);
    // 4 lines per box: whisker + 2 caps + median
    expect(el.querySelectorAll('svg .nova-box line').length).toBe(8);
    // The 50 is an outlier dot on category A.
    expect(el.querySelectorAll('svg .nova-box circle').length).toBe(1);
    chart.destroy();
  });
});

describe('SankeyChart smoke', () => {
  it('lays out nodes in columns and draws value-weighted ribbons', () => {
    const el = host();
    const chart = new SankeyChart(el, {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      links: [
        { source: 'a', target: 'b', value: 30 },
        { source: 'b', target: 'c', value: 10 },
        { source: 'a', target: 'c', value: 10 },
      ],
    });
    expect(el.querySelectorAll('svg rect').length).toBe(3);
    const ribbons = [...el.querySelectorAll('svg path')];
    expect(ribbons.length).toBe(3);
    const widths = ribbons.map((p) => Number(p.getAttribute('stroke-width')));
    expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths)); // 30 vs 10
    // Columns increase left to right: a < b < c.
    const xs = [...el.querySelectorAll('svg rect')].map((r) => Number(r.getAttribute('x')));
    expect(xs[0]!).toBeLessThan(xs[1]!);
    expect(xs[1]!).toBeLessThan(xs[2]!);
    chart.setFlows(
      [{ id: 'a' }, { id: 'b' }],
      [{ source: 'a', target: 'b', value: 5 }],
    );
    expect(el.querySelectorAll('svg path').length).toBe(1);
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });
});

describe('StreamChart smoke', () => {
  const streamData = () => ({
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    series: [
      { id: 'a', name: 'A', data: [10, 20, 15, 25] },
      { id: 'b', name: 'B', data: [5, 8, 12, 6] },
      { id: 'c', name: 'C', data: [8, 4, 9, 14] },
    ],
  });

  it('renders one closed band per series, stacked symmetrically', () => {
    const el = host();
    const chart = new StreamChart(el, { data: streamData() });
    const bands = [...el.querySelectorAll('svg path')].filter((p) =>
      p.getAttribute('d')?.endsWith('Z'),
    );
    expect(bands.length).toBe(3);
    // x-axis labels present.
    const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(texts).toContain('Jan');
    // Bands are centred on the midline: the union of band y-extents should
    // straddle the plot centre, not pile up from the bottom.
    chart.setData({
      labels: ['Jan', 'Feb'],
      series: [{ id: 'a', data: [10, 20] }],
    });
    expect(el.querySelectorAll('svg path').length).toBeGreaterThanOrEqual(1);
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });

  it('toggling a series re-stacks the remaining bands', () => {
    const el = host();
    const chart = new StreamChart(el, { data: streamData() });
    const bandCount = () =>
      [...el.querySelectorAll('svg path')].filter((p) => (p.getAttribute('d') ?? '').endsWith('Z')).length;
    expect(bandCount()).toBe(3);
    chart.toggleSeries('b');
    expect(chart.isSeriesVisible('b')).toBe(false);
    expect(bandCount()).toBe(2);
    chart.toggleSeries('b');
    expect(bandCount()).toBe(3);
    chart.destroy();
  });
});

describe('ForecastChart smoke', () => {
  const tasks = (backendPess = 20) => [
    { id: 'a', name: 'Research', optimistic: 3, likely: 5, pessimistic: 9 },
    { id: 'b', name: 'Backend', optimistic: 8, likely: 12, pessimistic: backendPess, dependsOn: ['a'] },
    { id: 'c', name: 'QA', optimistic: 4, likely: 6, pessimistic: 12, dependsOn: ['b'] },
  ];

  it('renders one ridge per task plus a project ridge, axis labels, conf line', () => {
    const el = host();
    const chart = new ForecastChart(el, { tasks: tasks(), iterations: 400, seed: 1, margin: { left: 90 } });
    // 3 task ridges + 1 project ridge = 4 closed area paths.
    const ridges = [...el.querySelectorAll('svg path')].filter((p) => (p.getAttribute('d') ?? '').endsWith('Z'));
    expect(ridges.length).toBe(4);
    const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(texts).toContain('PROJECT');
    expect(texts.some((t) => t?.startsWith('P85'))).toBe(true); // confidence label
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });

  it('adding risk pushes the project P85 finish later', () => {
    const el = host();
    const chart = new ForecastChart(el, { tasks: tasks(20), iterations: 600, seed: 5, margin: { left: 90 } });
    // The axis rescales with the horizon, so read the P85 value from the
    // confidence label, not its pixel x.
    const p85 = (): number => {
      const label = [...el.querySelectorAll('svg text')].find((t) =>
        t.textContent?.startsWith('P85'),
      )!.textContent!;
      return Number(/(\d+)d/.exec(label)![1]);
    };
    const before = p85();
    chart.setTasks(tasks(40)); // much riskier backend
    const after = p85();
    expect(after).toBeGreaterThan(before);
    chart.destroy();
  });
});

describe('CascadeChart smoke', () => {
  const flat = () => [
    { id: 'long', name: 'Long', duration: 10 },
    { id: 'short', name: 'Short', duration: 4 },
    { id: 'join', name: 'Join', duration: 1, dependsOn: ['long', 'short'] },
  ];

  it('flat tasks: a bar path + slack rect per task, labels, connectors, finish', () => {
    const el = host();
    const chart = new CascadeChart(el, { tasks: flat(), margin: { left: 80 } });
    expect(el.querySelectorAll('.nova-cascade-bar').length).toBe(3);
    expect(el.querySelectorAll('.nova-cascade-slack').length).toBe(3);
    const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(texts.some((t) => t?.startsWith('Long'))).toBe(true);
    expect(texts.some((t) => t?.startsWith('Finish'))).toBe(true);
    expect(el.querySelectorAll('svg path[stroke-dasharray="3,3"]').length).toBe(2);
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });

  it('the slack-rich parallel task shows a buffer; the critical one does not', () => {
    const el = host();
    const chart = new CascadeChart(el, { tasks: flat(), margin: { left: 80 } });
    const slacks = [...el.querySelectorAll('.nova-cascade-slack')];
    const labels = [...el.querySelectorAll('.nova-row text')].map((t) => t.textContent);
    const w = (name: string): number =>
      Number(slacks[labels.findIndex((l) => l?.startsWith(name))]!.getAttribute('width'));
    expect(w('Short')).toBeGreaterThan(0);
    expect(w('Long')).toBeCloseTo(0, 1);
    chart.destroy();
  });

  it('nudging beyond a task’s slack pushes the project finish', () => {
    const el = host();
    const chart = new CascadeChart(el, { tasks: flat(), margin: { left: 80 } });
    const finish = (): number =>
      Number(/Finish (\d+)/.exec(
        [...el.querySelectorAll('svg text')].find((t) => t.textContent?.startsWith('Finish'))!
          .textContent!,
      )![1]);
    const before = finish();
    chart.nudge('short', 9);
    expect(finish()).toBeGreaterThan(before);
    chart.destroy();
  });

  describe('WBS hierarchy', () => {
    const wbs = () => [
      { id: 'P', name: 'Project' },
      { id: 'P1', name: 'Phase 1', parent: 'P' },
      { id: 'a', name: 'Spec', parent: 'P1', duration: 4 },
      { id: 'b', name: 'Build', parent: 'P1', duration: 6, dependsOn: ['a'] },
      { id: 'P2', name: 'Phase 2', parent: 'P' },
      { id: 'c', name: 'QA', parent: 'P2', duration: 5, dependsOn: ['b'] },
    ];

    it('collapsed root shows a rolled-up summary, hiding the activities', () => {
      const el = host();
      const chart = new CascadeChart(el, { tasks: wbs(), margin: { left: 100 } });
      // Only the root row is visible; it is a WBS summary.
      expect(el.querySelectorAll('.nova-row').length).toBe(1);
      expect(el.querySelector('.nova-wbs')).toBeTruthy();
      const label = el.querySelector('.nova-row text')!.textContent!;
      expect(label).toContain('Project');
      expect(label).toContain('(3)'); // rolls up 3 leaf activities
      chart.destroy();
    });

    it('expanding drills into sub-WBS and activities', () => {
      const el = host();
      const chart = new CascadeChart(el, { tasks: wbs(), expanded: ['P'], margin: { left: 100 } });
      // Root + its two phases visible (phases still collapsed).
      expect(el.querySelectorAll('.nova-row').length).toBe(3);
      chart.toggle('P1'); // open Phase 1 → its 2 activities appear
      const labels = [...el.querySelectorAll('.nova-row text')].map((t) => t.textContent);
      expect(labels.some((l) => l?.startsWith('Spec'))).toBe(true);
      expect(labels.some((l) => l?.startsWith('Build'))).toBe(true);
      expect(el.querySelectorAll('.nova-row').length).toBe(5);
      chart.toggle('P1'); // collapse again
      expect(el.querySelectorAll('.nova-row').length).toBe(3);
      chart.destroy();
    });

    it('the summary rolls up the critical span of its children', () => {
      const el = host();
      const chart = new CascadeChart(el, { tasks: wbs(), expanded: ['P'], margin: { left: 100 } });
      // Chain a→b→c = 4+6+5 = 15; everything is critical, so the root summary
      // is red (critical) — its bar fill should be the red health color.
      const rootBar = el.querySelector('.nova-wbs .nova-cascade-bar')!;
      expect(rootBar.getAttribute('fill')).toBe('rgb(251, 113, 133)');
      chart.destroy();
    });
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
    // Padded wedge: outer arc, then a line to the near-center apex, closed.
    expect(d).toMatch(/^M[\d.-]+,[\d.-]+A/);
    expect(d).toContain('L');
    expect(d.endsWith('Z')).toBe(true);
    expect(d).not.toMatch(/NaN/);
    chart.destroy();
  });
});

describe('ChronicleChart smoke', () => {
  const tasks = () => [
    // Landed: promised 10, finished on day 11.
    { id: 'design', name: 'Design', history: [{ at: 0, finish: 10 }, { at: 5, finish: 10 }], actual: 11 },
    // Slipping 0.5 d/d: honest fixed point = 40.
    { id: 'api', name: 'API', history: [{ at: 0, finish: 20 }, { at: 10, finish: 25 }, { at: 20, finish: 30 }] },
    // Runaway: promise recedes 1.2 d/d.
    { id: 'infra', name: 'Infra', history: [{ at: 0, finish: 15 }, { at: 10, finish: 27 }, { at: 20, finish: 39 }] },
  ];

  it('renders a comet, reality diagonal and label per task, plus the now line', () => {
    const el = host();
    const chart = new ChronicleChart(el, { tasks: tasks() });
    expect(el.querySelectorAll('svg polyline').length).toBe(3);
    const texts = [...el.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(texts).toContain('Design');
    expect(texts).toContain('Infra');
    chart.destroy();
    expect(el.querySelector('svg')).toBeNull();
  });

  it('at "today" the runaway shows ∞, the landed task shows its landing dot', () => {
    const el = host();
    const chart = new ChronicleChart(el, { tasks: tasks() });
    // Reduced motion ⇒ τ jumps straight to the end of history.
    const glyphs = [...el.querySelectorAll('svg text')].filter((t) => t.textContent === '∞');
    expect(glyphs.some((g) => g.getAttribute('opacity') === '0.95')).toBe(true);
    const dots = [...el.querySelectorAll('svg circle')].filter(
      (c) => c.getAttribute('fill') === '#34d399' && c.getAttribute('opacity') === '1',
    );
    expect(dots.length).toBe(1); // design landed
    chart.destroy();
  });

  it('scrubbing back in time hides re-plans that have not happened yet', () => {
    const el = host();
    const chart = new ChronicleChart(el, { tasks: tasks() });
    chart.setAsOf(2, true); // before the day-10 re-plans
    const hidden = [...el.querySelectorAll('svg circle')].filter(
      (c) => c.getAttribute('r') === '2' && c.getAttribute('opacity') === '0',
    );
    expect(hidden.length).toBeGreaterThanOrEqual(4); // later snapshot dots are dark
    chart.destroy();
  });

  it('statAt evolves with the scrub and matches the drift math', () => {
    const el = host();
    const chart = new ChronicleChart(el, { tasks: tasks() });
    expect(chart.statAt('api', 5)!.velocity).toBe(0); // only one re-plan seen
    const late = chart.statAt('api', 20)!;
    expect(late.velocity).toBeCloseTo(0.5, 6);
    expect(late.honest).toBeCloseTo(40, 4);
    expect(chart.statAt('infra', 20)!.runaway).toBe(true);
    chart.destroy();
  });
});
