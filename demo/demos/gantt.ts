import { GanttChart, type GanttTask } from 'nova-charts';
import { makeShell } from './util.js';

export function mountGanttDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Gantt',
    'Reschedule and every bar, progress fill, and dependency connector glides — connectors ride the springs frame by frame.',
  );

  const day = 86_400_000;
  const t0 = new Date(2026, 5, 1).getTime();
  const base: GanttTask[] = [
    { id: 'design', name: 'Design', start: t0, end: t0 + 5 * day, progress: 1 },
    { id: 'api', name: 'API', start: t0 + 3 * day, end: t0 + 10 * day, progress: 0.8, dependsOn: ['design'] },
    { id: 'ui', name: 'UI build', start: t0 + 6 * day, end: t0 + 14 * day, progress: 0.55, dependsOn: ['design'] },
    { id: 'integr', name: 'Integration', start: t0 + 11 * day, end: t0 + 17 * day, progress: 0.2, dependsOn: ['api', 'ui'] },
    { id: 'qa', name: 'QA', start: t0 + 15 * day, end: t0 + 21 * day, progress: 0, dependsOn: ['integr'] },
    { id: 'launch', name: 'Launch', start: t0 + 21 * day, end: t0 + 23 * day, progress: 0, dependsOn: ['qa'] },
  ];
  const jitter = (): GanttTask[] =>
    base.map((t) => {
      const shift = Math.round((Math.random() - 0.4) * 4) * day;
      const stretch = Math.round(Math.random() * 3) * day;
      return {
        ...t,
        start: (t.start as number) + shift,
        end: (t.end as number) + shift + stretch,
        progress: Math.min(Math.max((t.progress ?? 0) + (Math.random() - 0.4) * 0.3, 0), 1),
      };
    });

  const chart = new GanttChart(chartHost, {
    tasks: base,
    marker: { value: t0 + 12 * day },
    margin: { left: 90 },
  });

  controls.button('Reschedule', () => chart.setTasks(jitter()), true);
  controls.button('Reset plan', () => chart.setTasks(base));
  controls.button('Bump progress', () =>
    chart.setTasks(
      chart.tasks.map((t) => ({ ...t, progress: Math.min((t.progress ?? 0) + 0.15, 1) })),
    ),
  );

  return () => chart.destroy();
}
