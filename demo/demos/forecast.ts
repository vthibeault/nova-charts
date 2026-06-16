import { ForecastChart, type ForecastTask } from 'nova-charts';
import { makeShell } from './util.js';

export function mountForecastDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Forecast',
    'A Monte-Carlo schedule as a field of probability. Each task is a distribution, not a bar; uncertainty compounds along dependencies (later ridges spread wider); critical tasks glow; the P85 line is the realistic finish. Re-simulate and watch uncertainty ripple.',
  );

  const base: ForecastTask[] = [
    { id: 'research', name: 'Research', optimistic: 3, likely: 5, pessimistic: 9 },
    { id: 'design', name: 'Design', optimistic: 4, likely: 6, pessimistic: 11, dependsOn: ['research'] },
    { id: 'backend', name: 'Backend', optimistic: 8, likely: 12, pessimistic: 22, dependsOn: ['design'] },
    { id: 'frontend', name: 'Frontend', optimistic: 6, likely: 9, pessimistic: 16, dependsOn: ['design'] },
    { id: 'integrate', name: 'Integration', optimistic: 3, likely: 5, pessimistic: 12, dependsOn: ['backend', 'frontend'] },
    { id: 'qa', name: 'QA', optimistic: 4, likely: 6, pessimistic: 14, dependsOn: ['integrate'] },
  ];
  let state: ForecastTask[] = base.map((t) => ({ ...t }));

  const chart = new ForecastChart(chartHost, {
    tasks: state,
    iterations: 800,
    confidence: 85,
    unit: 'd',
    margin: { left: 96, top: 26 },
  });

  controls.button('Re-simulate', () => chart.setTasks(state.map((t) => ({ ...t }))), true);
  controls.button('Add risk to Backend', () => {
    state = state.map((t) =>
      t.id === 'backend' ? { ...t, pessimistic: t.pessimistic + 8, likely: t.likely + 2 } : t,
    );
    chart.setTasks(state);
  });
  controls.button('Tighten estimates', () => {
    state = state.map((t) => ({
      ...t,
      pessimistic: Math.max(t.likely + 1, Math.round(t.likely + (t.pessimistic - t.likely) * 0.5)),
      optimistic: Math.round(t.likely - (t.likely - t.optimistic) * 0.5),
    }));
    chart.setTasks(state);
  });
  controls.button('Reset', () => {
    state = base.map((t) => ({ ...t }));
    chart.setTasks(state);
  });
  // Confidence sweep: cycle the headline percentile.
  let conf = 85;
  controls.button('P50 ⇄ P85 ⇄ P95', () => {
    conf = conf === 85 ? 95 : conf === 95 ? 50 : 85;
    chart.setOptions({ confidence: conf });
  });

  return () => chart.destroy();
}
