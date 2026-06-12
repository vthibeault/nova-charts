import { PolarAreaChart } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountPolarDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Polar area',
    'Equal-angle petals whose radii spring with the values. Toggle a slice and the rest re-span the circle.',
  );

  let labels = ['North', 'East', 'South', 'West', 'Up', 'Down'];
  const data = (): Parameters<PolarAreaChart['setData']>[0] => ({
    labels,
    series: [{ id: 'wind', data: labels.map(() => Math.round(15 + Math.random() * 85)) }],
  });

  const chart = new PolarAreaChart(chartHost, { data: data() });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add slice', () => {
    if (labels.length < 10) {
      labels = [...labels, `Dir ${labels.length + 1}`];
      chart.setData(data());
    }
  });
  controls.button('Remove slice', () => {
    if (labels.length > 3) {
      labels = labels.slice(0, -1);
      chart.setData(data());
    }
  });
  const live = liveMode(() => chart.setData(data()));
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
