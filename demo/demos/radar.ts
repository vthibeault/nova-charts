import { RadarChart } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountRadarDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Radar',
    'Polygons whose every vertex is a spring — randomize and the shapes breathe around the axes.',
  );

  let axes = ['Speed', 'Power', 'Range', 'Comfort', 'Style', 'Value'];
  const score = (): number => Math.round(20 + Math.random() * 80);
  const data = (): Parameters<RadarChart['setData']>[0] => ({
    labels: axes,
    series: [
      { id: 'nova', name: 'Nova GT', data: axes.map(() => score()) },
      { id: 'rival', name: 'Rival X', data: axes.map(() => score()) },
    ],
  });

  const chart = new RadarChart(chartHost, { data: data(), max: 100 });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add axis', () => {
    if (axes.length < 10) {
      axes = [...axes, `Trait ${axes.length + 1}`];
      chart.setData(data());
    }
  });
  controls.button('Remove axis', () => {
    if (axes.length > 3) {
      axes = axes.slice(0, -1);
      chart.setData(data());
    }
  });
  controls.button('Toggle “Rival X”', () => chart.toggleSeries('rival'));
  const live = liveMode(() => chart.setData(data()));
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
