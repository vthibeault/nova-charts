import { TreemapChart } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountTreemapDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Treemap',
    'A squarified mosaic where every cell is a spring — randomize and the layout reflows, cells sliding into their new homes.',
  );

  let labels = ['Search', 'Video', 'Social', 'Mail', 'Maps', 'News', 'Music', 'Other'];
  const data = (): Parameters<TreemapChart['setData']>[0] => ({
    labels,
    series: [{ id: 'usage', data: labels.map(() => Math.round(5 + Math.random() * 95)) }],
  });

  const chart = new TreemapChart(chartHost, { data: data() });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add cell', () => {
    if (labels.length < 14) {
      labels = [...labels, `App ${labels.length + 1}`];
      chart.setData(data());
    }
  });
  controls.button('Remove cell', () => {
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
