import { StreamChart } from 'nova-charts';
import { makeShell, months, randomWalk, liveMode } from './util.js';

export function mountStreamDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Stream',
    'Stacked magnitudes flow around a centreline as smooth ribbons — every edge vertex is a spring, so the whole river breathes when the data changes. Thickness = magnitude over time.',
  );

  const cats = ['Infra', 'Product', 'Design', 'Growth', 'Support', 'Research'];
  let n = 14;
  const data = (): Parameters<StreamChart['setData']>[0] => ({
    labels: months(n),
    series: cats.map((c, i) => ({
      id: c,
      name: c,
      data: randomWalk(n, 30 + i * 8, 12, 2, 90),
    })),
  });

  const chart = new StreamChart(chartHost, { data: data() });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add period', () => {
    n = Math.min(n + 1, 32);
    chart.setData(data());
  });
  controls.button('Remove period', () => {
    n = Math.max(n - 1, 3);
    chart.setData(data());
  });
  controls.button('Toggle “Growth”', () => chart.toggleSeries('Growth'));
  const live = liveMode(() => chart.setData(data()), 1600);
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
