import { WaterfallChart } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountWaterfallDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Waterfall',
    'Delta bars float at the running total with spring-riding connectors; the total bar sums it up.',
  );

  const labels = ['Start', 'Sales', 'Refunds', 'Costs', 'Tax', 'FX', 'Other'];
  const data = (): Parameters<WaterfallChart['setData']>[0] => ({
    labels,
    series: [
      {
        id: 'pnl',
        data: labels.map((_, i) =>
          i === 0
            ? Math.round(40 + Math.random() * 40)
            : Math.round((Math.random() - 0.45) * 60),
        ),
      },
    ],
  });

  const chart = new WaterfallChart(chartHost, { data: data(), total: 'Net' });

  controls.button('Randomize', () => chart.setData(data()), true);
  const live = liveMode(() => chart.setData(data()));
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
