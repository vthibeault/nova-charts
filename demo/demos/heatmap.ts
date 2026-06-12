import { HeatmapChart } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountHeatmapDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Heatmap',
    'Cell colors are springs in rgba space — randomize and new values wash across the grid.',
  );

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let hours = ['6am', '9am', '12pm', '3pm', '6pm', '9pm', '12am'];
  const data = (): Parameters<HeatmapChart['setData']>[0] => ({
    labels: hours,
    series: days.map((d) => ({
      id: d,
      name: d,
      data: hours.map(() => Math.round(Math.random() * 100)),
    })),
  });

  const chart = new HeatmapChart(chartHost, { data: data() });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add column', () => {
    if (hours.length < 12) {
      hours = [...hours, `+${hours.length - 6}h`];
      chart.setData(data());
    }
  });
  controls.button('Remove column', () => {
    if (hours.length > 3) {
      hours = hours.slice(0, -1);
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
