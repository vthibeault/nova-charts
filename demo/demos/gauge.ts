import { GaugeChart } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountGaugeDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Gauge',
    'The arc sweeps on a spring, the color springs through rgba space as it crosses thresholds, and the number counts along.',
  );

  const chart = new GaugeChart(chartHost, {
    data: { series: [{ id: 'cpu', name: 'CPU LOAD', data: [42] }] },
    min: 0,
    max: 100,
    format: (v) => `${Math.round(v)}%`,
    colorStops: [
      { until: 50, color: 'var(--nova-c4)' },
      { until: 80, color: 'var(--nova-c5)' },
      { until: 100, color: 'var(--nova-c7)' },
    ],
  });

  controls.button('Randomize', () => chart.setValue(Math.round(Math.random() * 100)), true);
  controls.button('Low (20)', () => chart.setValue(20));
  controls.button('High (92)', () => chart.setValue(92));
  const live = liveMode(() => chart.setValue(Math.round(Math.random() * 100)), 1800);
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
