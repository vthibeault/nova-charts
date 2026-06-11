import { DonutChart } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountDonutDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Donut',
    'Slices live in angle space — values morph the ring, hover pops a slice out, and the center total counts along.',
  );

  let labels = ['Search', 'Direct', 'Social', 'Email', 'Referral'];
  const value = (): number => Math.round(10 + Math.random() * 90);
  const data = (): Parameters<DonutChart['setData']>[0] => ({
    labels,
    series: [{ id: 'traffic', data: labels.map(() => value()) }],
  });

  const chart = new DonutChart(chartHost, { data: data() });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add slice', () => {
    if (labels.length < 8) {
      labels = [...labels, `Other ${labels.length - 4}`];
      chart.setData(data());
    }
  });
  controls.button('Remove slice', () => {
    if (labels.length > 2) {
      labels = labels.slice(0, -1);
      chart.setData(data());
    }
  });
  let pie = false;
  controls.button('Donut ⇄ pie', () => {
    pie = !pie;
    chart.setOptions({ innerRadius: pie ? 0 : 0.62 });
  });
  const live = liveMode(() => chart.setData(data()));
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
