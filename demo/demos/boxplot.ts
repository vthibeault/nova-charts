import { BoxPlotChart } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountBoxPlotDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Box plot',
    'Quartiles are computed from raw samples; every stat line is a spring, so new samples make the boxes stretch and slide.',
  );

  const teams = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
  const samples = (center: number, spread: number): number[] => {
    const out = Array.from({ length: 40 }, () => {
      // Rough normal via sum of uniforms.
      const u = (Math.random() + Math.random() + Math.random()) / 3;
      return Math.round((center + (u - 0.5) * spread) * 10) / 10;
    });
    // A few outliers to show the dots.
    if (Math.random() > 0.4) out.push(center + spread * (1.2 + Math.random()));
    if (Math.random() > 0.6) out.push(center - spread * (1.2 + Math.random()));
    return out;
  };
  const data = (): Parameters<BoxPlotChart['setData']>[0] => ({
    series: teams.map((t, i) => ({
      id: t,
      name: t,
      data: samples(40 + i * 8 + Math.random() * 20, 25 + Math.random() * 25),
    })),
  });

  const chart = new BoxPlotChart(chartHost, { data: data() });

  controls.button('Resample', () => chart.setData(data()), true);
  const live = liveMode(() => chart.setData(data()));
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
