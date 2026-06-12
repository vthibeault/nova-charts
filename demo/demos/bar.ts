import { BarChart } from 'nova-charts';
import { makeShell, randomWalk, liveMode } from './util.js';

export function mountBarDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Bar',
    'Bars grow from the baseline with a ripple stagger; toggling a series makes the survivors spring into the freed slots.',
  );

  let n = 8;
  let grouped = true;
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'W2', 'W3', 'W4', 'W5', 'W6'];
  const data = (): Parameters<BarChart['setData']>[0] => ({
    labels: labels.slice(0, n),
    series: grouped
      ? [
          { id: 'online', name: 'Online', data: randomWalk(n, 60, 20, 8) },
          { id: 'retail', name: 'Retail', data: randomWalk(n, 40, 16, 8) },
          { id: 'partner', name: 'Partner', data: randomWalk(n, 25, 10, 5) },
        ]
      : [{ id: 'online', name: 'Online', data: randomWalk(n, 60, 20, 8) }],
  });

  const chart = new BarChart(chartHost, { data: data() });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add column', () => {
    n = Math.min(n + 1, 12);
    chart.setData(data());
  });
  controls.button('Remove column', () => {
    n = Math.max(n - 1, 2);
    chart.setData(data());
  });
  controls.button('Grouped ⇄ single', () => {
    grouped = !grouped;
    chart.setData(data());
  });
  let stacked = false;
  controls.button('Stacked ⇄ grouped', () => {
    stacked = !stacked;
    chart.setOptions({ stacked });
  });
  controls.button('Toggle “Retail”', () => chart.toggleSeries('retail'));
  const live = liveMode(() => chart.setData(data()));
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
