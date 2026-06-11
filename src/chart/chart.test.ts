import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LineChart } from './line.js';
import { AreaChart } from './area.js';
import { BarChart } from './bar.js';
import { ScatterChart } from './scatter.js';
import { DonutChart } from './donut.js';
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
