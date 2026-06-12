import { FunnelChart } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountFunnelDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Funnel',
    'Stages reflow as one shape — each trapezoid’s bottom meets the next stage’s top, all on springs.',
  );

  let stages = ['Visited', 'Signed up', 'Activated', 'Subscribed', 'Retained'];
  const data = (): Parameters<FunnelChart['setData']>[0] => {
    let v = 800 + Math.random() * 400;
    return {
      labels: stages,
      series: [
        {
          id: 'conv',
          data: stages.map(() => {
            const out = Math.round(v);
            v *= 0.45 + Math.random() * 0.4;
            return out;
          }),
        },
      ],
    };
  };

  const chart = new FunnelChart(chartHost, { data: data() });

  controls.button('Randomize', () => chart.setData(data()), true);
  controls.button('Add stage', () => {
    if (stages.length < 8) {
      stages = [...stages, `Stage ${stages.length + 1}`];
      chart.setData(data());
    }
  });
  controls.button('Remove stage', () => {
    if (stages.length > 2) {
      stages = stages.slice(0, -1);
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
