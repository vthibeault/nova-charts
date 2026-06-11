import { LineChart } from 'nova-charts';
import { makeShell, months, randomWalk, liveMode } from './util.js';

export function mountLineDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Line',
    'Mash “Randomize” — every vertex is an independent spring, so interrupted morphs flow instead of jumping.',
  );

  let n = 12;
  const data = (): Parameters<LineChart['setData']>[0] => ({
    labels: months(n),
    series: [
      { id: 'revenue', name: 'Revenue', data: randomWalk(n, 60) },
      { id: 'cost', name: 'Cost', data: randomWalk(n, 35) },
    ],
  });

  const chart = new LineChart(chartHost, {
    data: data(),
    curve: 'catmull-rom',
  });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add point', () => {
    n = Math.min(n + 1, 36);
    chart.setData(data());
  });
  controls.button('Remove point', () => {
    n = Math.max(n - 1, 2);
    chart.setData(data());
  });
  controls.button('Toggle “Cost”', () => chart.toggleSeries('cost'));
  let curve: 'catmull-rom' | 'linear' | 'step' = 'catmull-rom';
  controls.button('Cycle curve', () => {
    curve = curve === 'catmull-rom' ? 'linear' : curve === 'linear' ? 'step' : 'catmull-rom';
    chart.setOptions({ curve });
  });
  const live = liveMode(() => chart.setData(data()));
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
