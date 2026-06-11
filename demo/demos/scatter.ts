import { ScatterChart, type Point } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountScatterDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Scatter / Bubble',
    'Every point is its own spring — randomize and the cloud reorganizes itself. The r field drives bubble size.',
  );

  let n = 26;
  let bubbles = true;
  const cluster = (cx: number, cy: number, count: number): Point[] =>
    Array.from({ length: count }, () => ({
      x: Math.round((cx + (Math.random() - 0.5) * 40) * 10) / 10,
      y: Math.round((cy + (Math.random() - 0.5) * 30) * 10) / 10,
      ...(bubbles ? { r: Math.round(Math.random() * 40 + 4) } : {}),
    }));

  const data = (): Parameters<ScatterChart['setData']>[0] => ({
    series: [
      { id: 'alpha', name: 'Alpha', data: cluster(35, 40, Math.ceil(n / 2)) },
      { id: 'beta', name: 'Beta', data: cluster(70, 65, Math.floor(n / 2)) },
    ],
  });

  const chart = new ScatterChart(chartHost, { data: data() });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add points', () => {
    n = Math.min(n + 6, 80);
    chart.setData(data());
  });
  controls.button('Remove points', () => {
    n = Math.max(n - 6, 6);
    chart.setData(data());
  });
  controls.button('Bubble ⇄ dots', () => {
    bubbles = !bubbles;
    chart.setData(data());
  });
  controls.button('Toggle “Beta”', () => chart.toggleSeries('beta'));
  const live = liveMode(() => chart.setData(data()));
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
