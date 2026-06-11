import { AreaChart } from 'nova-charts';
import { makeShell, months, randomWalk, liveMode } from './util.js';

export function mountAreaDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Area',
    'The fill chases the line, and the baseline itself is animated — domain changes move the floor.',
  );

  let n = 14;
  const data = (): Parameters<AreaChart['setData']>[0] => ({
    labels: months(n),
    series: [
      { id: 'sessions', name: 'Sessions', data: randomWalk(n, 70, 16) },
      { id: 'signups', name: 'Signups', data: randomWalk(n, 30, 10) },
    ],
  });

  const chart = new AreaChart(chartHost, { data: data(), curve: 'catmull-rom' });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add point', () => {
    n = Math.min(n + 1, 36);
    chart.setData(data());
  });
  controls.button('Remove point', () => {
    n = Math.max(n - 1, 2);
    chart.setData(data());
  });
  controls.button('Toggle “Signups”', () => chart.toggleSeries('signups'));
  const live = liveMode(() => chart.setData(data()));
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
