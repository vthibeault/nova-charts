import { BarChart, DonutChart, LineChart, ScatterChart } from 'nova-charts';
import { months, randomWalk } from './util.js';

/** Four charts auto-randomizing on offset timers — the fluidity showcase. */
export function mountStressDemo(host: HTMLElement): () => void {
  const header = document.createElement('div');
  header.className = 'demo-header';
  header.innerHTML =
    '<h2>Stress</h2><p>Everything at once, on offset timers. Nothing snaps; everything flows.</p>';
  host.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'stress-grid';
  host.appendChild(grid);

  const hostFor = (): HTMLDivElement => {
    const card = document.createElement('div');
    card.className = 'chart-card';
    const el = document.createElement('div');
    el.className = 'chart-host dark-theme';
    card.appendChild(el);
    grid.appendChild(card);
    return el;
  };

  const lineData = () => ({
    labels: months(10),
    series: [
      { id: 'a', name: 'A', data: randomWalk(10, 60) },
      { id: 'b', name: 'B', data: randomWalk(10, 35) },
    ],
  });
  const barData = () => ({
    labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'],
    series: [
      { id: 'x', name: 'X', data: randomWalk(6, 55, 22, 10) },
      { id: 'y', name: 'Y', data: randomWalk(6, 35, 14, 8) },
    ],
  });
  const donutData = () => ({
    labels: ['One', 'Two', 'Three', 'Four'],
    series: [{ id: 'd', data: [1, 2, 3, 4].map(() => 10 + Math.random() * 80) }],
  });
  const scatterData = () => ({
    series: [
      {
        id: 's',
        name: 'S',
        data: Array.from({ length: 18 }, () => ({
          x: Math.random() * 100,
          y: Math.random() * 100,
          r: Math.random() * 30 + 4,
        })),
      },
    ],
  });

  const line = new LineChart(hostFor(), { data: lineData(), legend: false });
  const bar = new BarChart(hostFor(), { data: barData(), legend: false });
  const donut = new DonutChart(hostFor(), { data: donutData(), legend: false });
  const scatter = new ScatterChart(hostFor(), { data: scatterData(), legend: false });

  const timers = [
    setInterval(() => line.setData(lineData()), 1600),
    setInterval(() => bar.setData(barData()), 2100),
    setInterval(() => donut.setData(donutData()), 2600),
    setInterval(() => scatter.setData(scatterData()), 3100),
  ];

  return () => {
    for (const t of timers) clearInterval(t);
    line.destroy();
    bar.destroy();
    donut.destroy();
    scatter.destroy();
  };
}
